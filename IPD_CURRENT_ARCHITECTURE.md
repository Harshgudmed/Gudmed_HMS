# IPD Module — Current Architecture (Frozen Documentation)

> Documents **exactly what exists today** in the codebase — no proposals, no redesign.
> Verified against: `backend/src/controllers/inpatientController.js`,
> `backend/src/inpatient/{tariffService,billService,billPaymentService,dischargeService,nursingService,rbac,audit}.js`,
> `backend/prisma/schema.prisma`, and `frontend/src/components/inpatient/*`.
> Last frozen: 2026-06-15.

Single backend entry point: **`/api/inpatient`** (one route, resource-router pattern) — `GET`→`getAll`, `POST`→`create`, `PATCH`→`update`, `DELETE`→`remove`; the `resource` field selects the operation.

---

# SECTION 1 — SYSTEM OVERVIEW (admission → discharge)

```
1.  Patient Admission     POST admission   → Admission(status=admitted, state=ADMITTED)
2.  Bed Assignment        (same call)      → atomic bed claim (status available→occupied)
3.  Bed Occupancy         (same call)      → BedOccupancy segment opened (ADMIT), category snapshot
        + PatientTariff locked (payer plan snapshot), legacy deposit→ADVANCE on first bill-generate
4.  Tariff Calculation    resolvePrice()   → plan × bed-category × service-group rule
5.  Charge Posting        POST post-charge → IpdCharge row (frozen price+tax+discount), idempotent
        (pharmacy charges: base from PharmacyDrug + ward markup + GST)
6.  Bill Generation       POST bill-generate → open DRAFT Bill, links ACTIVE charges, snapshots totals
7.  Bill Finalization     POST bill-finalize → atomic IPD-FY number, status=FINAL, immutable snapshot
8.  Payment Collection    POST payment     → BillPayment(SUCCESS) + RCP-FY receipt; recompute rollup
9.  Balance Due Calc      recalcBill()     → paidTotal = Σ SUCCESS; balanceDue = payable − paid
10. Billing Clearance     POST clearance   → BILLING blocked if balanceDue>0 (cash) unless force
11. Discharge             POST discharge-finalize → gated on all clearances; finalizes bill
12. Housekeeping Turnover (same call)      → bed status→dirty + HousekeepingTask(OPEN); DONE→available
```

Transfer (mid-stay): `POST transfer` closes the current occupancy segment, atomically claims the new bed, opens a new segment (TRANSFER), frees the old bed to turnover, and writes a `WARD TRANSFER NOTE` clinical note — all in one transaction.

Alternate exits: `POST mark-exit` (LAMA / ABSCONDED / EXPIRED) bypasses the clearance gate.

---

# SECTION 2 — PRISMA DATA MODEL ANALYSIS

**Universal rules observed in code:**
- Every IPD model has `organizationId` and a relation to `Organization` with **onDelete: Cascade** (deleting a hospital removes its data).
- Every admission-child relation uses **onDelete: Restrict** (an admission cannot be deleted while it has occupancy/charges/bills/payments/vitals/notes/MAR/clearances/tariff — protects medico-legal + financial records).
- `IpdCharge.bill` and `BillPayment.bill` use **onDelete: SetNull** (cancelling/deleting a bill detaches its lines/payments rather than destroying them — they carry forward).

### Organization
- **Purpose:** tenant root. **Business:** the hospital. **Relations:** owns every IPD entity. **Cascade:** deleting it cascades to all children.

### Department
- **Purpose:** clinical department. **Fields:** name. **Business:** specialty a ward belongs to. **Relations:** `Ward.departmentId?` → Department.

### Ward
- **Purpose:** a ward/unit. **Fields:** `name, code, type, capacity, building, floor, departmentId?, chargeNurse, phone, isActive`. **Business:** physical/organizational grouping of beds (building→floor→ward). **Relations:** belongs to Organization (Cascade) + Department?; has many `Bed`.

### Bed
- **Purpose:** a physical bed. **Fields:** `wardId, bedCategoryId?, bedNumber, type, status` (available/occupied/dirty/cleaning/maintenance/reserved), `currentPatientId?`. **Business:** the billable/assignable unit; `bedCategoryId` drives pricing. **Relations:** Ward (Cascade), BedCategory? , has many Admission/BedOccupancy/HousekeepingTask.

### Admission
- **Purpose:** an inpatient stay. **Fields:** `patientId, bedId?, admissionDate, admissionType, admissionDiagnosis, chiefComplaint, expectedLengthOfStay, depositAmount, isCritical, criticalLevel, admittingDoctorId?, attendingDoctorId?, status` (admitted/discharged/transferred), `admissionState` (ADMITTED…DISCHARGED/LAMA/…), `dischargeType`, discharge fields. **Legacy (deprecated, still columns):** `dailyRoomRate, totalBillAmount, billGenerated, additionalCharges`. **Relations:** patient, bed; children (all Restrict): occupancies, ipdCharges, vitalsRecords, clinicalNotesV2, medicationAdministrations, dischargeClearances, patientTariff, bills, billPayments.

### BedOccupancy
- **Purpose:** the **segment ledger** — which bed a patient occupied for which window. **Fields:** `admissionId, bedId, bedCategoryId?` (snapshot), `startAt, endAt?` (null=current), `reason` (ADMIT/TRANSFER). **Business:** enables per-segment bed billing across transfers. **Relations:** admission (Restrict), bed, bedCategory?.

### TariffPlan
- **Purpose:** a payer rate card. **Fields:** `name, payerType` (CASH/INSURANCE/TPA/CORPORATE/GOVT/EMPLOYEE), `validFrom, validTo?, isDefault, isActive`. **Business:** "Cash (Default)" etc. **Relations:** has many TariffRule.

### TariffRule
- **Purpose:** one configurable price adjustment. **Fields:** `planId, bedCategoryId?` (null=any), `serviceGroup?` (null=any), `serviceItemId?` (item override), `adjustmentType` (PERCENT/FIXED_DELTA/ABSOLUTE_OVERRIDE), `adjustmentValue, validFrom, validTo?`. **Business:** "Private room PHARMACY +20%", "General BED = ₹1000". **Relations:** plan (Cascade).

### PatientTariff
- **Purpose:** the plan **locked** to one admission (snapshot). **Fields:** `admissionId (unique), planId, payerType`. **Business:** mid-stay catalog changes don't retroactively change this patient's pricing basis. **Relations:** admission (Restrict).

### ChargeMaster
- **Purpose:** canonical catalog of billable items. **Fields:** `code, name, serviceGroup, uom, basePrice, taxRatePct, isActive`. **Business:** single source of base prices (bed-day, nursing, doctor visit…). **Relations:** has many IpdCharge.

### IpdCharge  *(= the bill line item)*
- **Purpose:** one posted charge. **Fields:** `admissionId, chargeItemId?, description, serviceGroup, unitPrice, quantity`; **frozen snapshot:** `taxPct, taxAmount, discountPct, discountAmount, lineTotal`; **traceability:** `serviceDate, sourceModule, sourceRef, postedById, postedByName, createdAt, resolvedFrom(JSON)`; **lifecycle:** `status` (ACTIVE/CANCELLED/RETURNED), `cancelReason, cancelledById, cancelledAt`; `billId?`. **Business:** immutable historical fact; cancellation marks status (never deletes). **Relations:** admission (Restrict), chargeItem?, bill? (SetNull). **Idempotency:** `@@unique(organizationId, sourceModule, sourceRef)`.

### Bill
- **Purpose:** a persisted bill document. **Fields:** `admissionId` (NOT unique → many bills per admission), `billNumber?` (assigned at finalize), `status` (DRAFT/FINAL/CANCELLED), `billType` (INTERIM/FINAL/SUPPLEMENTARY), `payerType`; totals `bedTotal, serviceTotal, subtotal, taxTotal, discountTotal, depositTotal, payableTotal`; rollup `paidTotal, balanceDue, paymentStatus`; `cancelReason, finalizedAt, createdById`. **Relations:** admission (Restrict), charges (IpdCharge[]), payments (BillPayment[]). **Unique:** `@@unique(organizationId, billNumber)`.

### BillCounter
- **Purpose:** atomic per-org/FY sequence. **Fields:** `series` (IPD/RCP), `year` (FY), `value`. **Business:** gapless, concurrency-safe numbering. **Unique:** `@@unique(organizationId, series, year)`.

### BillPayment  *(the payment ledger)*
- **Purpose:** signed, immutable money event. **Fields:** `billId?, admissionId, receiptNumber?, type` (ADVANCE/PAYMENT/REFUND), `amount` (+/−), `method` (CASH/UPI/CARD/BANK_TRANSFER/CHEQUE), `reference?, status` (SUCCESS/VOID), `voidReason?, note?, creditNoteId?, idempotencyKey?, receivedById/Name, paidAt`. **Relations:** admission (Restrict), bill? (SetNull). **Unique:** `@@unique(organizationId, receiptNumber)` and `@@unique(organizationId, idempotencyKey)`.

### DischargeClearance
- **Purpose:** the multi-disciplinary gate. **Fields:** `admissionId, type` (DOCTOR/NURSING/PHARMACY/BILLING), `status` (PENDING/CLEARED/BLOCKED), `clearedById/Name, clearedAt, remark`. **Unique:** `@@unique(admissionId, type)`. **Relations:** admission (Restrict).

### HousekeepingTask
- **Purpose:** bed turnover work item. **Fields:** `bedId, admissionId?, type` (CLEANING…), `status` (OPEN/IN_PROGRESS/DONE), `assignedToName?, notes?, openedAt, closedAt?`. **Relations:** bed, organization (Cascade).

### AuditLog (shared, reused by IPD)
- **Purpose:** who/what/when/before/after. **Fields:** `userId?, userEmail, userRole, action, entityType, entityId, oldValues, newValues, ipAddress, userAgent, performedAt, metadata?`. **Relations:** organization (Cascade), user? (FK; IPD writes fall back to null userId if unresolved).

### ERD (IPD subset)
```
Organization 1─*┬─ Department ─1─* Ward ─1─* Bed ──1─* BedOccupancy *─1 Admission
                │                                  └─1─* HousekeepingTask
                ├─ TariffPlan ─1─* TariffRule
                ├─ ChargeMaster ─1─* IpdCharge *─1 Admission,  IpdCharge *─0..1 Bill
                ├─ Bill ─1─* IpdCharge,  Bill ─1─* BillPayment,  Bill *─1 Admission
                ├─ BillCounter
                ├─ PatientTariff 1─1 Admission
                ├─ VitalsRecord / ClinicalNote / MedicationAdministration / DischargeClearance  *─1 Admission
                └─ AuditLog
```
DB-level partial unique indexes (raw SQL, `scripts/ensure-ipd-indexes.mjs`): `uniq_active_admission_per_patient` (one admitted per patient), `uniq_open_occupancy_per_bed` (one open segment per bed), `uniq_open_bill_per_admission` (one DRAFT per admission), `uniq_advance_migrated_per_admission` (one legacy-deposit advance).

---

# SECTION 3 — BUSINESS RULES (as implemented)

**Ward/Bed Management** — Creating a ward auto-creates N `Standard` beds (=capacity). Increasing capacity back-fills beds. A ward **cannot be deleted while it has active admissions** (blocked). A bed **cannot be deleted while occupied** (blocked). Real use: ward setup + safe teardown.

**Admissions** — A patient may have **only one active admission** (app guard + DB partial unique → 409 `IPD_PATIENT_ALREADY_ADMITTED`). Bed is **atomically claimed** (`updateMany where status=available`, count must be 1, else 409 `IPD_BED_UNAVAILABLE`) → no double-booking. Opens occupancy + locks PatientTariff. Real use: ER/elective intake without double-allocation.

**Transfers** — Only an `admitted` patient (else 409). New bed atomically claimed; old bed → dirty + housekeeping; occupancy segment closed/opened; transfer note written; whole thing transactional. Real use: ward↔ICU moves with correct per-segment billing.

**Occupancy Tracking** — Every bed-day attributed to the segment active at a noon census (`CENSUS_HOUR=12`); calendar-day counting, minimum 1 day. Real use: a transferred patient is billed General days + ICU days at their own rates.

**Tariff Engine** — Price = base × adjustment, resolved by most-specific rule (item > group > any; category-specific > any), effective-dated. Nothing hardcoded — all in `TariffRule`. Real use: room-category-based pricing per payer.

**Charge Posting** — Each charge freezes price/tax/discount/lineTotal + who/when + source. **Idempotent** on `(org, sourceModule, sourceRef)` → no double-billing from Lab/Pharmacy. Charges on a **FINAL bill cannot be cancelled** (409 `IPD_CHARGE_ON_FINAL_BILL`). Real use: ancillary charges auto-post once.

**Billing** — One admission → many bills; at most one open DRAFT (DB-enforced). FINAL bills are immutable. See Section 4.

**Payments** — Signed ledger; partial payments; idempotent; FINAL+DRAFT accept payments, CANCELLED rejects. See Section 5.

**Collections** — Aggregated by method + cashier over a date range for shift reconciliation.

**Discharge** — Gated on all clearances (NORMAL) unless `force`; LAMA/ABSCONDED/EXPIRED bypass. BILLING clearance blocked if cash balance outstanding. See Section 9.

**Audit Trail** — Every mutation logged before/after. See Section 7.

**RBAC** — Per-action role gate, enforced only when `AUTH_ENFORCED=true`. See Section 8.

---

# SECTION 4 — BILLING ARCHITECTURE

```
Admission ──many── IpdCharge (frozen line items)
Admission ──many── Bill (DRAFT → FINAL, or CANCELLED)   ← IpdCharge.billId links lines to a bill
```

- **Why `IpdCharge`:** an immutable, queryable, traceable line item (replaces the old `additionalCharges` JSON blob).
- **Why `Bill`:** a persisted, numbered, frozen *document* (replaces the recomputed `totalBillAmount` field). Finance/NABH need a stored bill, not a moving number.
- **Why many bills per admission:** interim bills during a long stay, a final bill at discharge, and supplementary bills for post-discharge charges.

**Draft logic** — `bill-generate` finds/creates the open DRAFT, links all `ACTIVE`, unbilled charges (and floating carried-forward payments), applies the legacy deposit as an ADVANCE once, then snapshots totals from `computeRunningBill()` and recomputes paid/balance.

**Final logic** — `bill-finalize` refreshes the draft, atomically increments the `IPD` counter → `billNumber`, sets `status=FINAL`, `finalizedAt`. After this the bill is **never mutated**.

**Supplementary logic** — After a bill is FINAL, posting new charges leaves them unlinked; the next `bill-generate` opens a **new DRAFT** (the partial index only blocks a second open draft, not a draft alongside a FINAL); finalizing it produces a supplementary bill.

**Cancellation logic** — `bill-cancel` sets `status=CANCELLED` (never deletes), detaches its ACTIVE charges and SUCCESS payments to `billId=null` so they re-link to the replacement on the next generate. Used for cancel-and-reissue corrections.

**Numbering / FY** — `IPD-<FY>-NNNNNN`, e.g. `IPD-2026-27-000001`. FY = Apr–Mar (`financialYear()`), resets each year, per-org, atomic via `BillCounter`, backed by `@@unique(organizationId, billNumber)`. Numbers assigned **only at finalize** (no draft gaps).

**Example:** Admit → post ECG ₹2000 → `bill-generate` (DRAFT, payable ₹2000) → `bill-finalize` (IPD-2026-27-000001) → later post Lab ₹500 → `bill-generate` (new DRAFT) → `bill-finalize` (IPD-2026-27-000002, SUPPLEMENTARY).

---

# SECTION 5 — PAYMENT LEDGER

```
Bill ──many── BillPayment (ADVANCE +, PAYMENT +, REFUND −) ── each gets a Receipt (RCP-FY)
                                   └────────── Collections report (by method / cashier)
```

- **Advance** — admission deposit, recorded as a `type=ADVANCE` entry (legacy `depositAmount` migrated once, guarded by partial unique index).
- **Payment** — `type=PAYMENT`, positive, atomic receipt number, idempotent on `idempotencyKey`.
- **Refund** — `type=REFUND`, negative amount (Credit-Note linkage `creditNoteId` reserved, not yet used).
- **Void** — `status=VOID` (audit-safe; never deleted); excluded from totals.
- **Balance Due / Payment Status** — recomputed on the Bill after each event.

**Formulas (`recalcBill`)**
```
paidTotal     = Σ BillPayment.amount  where status='SUCCESS'   (signed: advance+payment − refund)
balanceDue    = payableTotal − paidTotal
paymentStatus = balanceDue<=0 && paid>0 ? (refund && paid<payable ? REFUNDED : PAID)
              : paid>0 ? PARTIAL : UNPAID
```

**Worked example**
```
Room (bed) ........ 3,500
Lab .................. 500
Pharmacy ............ 300   (frozen at post; tax per line)
GST (per-line) ...... 136
─────────────────────────
Subtotal .......... 4,300   (bed 3,500 + service 800)
Tax ................. 136
Payable ........... 4,436   (payableTotal = subtotal + tax)

Advance ........... 1,000   (ADVANCE entry)
Payment 1 (CASH) .. 2,000
Payment 2 (UPI) ... 1,500
Refund ............. −100
─────────────────────────
paidTotal ......... 4,400
balanceDue ........... 36   → status PARTIAL
```
(If paid exceeds payable → balanceDue is negative = "Refund Due"; a REFUND entry brings it back to 0.)

---

# SECTION 6 — MONEY FLOW

```
Patient → Charge (IpdCharge, frozen) → Bill (snapshot totals) → Payment (BillPayment) → Collections
```
**Formulas in use:**
- Per-charge: `gross = unitPrice × quantity`; `discountAmount = gross × discountPct/100`; `taxable = gross − discountAmount`; `taxAmount = taxable × taxPct/100`; `lineTotal = taxable + taxAmount`. (All frozen at post time.)
- Bed-day (per segment): `days = calendar days at noon census (min 1)`; `rate = applyAdjustment(category.defaultBedDayRate, BED rule)`; `amount = rate × days`. `bedTotal = Σ segments`.
- Pharmacy unit: `base = sellingPrice ?? mrp`; `unit = applyAdjustment(base, PHARMACY rule)`; tax from drug `gstRate`.
- Bill: `serviceTotal = Σ ACTIVE service line taxable`; `taxTotal = Σ line tax`; `subtotal = bedTotal + serviceTotal`; `payableTotal = subtotal + taxTotal`.
- Ledger: `paidTotal`, `balanceDue` as Section 5.
- `applyAdjustment`: PERCENT → `base×(1+v/100)`; FIXED_DELTA → `base+v`; ABSOLUTE_OVERRIDE → `v`.
- **Money type: `Float`** throughout, rounded to 2 decimals (`round2`) at every boundary.

---

# SECTION 7 — AUDIT TRAIL (`auditIpd`)

Writes one `AuditLog` row per mutation: `userId` (from JWT; **falls back to null** if the FK can't resolve — an audit row is never lost), `userEmail`, `userRole`, `action`, `entityType` (`ipd.*`), `entityId`, `oldValues`/`newValues` (JSON before/after), `ipAddress` (x-forwarded-for/ip), `userAgent`, `performedAt`.

**Actions that create audit logs (verified):** admission `create`; `transfer`; `discharge` (finalize + mark-exit); `clearance`; `charge` (post-charge); `vitals`, `note` (note-v2), `mar` (clinical creates); `bed`/`ward` update + delete; bill `update` (bill-generate), `finalize`, `cancel`; `cancel-charge`; `payment`, `void`, `refund`; legacy `billing`. Reads are **not** audited.

---

# SECTION 8 — RBAC (from `rbac.js`)

Enforced **only when `AUTH_ENFORCED=true`**. `admin`/`super_admin` always pass. In demo mode (env off) nothing is blocked. Unlisted resources default to allow; **GET reads are not gated**. Clearance has a per-type role map.

| IPD action | Allowed roles (+admin/super_admin) | Blocked |
|---|---|---|
| ward / bed / sync-beds | receptionist | doctor, nurse, pharmacist, housekeeping, billing |
| admission | receptionist, doctor | nurse, pharmacist, housekeeping, billing |
| transfer | doctor, nurse | receptionist, others |
| discharge-initiate | doctor, nurse | others |
| discharge-finalize / discharge / mark-exit | doctor | receptionist, nurse, billing, … |
| clearance (post) | doctor, nurse, pharmacist, billing, receptionist | housekeeping |
| — clearance DOCTOR | doctor | all others |
| — clearance NURSING | nurse | all others |
| — clearance PHARMACY | pharmacist | all others |
| — clearance BILLING | billing, receptionist | doctor, nurse, … |
| vitals (create/update) | **nurse** | **doctor**, others |
| note-v2 / note / clinical-note / mar | doctor, nurse | others |
| post-charge / bill-generate / bill-finalize / bill-cancel / cancel-charge | receptionist, billing | doctor, nurse, … |
| payment | receptionist, billing | doctor, nurse, … |
| void-payment / refund | billing | receptionist, doctor, … |
| housekeeping | receptionist, housekeeping | doctor, nurse, billing |
| legacy billing / charge | receptionist, billing | — |

> Note: `nurse`, `pharmacist`, `billing`, `housekeeping` are mapped but **not yet enabled** in the web login role registry (`roleConfig.js` enables admin, doctor, receptionist, patient_crm). The permissions activate the moment those roles are added.

---

# SECTION 9 — DISCHARGE WORKFLOW

```
discharge-initiate → creates DOCTOR, NURSING, PHARMACY, BILLING clearance rows (PENDING),
                     sets admissionState=DISCHARGE_INITIATED
   ↓ each cleared via POST clearance {type, status:CLEARED}
   - DOCTOR  → role doctor
   - NURSING → role nurse
   - PHARMACY→ role pharmacist
   - BILLING → role billing/receptionist; BLOCKED if cash balanceDue>0 (409 IPD_BILLING_OUTSTANDING)
              or no FINAL bill (409 IPD_NO_FINAL_BILL), unless force
   ↓
discharge-finalize → if NORMAL and not all cleared → 409 IPD_DISCHARGE_BLOCKED_CLEARANCE
   (transaction): admission status=discharged, admissionState=DISCHARGED, dischargeDate
                  close open occupancy segment
                  bed status → 'dirty'  +  HousekeepingTask(OPEN, CLEANING)
   then (best-effort, outside tx): finalize the bill
   ↓
Housekeeping: PATCH housekeeping {status:IN_PROGRESS} → bed 'cleaning'
                                  {status:DONE}        → bed 'available'
```
LAMA / ABSCONDED / EXPIRED use `mark-exit` (bypasses clearances; same turnover + occupancy close). Legacy `discharge` PATCH still exists (org-scoped; blocks if clearances were initiated and pending; does turnover) — desktop does not use it.

---

# SECTION 10 — EDGE CASES HANDLED

| Edge case | Handling |
|---|---|
| Duplicate charge posting | `@@unique(org, sourceModule, sourceRef)`; post-charge returns existing with `deduped:true` |
| Duplicate payment (double-click) | `@@unique(org, idempotencyKey)`; returns existing with `deduped:true` |
| Bill finalized, then new charge | New charge stays unlinked → next bill-generate opens a fresh DRAFT (supplementary) |
| Supplementary bill | New DRAFT alongside the FINAL; finalized as billType=SUPPLEMENTARY |
| Refund after payment | `type=REFUND` negative entry; balanceDue rises; status may become REFUNDED |
| Overpayment | `balanceDue` negative = "Refund Due"; resolved by a REFUND entry |
| Underpayment | `paymentStatus=PARTIAL`; BILLING clearance blocked |
| Bill cancellation | status=CANCELLED (never deleted); charges + payments detached, carry forward |
| Charge return / cancel | `cancel-charge` sets status RETURNED/CANCELLED (never deleted); blocked on FINAL bills |
| Clearance failure | discharge-finalize → 409 IPD_DISCHARGE_BLOCKED_CLEARANCE (pending list returned) |
| Discharge blocked (unpaid) | BILLING clearance → 409 IPD_BILLING_OUTSTANDING |
| Bed double-booking | atomic claim (count==1) + `uniq_open_occupancy_per_bed` → 409 IPD_BED_UNAVAILABLE |
| Duplicate active admission | guard + `uniq_active_admission_per_patient` → 409 IPD_PATIENT_ALREADY_ADMITTED |
| Two open drafts | `uniq_open_bill_per_admission` prevents it |
| Cross-tenant access (write) | `ownedAdmission/ownedBed/ownedWard` org-scoped guards → 404 |
| Mass-assignment | whitelisted update fields (ADMISSION_UPDATABLE / BED_UPDATABLE) |
| Same-day transfer over-billing | calendar-day census billing (not per-segment ceil) |
| Tariff override vs category drift | running-bill returns a `warnings[]` flag |

---

# SECTION 11 — CURRENT STATUS

**STABLE (built + verified):**
- Ward/bed/occupancy management, building→floor→ward hierarchy, bed turnover lifecycle.
- Admission/transfer with transactions + atomic bed claim + DB race guards.
- Tariff engine (plans, rules, effective-dated, most-specific-wins) + occupancy-segment bed billing.
- Charge posting with frozen snapshot + idempotency; pharmacy auto-pricing (base+markup+GST) with role-gated breakdown.
- Bill lifecycle (draft/final/supplementary/cancel), per-org/FY numbering, immutable finals.
- Payment ledger (advance/payment/refund/void), per-org/FY receipts, partial payments, balance/status rollup, collections report.
- Clearance-gated discharge + housekeeping turnover; LAMA/absconded/expired exits.
- Nursing station (vitals+NEWS2, clinical notes table, eMAR); vitals nurse-only.
- Per-action RBAC, NABH-style audit trail (before/after), tenant isolation.
- Desktop UI: Bill Screen (generate/finalize/print/supplementary) + Payment UI (collect/refund/void/receipt) + Collections report.

**NEEDS IMPROVEMENT (works, with known limitations):**
- **Money is `Float`** (precision risk at scale; rounding mitigates).
- **RBAC enforced only when `AUTH_ENFORCED=true`**; nurse/billing/pharmacist/housekeeping roles not yet in the web login registry.
- DB partial-unique indexes are raw SQL (applied via deploy script, not in Prisma schema).
- Legacy `Admission` billing fields + `billing`/`charge` endpoints still present for the **mobile** app (deprecated).
- Bill bed-charge segment breakdown is computed live (not stored as line rows); FINAL print shows a single bed-total line.
- Audit `userId` can be null (resilient fallback) when the FK can't resolve.

**FUTURE PHASE (not built):**
- Insurance / TPA / Corporate payer split + InsuranceClaim.
- Credit Notes (the `creditNoteId` field is reserved but unused).
- Money → Decimal/integer-paise migration.
- Immutable final-bill PDF series / e-invoice.
- Mobile migration off the legacy billing endpoints; then drop the deprecated fields/endpoints.
- Orders management (doctor orders → Lab/Radiology/Pharmacy auto-posting `IpdCharge`).

---

# SECTION 12 — FINAL FROZEN ARCHITECTURE (today's truth)

- **One endpoint** `/api/inpatient` (resource-router) over four verbs; logic split into services: `tariffService` (pricing + running bill + NEWS), `billService` (bill lifecycle), `billPaymentService` (ledger), `dischargeService` (clearances/turnover), `nursingService` (NEWS2), `rbac` (per-action), `audit` (trail).
- **Data spine:** Organization → Ward → Bed; Admission as the stay; **BedOccupancy** segments drive bed billing; **IpdCharge** are frozen line items; **Bill** (+`BillCounter`) is the persisted numbered document; **BillPayment** is the signed money ledger; **Discharge­Clearance** + **HousekeepingTask** drive exit + turnover; **AuditLog** records everything.
- **Pricing** is fully DB-configurable (TariffPlan/TariffRule/ChargeMaster/PatientTariff); nothing hardcoded.
- **Integrity guarantees:** transactions on admit/transfer/discharge/payment; atomic bed + counter increments; four partial unique indexes; admission-children Restrict (no record loss); bill/payment SetNull (carry-forward); idempotent charges + payments; immutable FINAL bills; org-scoped writes; whitelisted updates; full audit.
- **Money** is `Float`, INR, rounded to paise at each step.
- **Surfaces:** desktop frontend fully on Bill/IpdCharge/BillPayment; mobile still on the deprecated legacy path.

This document reflects the implementation as of 2026-06-15 and describes only what exists.
