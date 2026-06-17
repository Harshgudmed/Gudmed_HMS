# IPD Phase 3.0 + 3A — Build-Ready Blueprint

> Status: **approved design, pre-implementation**. No code written yet.
> Scope decisions (locked): **3A = spine only** (no executor dispatch, no auto-billing) ·
> **unified search = virtual union** (no Orderable master table yet) ·
> Auto-billing + executor integration deferred to **3B (Procedure) → 3C (Lab) → 3D (Radiology) → 3E (Pharmacy)**.
>
> Hard constraint: **do NOT modify** Billing, Payment Ledger, Tariff Engine, Clearance,
> Discharge, Occupancy, or Audit architecture. All changes below are additive.

---

## Part A — Verification results (grounded in current code)

### A1. Frontend screens affected

| Screen | File | Change | Backward-compat |
|---|---|---|---|
| Role login / routing | `frontend/src/lib/roleConfig.js:40-66` | **3.0:** add 6 roles to `ROLES` + `LOGIN_HERO` | Additive; `AUTH_ENFORCED` off by default (`roleConfig.js:12`) → demo unchanged |
| Inpatient module | `frontend/src/components/inpatient/InpatientModule.jsx` (`TABS` map :591, content blocks :603+, `activeTab` :83) | **3A:** add "Clinical Orders" + "Doctor Notes" tabs + content blocks | Pure addition; existing tabs untouched |
| Nursing Station | `frontend/src/components/inpatient/NursingStation.jsx` | **3A:** add "Active Orders" panel (read + acknowledge) | Additive |
| Lab / Radiology / Pharmacy modules | their modules | **None in 3A** (executor integration is 3C–3E) | Untouched |
| BillScreen | `frontend/src/components/inpatient/BillScreen.jsx` | **None** (no auto-billing in 3A) | Untouched |

### A2. Backend modules reused (read-only in 3.0/3A)

| Module | File / fact | How reused | Modified? |
|---|---|---|---|
| Auth gate | `middleware/auth.js` — `authorize()` :60 passes any token role; admin/super always pass; `patient` blocked; no-op while `AUTH_ENFORCED` off :62 | New roles flow through with zero change | No |
| IPD RBAC | `inpatient/rbac.js` — `PERMS` + `ipdAllowed()` :57; `clearanceAllowed()` :67 | Add order resources; add `orderAllowed(type,action)` | 3A: additive |
| IPD controller | `inpatientController.js` — dispatch `getAll/create/update/remove`; `ipdAllowed` at create:445, update:1145, remove:1320; reads ungated | Add new `resource` branches | 3A: add branches |
| Catalogs | `LabTest`/`RadiologyExam`/`PharmacyDrug`/`ChargeMaster` | Read-only virtual-union search | No |
| Audit | `inpatient/audit.js` — `auditIpd()` resilient null-userId | New action strings | No |
| Notes | `ClinicalNote` (note-v2; `parentId` addendum schema:2413) + existing `note-v2`/`clinical-notes-v2` resources | Progress Notes = reuse | No new model |

### A3. Backward-compatibility matrix

| Subsystem | Touched in 3.0/3A? | Why safe |
|---|---|---|
| Lab / Radiology / Pharmacy | No (search reads only) | No schema/logic change; `admissionId`/`billingContext` cols deferred to 3C–3E |
| Billing / Tariff / Payment Ledger | No | No auto-billing in 3A; `IpdCharge`/`Bill`/`tariffService` untouched |
| Clearance / Discharge / Occupancy | No | Not referenced by spine in 3A |
| Audit | Additive | New action strings only; fallback unchanged |
| RBAC / Auth | Additive | `authorize()` already role-tolerant; `AUTH_ENFORCED` off in dev/demo → gates no-op |

### A4. Two verified findings the plan must handle

1. **JWT actor fields.** Login signs `{ userId, organizationId, role, email }` — **no `id`, no `fullName`** (`authController.js:60-69`). Code that reads `req.user?.id`/`fullName` only works for synthetic test tokens. **3A must read `req.user?.userId`**, and 3.0 should add `fullName` to the token, else order/note actor names are blank.
2. **Dormant roles confirmed.** Frontend `ROLES` = `admin, patient_crm, doctor, receptionist` only (`roleConfig.js:40`). Backend `rbac.js` already maps nurse/pharmacist/lab/radiology/billing/housekeeping and `authorize()` accepts any role → activation is **frontend + user seeding only**.

---

## Part B — Phase 3.0: Role Activation + RBAC

**Goal:** make the 6 mapped-but-dormant roles real so 3A's RBAC is testable. No clinical features.

| Deliverable | Detail |
|---|---|
| Prisma | **None.** `User.role` is a free string. (Optional parallel: move the 4 raw-SQL partial indexes from `ensure-ipd-indexes.mjs` into a managed migration — debt prep, non-blocking.) |
| Controller | **None** to auth. Optional admin user-create-with-role endpoint if absent. |
| Service | **None.** `authorize()` + `ipdAllowed()` already handle the roles. |
| Frontend | `roleConfig.js`: add `nurse, pharmacist, lab_technician, radiology_technician, billing, housekeeping` to `ROLES` (label, home, modules) + `LOGIN_HERO`. Suggested module access — nurse: `[dashboard,inpatient,patients]`; pharmacist: `[dashboard,pharmacy,inpatient]`; lab_technician: `[dashboard,laboratory]`; radiology_technician: `[dashboard,radiology]`; billing: `[dashboard,billing,inpatient,reports]`; housekeeping: `[dashboard,inpatient]`. `RoleLogin.jsx` auto-picks up via `KNOWN_ROLES`. |
| API | No new endpoints. **Recommend:** add `fullName` to JWT payload (`authController.js`). |
| Audit | None new. |
| Risk | **Low.** `AUTH_ENFORCED` off in dev/demo → no enforcement change for the live demo. Behavior change only when an org sets `AUTH_ENFORCED=true` (intended). |

### Phase 3.0 regression test
1. Demo: log in as admin/doctor/receptionist/patient_crm → unchanged landing + modules.
2. Seed one user per new role; log in → correct home + sidebar.
3. `AUTH_ENFORCED=true`: nurse token → `vitals` allowed, `bill-finalize` 403; admin all pass; patient 403 on staff API.
4. `verify-discharge-smoke.mjs` still passes.

---

## Part C — Phase 3A: ClinicalOrder Spine + Unified Search + Doctor Progress Notes

**Goal:** doctors place type-bound orders from one screen; orders move through the canonical lifecycle with full audit; progress notes via reused `ClinicalNote`. **No executor dispatch, no auto-billing.** Manual `post-charge` remains the only billing path in 3A.

### C1. Prisma changes (additive only)

```prisma
model ClinicalOrder {          // spine; one row per orderable per admission
  id, organizationId, admissionId, patientId
  orderType, catalogModel, catalogItemId, itemName, itemCode, serviceGroup
  priority @default("ROUTINE"), quantity @default(1), frequency?, dosage?, route?, duration?
  clinicalIndication?, notes?
  status @default("ORDERED")  // ORDERED|ACKNOWLEDGED|IN_PROGRESS|COMPLETED|CANCELLED
  domainStatus?
  orderedById/Name/At, acknowledgedById/At, startedById/At, completedById/At, cancelledById/At, cancelReason?
  executorModel?, executorId?         // null in 3A (filled 3B+)
  billed @default(false), ipdChargeId? // unused in 3A (filled 3B+)
  events ClinicalOrderEvent[]
  @@index([organizationId, admissionId, status]); @@index([organizationId, orderType, status])
}
model ClinicalOrderEvent {     // append-only timeline
  id, organizationId, orderId, fromStatus?, toStatus, actorId?, actorName?, actorRole?, remark?, at
  @@index([orderId, at])
}
```
- No change to `Bill`/`IpdCharge`/`TariffPlan`/`BillPayment`/`Admission`/Lab/Rad/Pharmacy in 3A.
- `ClinicalNote` reused as-is (no migration) for progress notes.
- New index ships via a **managed migration** (not raw SQL) to avoid drift.

### C2. Controller changes (`inpatientController.js` — add resource branches)

| Verb | New `resource` | Action | RBAC |
|---|---|---|---|
| GET | `orderables` | virtual-union search of 4 catalogs (`?q=&type=`) | reads ungated |
| GET | `orders` | list by `admissionId` (+status) | ungated |
| GET | `order` | one order + `events` timeline | ungated |
| GET | `order-worklist` | by `type`+`status` (dept queue) | ungated |
| POST | `order` | create spine row + first event + audit | `ipdAllowed(req,'order')` |
| POST | `order-ack`/`order-start`/`order-complete`/`order-cancel` | transition (state-machine guard) + event + audit | `orderAllowed(req, orderType, action)` |
| POST | `note-addendum` | append addendum (`parentId`) to `ClinicalNote` + audit | `ipdAllowed(req,'note-v2')` |

State machine: `ORDERED→ACKNOWLEDGED→IN_PROGRESS→COMPLETED`; `*→CANCELLED` (pre-COMPLETED only in 3A — no charge to reverse yet). Actor = `req.user?.userId`.

### C3. Service changes (new files; existing services untouched)

- `inpatient/orderService.js` — `createOrder`, `transition(order,to,actor)` (validates state machine, writes `ClinicalOrderEvent`), `listOrders`, `getOrder`. No tariff/bill calls in 3A.
- `inpatient/orderableSearch.js` — `search(org,{q,type})` → `Promise.all` over `LabTest`(price), `RadiologyExam`(price), `PharmacyDrug`(sellingPrice/mrp), `ChargeMaster`(basePrice); returns `[{catalogModel, catalogItemId, orderType, name, code, basePrice, serviceGroup}]`. Read-only, `take:25`.
- `inpatient/rbac.js` — add `PERMS` entries (`order`,`order-ack`,`order-cancel`) + `orderAllowed(req,orderType,action)` (discipline-scoped completion, mirrors `clearanceAllowed`).

### C4. Frontend components

```
InpatientModule
├─ TABS += {value:'clinical-orders', label:'Clinical Orders'}, {value:'doctor-notes', label:'Doctor Notes'}
├─ activeTab==='clinical-orders' && <ClinicalOrdersTab admissionId/>
│     ├─ OrderSearchBar      (GET orderables; type shown as quiet chip, never typed)
│     ├─ NewOrderDrawer      (priority ROUTINE/URGENT/STAT, qty/freq/duration/route/notes → POST order)
│     ├─ ActiveOrdersList    (GET orders; status chips; role-aware actions)
│     └─ OrderDetailDrawer → OrderTimeline (events) + Cancel
├─ activeTab==='doctor-notes' && <ProgressNotesPanel admissionId/>
│     ├─ NoteComposer        (POST note-v2, noteType=PROGRESS)
│     └─ NoteHistory         (GET clinical-notes-v2; addendum via POST note-addendum; read-only history)
└─ NursingStation += <ActiveOrdersPanel/> (GET order-worklist; POST order-ack)
```
Department worklists (Lab/Radiology/Pharmacy) are **stubs in 3A** (read `order-worklist`); complete→bill lands in 3C–3E.

### C5. API contracts

```jsonc
GET /api/inpatient?resource=orderables&q=ch&type=LAB
→ { success:true, data:[{ orderType:'RADIOLOGY', catalogModel:'RadiologyExam', catalogItemId:'rx_1',
     name:'Chest X-Ray PA', code:'XR-CHEST', basePrice:350, serviceGroup:'RADIOLOGY' }] }

POST /api/inpatient { resource:'order', admissionId:'A', catalogModel:'LabTest', catalogItemId:'lt_cbc',
     priority:'STAT', quantity:1, notes:'pre-op' }
→ { success:true, data:{ id:'ord_1', orderType:'LAB', itemName:'CBC', status:'ORDERED', orderedAt } }

POST /api/inpatient { resource:'order-complete', id:'ord_1' }
→ { success:true, data:{ id:'ord_1', status:'COMPLETED', completedAt } }   // NO charge in 3A

GET /api/inpatient?resource=order&id=ord_1
→ { success:true, data:{ ...order, events:[{toStatus:'ORDERED',actorName,at}] } }

POST /api/inpatient { resource:'note-v2', admissionId:'A', noteType:'PROGRESS', body:'Improving; continue antibiotics' }
POST /api/inpatient { resource:'note-addendum', parentId:'note_1', body:'Repeat CBC tomorrow' }
```

### C6. Audit events (via `auditIpd` → `AuditLog`, actor = `req.user.userId`)

```jsonc
order.create   {entityType:'ipd.order', entityId:'ord_1', after:{orderType:'LAB',itemName:'CBC',priority:'STAT'}}
order.update   {before:{priority:'ROUTINE'}, after:{priority:'STAT'}}        // pre-ack edit
order.ack      {before:{status:'ORDERED'}, after:{status:'ACKNOWLEDGED'}}
order.start    {after:{status:'IN_PROGRESS'}}
order.complete {before:{status:'IN_PROGRESS'}, after:{status:'COMPLETED'}}    // no charge in 3A
order.cancel   {before:{status:'ORDERED'}, after:{status:'CANCELLED', reason}}
note.create    {entityType:'ipd.note', after:{noteType:'PROGRESS', authorId}}
note.addendum  {entityType:'ipd.note', before:{parentId}, after:{addendum:true}}
```
Every transition also writes a `ClinicalOrderEvent` (UI timeline). Closes the current note audit gap.

### C7. Risk analysis

| Risk | Level | Mitigation |
|---|---|---|
| Spine added but billing not wired → user expects auto-charge | Low | 3A explicitly "no billing"; manual `post-charge` unchanged; note in release |
| Actor name blank (JWT lacks `fullName`/`id`) | Med | Use `req.user.userId`; add `fullName` to token in 3.0 |
| New index via raw SQL → drift | Low | Ship 3A index in a managed migration |
| `orderables` union slow on big catalogs | Low | Index name/code, `take:25`, debounce client |
| RBAC only when `AUTH_ENFORCED=true` | Low/known | Same as whole system today; test both modes |
| Editing large `InpatientModule.jsx` | Low | Additive only (TABS entry + content block) |

### C8. Regression test plan

**Backend (demo + `AUTH_ENFORCED=true`):**
1. `verify-discharge-smoke.mjs` → admit→generate→finalize→pay→clearances→discharge still PASS (**blocking**).
2. Existing bill/payment verify scripts → unchanged totals.
3. Order lifecycle create→ack→start→complete: assert 4 `ClinicalOrderEvent` + 5 `AuditLog`; assert **0** new `IpdCharge`.
4. State guard: ORDERED→COMPLETED → 400; double-complete → no dup event.
5. RBAC: doctor create ✓; lab tech complete LAB ✓ / RADIOLOGY ✗; receptionist create ✗; nurse ack ✓.
6. Notes: create PROGRESS + addendum; original immutable, addendum linked via `parentId`, both audited.
7. Search: `orderables?q=cbc` → LAB-typed CBC with `basePrice` from `LabTest.price`; pharmacy item returns `sellingPrice`.

**Frontend (Playwright, demo):**
8. Inpatient module loads with new tabs; **all existing tabs still render** (**blocking**).
9. Doctor: search "CBC" → LAB chip → place STAT order → appears in Active Orders + timeline.
10. Nurse: Active Orders → acknowledge → status flips.
11. BillScreen unchanged: generate/finalize/pay work; running bill shows no auto-charges.

**Go/No-Go:** tests 1, 2, 8 are blocking — if any regress, stop.

---

## Sequencing after 3A
- **3B Procedure** — `ProcedureExecution` + complete→`resolvePrice`→`IpdCharge` (idempotent). Lowest-risk proof of auto-billing.
- **3C Lab** / **3D Radiology** — link executor (`admissionId`/`clinicalOrderId`), complete→bill.
- **3E Pharmacy** — dispense/partial → stock + `IpdCharge`; **suppress `PharmacySale` when `billingContext='IPD'`** (double-billing guard), behind a feature flag.
- **3F** — materialized `Orderable` master + favorites + order sets + synonyms.
