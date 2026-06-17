# Enterprise Inpatient (IPD) Management System — Research & Architecture Blueprint

> Prepared as a Healthcare Solution Architecture document for the GudMed multi-tenant HMS.
> Grounded in a line-by-line read of the **current** implementation
> (`backend/src/controllers/inpatientController.js`, `inpatientRoutes.js`,
> `frontend/src/components/inpatient/InpatientModule.jsx`) and the Prisma schema.
> Scope target: AIIMS / Apollo / Medanta / Max / Fortis / Narayana / Govt. Medical Colleges / NABH.

---

## 0. Executive Summary

Your current IPD is a **competent CRUD ward-and-bed tracker with admit/discharge/transfer and JSON-blob clinical+billing**. It is roughly **20–25% of a world-class IPD platform** by surface area, and the missing 75% is exactly the part that makes IPD *hard*: occupancy-segment billing, a configurable tariff engine, a real nursing station (eMAR, vitals, rounds), multi-disciplinary discharge clearance, NABH-grade auditability, and clinical-safety controls.

**Headline recommendation: BUILD on your existing stack. Do NOT adopt OpenMRS/Bahmni wholesale** — you already own Lab, Radiology, Pharmacy, Billing, Payments and Blood Bank, and bolting a second clinical platform alongside them creates a permanent two-database reconciliation problem. Instead, **study Bahmni/OpenMRS data models** and re-implement the proven concepts (occupancy segments, charge master, effective-dated tariffs, order sets) natively in Prisma/Postgres.

**The single most important architectural change**: stop storing one `bedId` on the admission and stop computing bed-day charges as `rate × totalDays`. Introduce a **`BedOccupancy` segment ledger** and a **`ChargeMaster` + `TariffRule`** engine. Everything else (tariff inheritance, transfer billing, audit, reporting) hangs off those two decisions.

---

# DELIVERABLE 1 — Real-World Inpatient Workflow

### 1.1 Admission Workflows (4 entry paths, one state machine)

| Type | Trigger | Key real-world rules |
|---|---|---|
| **Planned / Elective** | Surgeon books a slot; pre-admission package | Pre-admission record, advance estimate, deposit collected *before* bed block; bed **reserved** not occupied until patient arrives |
| **Emergency** | From ER/Casualty | Admit first, paperwork after; provisional MRN allowed; "unknown patient" path; MLC flag if trauma/assault/RTA/poisoning |
| **Direct** | Walk-in advised admission from OPD | Consultation → advice-to-admit → bed search → admit |
| **Referral** | Transfer-in from another facility | Referring hospital, referral letter, ambulance handover, condition-on-arrival |

A real IPD models admission as a **state machine**, not a boolean:
`REQUESTED → BED_RESERVED → ADMITTED → (IN_TREATMENT) → DISCHARGE_INITIATED → CLEARANCES_PENDING → BILL_FINALIZED → DISCHARGED` with side-branches `→ LAMA`, `→ ABSCONDED`, `→ EXPIRED`, `→ TRANSFERRED_OUT`. Your current code only has `admitted / discharged / transferred` as free-text strings — there is no guarded transition logic.

### 1.2 Bed Management lifecycle
- **Allocation** — match patient to bed by category, gender ward rules, isolation needs, telemetry/oxygen capability.
- **Blocking** — temporarily hold a bed (e.g. for an OT case returning to ICU) without an admission.
- **Reservation** — planned admissions hold a bed for a date window.
- **Release** — on discharge/transfer/death the bed becomes **DIRTY**, not immediately **AVAILABLE**.
- **Turnover** — `OCCUPIED → DIRTY → CLEANING (housekeeping task) → INSPECTED → AVAILABLE`. Bed status must have *more than* 4 values. Real systems track **gender lock**, **maintenance**, **quarantine/fumigation**, **out-of-service**.

> Current gap: beds have only `available/occupied/maintenance/reserved` and the discharge path sets the bed straight back to `available` — **skipping the housekeeping/turnover cycle entirely**, which NABH infection-control expects to be auditable.

### 1.3 Transfer Workflows
Ward↔Ward, Bed↔Bed (same ward), and **escalation/de-escalation** (Ward→HDU→ICU and back; NICU; PICU; Isolation). Each transfer must: record reason + ordering doctor, **close the previous occupancy segment**, open a new one at the new bed's tariff, generate a transfer note, and re-evaluate care-level charges. Critical-care transfers additionally require a clinical handover note (SBAR).

### 1.4 Clinical Workflow (the "Nursing Station")
- **Daily rounds** — doctor round entries, plan-of-care, consultant visits (each a billable Doctor Visit).
- **Progress notes / Nursing notes** — typed, timestamped, **author-attributed, append-only, never edited in place**.
- **Vitals monitoring** — time-series (BP, HR, RR, SpO₂, temp, pain score, GCS, intake/output, blood sugar). Must support charts and early-warning scores (NEWS2/MEWS).
- **Medication Administration (eMAR)** — the prescription comes from Pharmacy; nursing records each *administration* (the "5 rights"): right patient/drug/dose/route/time, with missed/refused/held reasons. This is a patient-safety cornerstone and is **entirely absent** today.
- **Orders management** — doctor orders for Lab/Radiology/Pharmacy/Procedure/Diet flow *out* to those modules and results flow *back*.

### 1.5 Discharge Workflow — multi-disciplinary clearance gate
A patient is **not dischargeable** until parallel clearances complete:
`Doctor clearance → Nursing clearance → Pharmacy clearance (return unused meds, TTO/take-home meds) → Billing clearance (final bill settled / insurance approval / deposit reconciled) → Housekeeping notified`. Then: **Discharge Summary** (diagnosis, course, procedures, meds, follow-up) and follow-up scheduling. Your current discharge is a single form write with no clearance gating.

### 1.6 Edge workflows that define a *real* IPD
- **Death during admission** → death summary, mortuary/body handover, **Death Certificate module** integration, billing finalization, MLC if applicable.
- **LAMA / DAMA** (Left/Discharge Against Medical Advice) → risk consent form, signature, bill settlement, distinct discharge type for analytics.
- **Absconded** → security/admin alert, time of last seen, bill write-off workflow, medico-legal note.
- **Readmission** → link to prior admission; 30-day-readmission flag (a quality KPI and an insurance red-flag).
- **Infection control / Isolation** → source/contact/protective isolation flags, notifiable-disease reporting, PPE/biomedical-waste linkage, cohorting.
- **Critical care** → care-level (Level 1/2/3), ventilator/inotrope flags, ICU scoring (APACHE/SOFA), nurse:patient ratio enforcement, ICU bundles.

---

# DELIVERABLE 2 — Industry Research (Open-Source HIS)

> Licenses/URLs from architectural knowledge as of early 2026 — **verify before relying on them for legal/procurement decisions.**

| System | Tech | License | Database | Repo (verify) | Pros | Cons | Prod-ready | Integration cost |
|---|---|---|---|---|---|---|---|---|
| **OpenMRS** | Java (Spring), REST + FHIR | MPL 2.0 + HD | MySQL/MariaDB | github.com/openmrs/openmrs-core | Mature concept-dictionary clinical data model, FHIR, huge global deployment (esp. low-resource), module ecosystem | Java/OSGi heavy; bedside IPD/billing weak out-of-box; concept model has steep learning curve | High (clinical) | **High** — different DB + stack |
| **Bahmni** | OpenMRS + OpenELIS + Odoo + React | AGPL-3.0 (mixed) | MySQL + Postgres | github.com/Bahmni/bahmni-core | Full HIS: OPD/IPD/ERP/billing/lab/radiology already wired; strong IPD bed mgmt; Indian hospital roots (real AIIMS-class deployments) | Heavyweight multi-app stack; Odoo coupling; ops complexity; AGPL obligations | High | **Very High** — 3 runtimes |
| **GNU Health** | Python (Tryton) | GPL-3.0 | PostgreSQL | github.com/gnuhealth | Strong on public-health, genetics, social medicine; Postgres-native | Tryton framework niche; IPD/billing less hospital-commercial; smaller UI | Medium-High | High |
| **ERPNext Healthcare** | Python (Frappe), JS | GPL-3.0 | MariaDB | github.com/frappe/health | Tight ERP+billing+inventory; rapid customization; good admin UX | Clinical depth shallow; IPD bed mgmt basic; MariaDB | Medium | Medium-High |
| **OpenEMR** | PHP | GPL-3.0 | MySQL/MariaDB | github.com/openemr/openemr | Very mature ambulatory EMR, billing (US-centric), certified | PHP monolith; IPD/bed mgmt weak; US workflow bias | High (OPD) | Medium |
| **Open Hospital (Isf)** | Java (Swing/Spring) | GPL-3.0 | MySQL/MariaDB | github.com/informatici/openhospital | Designed for resource-limited hospitals; ward/admission core | Desktop legacy roots; smaller community; limited tariff engine | Medium | Medium |
| **OpenClinic GA** | Java | GPL-2.0 | MySQL | sourceforge/github (verify) | Lightweight hospital mgmt incl. billing/lab | Dated UI/stack; thin community | Low-Medium | Medium |

**Read-across for you:** Bahmni is the closest *conceptual* blueprint to what you want (real Indian IPD + tariffs + ERP billing). **Borrow its data model ideas** (visit/encounter, bed management, drug order → administration, configurable order sets, payer-based pricing). Do **not** deploy it beside your existing HMS.

---

# DELIVERABLE 3 — Enterprise Module Breakdown

```
IPD
├── Admission Management
│   ├── Pre-Admission / Estimates      ├── Admission Request & Approval
│   ├── Emergency Fast-Track           ├── MLC Registration
│   ├── Deposit & Advance              └── Admission State Machine
├── Bed Management
│   ├── Bed Board (live)               ├── Allocation Engine (gender/isolation/telemetry)
│   ├── Reservation & Blocking         ├── Status Lifecycle (incl. DIRTY/CLEANING)
│   └── Capacity & Occupancy KPIs
├── Ward Management
│   ├── Building → Floor → Ward → Bed hierarchy   ├── Charge Nurse / Staffing
│   └── Department linkage              └── Ward-type policies
├── Transfer Management
│   ├── Ward/Bed/ICU/HDU/NICU transfers ├── Occupancy-segment ledger
│   └── SBAR handover                   └── Tariff re-evaluation on move
├── Nursing Station
│   ├── Worklist by ward/shift          ├── Task & handover (shift change)
│   └── Nurse:patient ratio
├── Clinical Documentation
│   ├── Progress Notes (append-only)    ├── Nursing Notes
│   ├── Consultant Notes                └── Document attachments
├── Daily Rounds
│   ├── Round entries + plan-of-care    └── Consultant visit capture (billable)
├── Vitals Monitoring
│   ├── Time-series vitals              ├── Early-warning score (NEWS2/MEWS)
│   └── Intake/Output, charts
├── Medication Administration (eMAR)
│   ├── Order → schedule → administer   ├── Missed/Held/Refused reasons
│   └── Pharmacy reconciliation
├── ICU / Critical Care
│   ├── Care levels & scoring           ├── Ventilator/inotrope tracking
│   └── ICU bundles & checklists
├── Isolation / Infection Control
│   ├── Isolation type & cohorting      └── Notifiable disease reporting
├── Procedure Management
│   ├── Bedside/ward procedures         └── Consumables & implants
├── Discharge Management
│   ├── Multi-disciplinary clearances   ├── Discharge Summary generator
│   └── TTO meds & follow-up
├── Billing (IPD)
│   ├── Occupancy-segment bed charges   ├── Service charges via Tariff Engine
│   ├── Interim / running bill          ├── Deposit & refund
│   └── Insurance/TPA/Corporate split
├── Housekeeping & Bed Turnover
│   ├── Cleaning tasks                  └── Turnaround-time KPI
├── Reports & Analytics
│   ├── Census, ALOS, occupancy, BOR    ├── Mortality, readmission, infection rate
│   └── Revenue & payer mix
├── Audit Logs (append-only, who/what/when/before/after)
└── Administration (tariff config, ward config, RBAC)
```

---

# DELIVERABLE 4 — Dynamic Pricing & Room Tariff Engine

### 4.1 How Apollo/Medanta/Max/Fortis actually price
Indian corporate hospitals price by **room category** because the room category is a proxy for the patient's willingness/ability to pay. The room you choose sets a **multiplier (or a distinct rate card)** that applies not just to the bed charge but to **almost every service**: doctor visit fees, OT charges, procedures, nursing, sometimes investigations and consumables. Choosing a Deluxe room genuinely makes your knee surgery cost more than the same surgery in General Ward. This is contractual and transparent at admission.

Three coexisting pricing axes:
1. **Bed category** (General → Suite → ICU…) → multiplier / rate card.
2. **Payer** (Cash, Insurance, TPA, Corporate, Govt scheme, Employee) → separate negotiated rate card.
3. **Service** (each item in a charge master) → its own base price.

The price of any line item = `f(ChargeMaster.basePrice, payer's TariffPlan, bed category, service group, service date)`. **Never hardcode the percentages** — they are config rows.

### 4.2 Resolution algorithm (configurable, not hardcoded)

```
Patient → Admission → current BedOccupancy segment → Bed → BedCategory
Admission → PatientTariff (payer plan locked at admission)
Service line (e.g. CBC lab test) arrives:
    base   = ChargeMaster[CBC].basePrice
    rule   = TariffRule WHERE planId = PatientTariff.planId
                          AND (bedCategoryId = segment.bedCategoryId OR NULL)
                          AND (serviceGroup = 'LAB' OR serviceItemId = CBC OR NULL)
                          AND validFrom <= serviceDate <= validTo
             (most-specific rule wins: item > group; category-specific > any)
    price  = applyAdjustment(base, rule)   // PERCENT | FIXED_DELTA | ABSOLUTE_OVERRIDE
```

`applyAdjustment`:
- `PERCENT`: `base * (1 + pct/100)`
- `FIXED_DELTA`: `base + delta`
- `ABSOLUTE_OVERRIDE`: `overrideAmount` (ignores base — used for TPA/CGHS fixed package rates)

### 4.3 Transfer = multi-segment billing (the headline correctness fix)
Bed charges are computed **per occupancy segment**, never as `rate × totalLOS`:

```
Day 1–3  General Ward  → segment A: 3 × GeneralBedRate(plan)
Day 4–6  Private Room  → segment B: 3 × PrivateBedRate(plan)
Final bed charge = Σ segments
```
And because service multipliers are tied to the segment's category, a procedure done on Day 5 is priced at Private-room tariff automatically.

### 4.4 Snapshotting (why a separate `PatientTariff`)
Catalog prices change. A patient admitted in January must be billed at January's rates even if discharged in March. So **lock the plan to the admission** and resolve rules by **service date** against **effective-dated** `TariffRule` rows. `TariffHistory` keeps the immutable trail of every rate change.

### 4.5 Tariff data model (Prisma sketch)
```prisma
model BedCategory {                 // General, Semi-Private, Private, Deluxe, Suite, ICU, HDU, NICU, PICU, Isolation, Burns, VIP
  id String @id @default(cuid())
  organizationId String
  name String
  code String?
  rank Int                          // ordering / escalation level
  defaultBedDayRate Float?          // fallback if no rule
  isCritical Boolean @default(false)
  isActive Boolean @default(true)
  @@unique([organizationId, code])
}

model TariffPlan {                  // a named rate card for a payer
  id String @id @default(cuid())
  organizationId String
  name String                       // "Cash 2026", "Star Health TPA", "CGHS", "TCS Corporate"
  payerType PayerType               // CASH | INSURANCE | TPA | CORPORATE | GOVT | EMPLOYEE
  validFrom DateTime
  validTo DateTime?
  isDefault Boolean @default(false)
  isActive Boolean @default(true)
  rules TariffRule[]
}

model ChargeMaster {               // single source of truth for every billable item
  id String @id @default(cuid())
  organizationId String
  code String
  name String
  serviceGroup ServiceGroup        // BED | NURSING | DOCTOR_VISIT | PROCEDURE | LAB | RADIOLOGY | PHARMACY | CONSUMABLE | OTHER
  uom String?                      // per-day, per-unit, per-test
  basePrice Float
  taxRatePct Float @default(0)
  isActive Boolean @default(true)
  @@unique([organizationId, code])
}

model TariffRule {                 // the configurable adjustment — NO hardcoded %
  id String @id @default(cuid())
  organizationId String
  planId String
  bedCategoryId String?            // null = applies to any category
  serviceGroup ServiceGroup?       // null = any group
  serviceItemId String?            // null = whole group; set = item-specific override (wins)
  adjustmentType AdjustmentType    // PERCENT | FIXED_DELTA | ABSOLUTE_OVERRIDE
  adjustmentValue Float
  validFrom DateTime
  validTo DateTime?
  plan TariffPlan @relation(fields: [planId], references: [id])
  @@index([organizationId, planId, bedCategoryId, serviceGroup])
}

model PatientTariff {              // plan locked to one admission (snapshot)
  id String @id @default(cuid())
  organizationId String
  admissionId String @unique
  planId String
  payerType PayerType
  corporateId String?
  insurancePolicyId String?
  lockedAt DateTime @default(now())
}

model TariffHistory {              // immutable audit of price/rule changes
  id String @id @default(cuid())
  organizationId String
  entity String                    // "ChargeMaster" | "TariffRule"
  entityId String
  before Json
  after Json
  changedById String?
  changedAt DateTime @default(now())
}

enum PayerType { CASH INSURANCE TPA CORPORATE GOVT EMPLOYEE }
enum ServiceGroup { BED NURSING DOCTOR_VISIT PROCEDURE LAB RADIOLOGY PHARMACY CONSUMABLE OTHER }
enum AdjustmentType { PERCENT FIXED_DELTA ABSOLUTE_OVERRIDE }
```
`CorporateTariff` / `InsuranceTariff` are modeled as `TariffPlan` rows with `payerType` + a contract reference, avoiding a parallel table explosion while still supporting payer-specific rules.

---

# DELIVERABLE 5 — Database Architecture (PostgreSQL / Prisma)

### 5.1 Core entities (beyond the tariff tables above)
```prisma
model Ward {                       // EXTEND existing: add building/floor (done), departmentId (done)
  // + bedCategoryDefaultId, gender policy, careLevel, isActive, soft-delete
}

model Bed {
  // + bedCategoryId (REQUIRED for pricing), status enum (see below),
  //   features Json (oxygen, telemetry, ventilator), genderLock, isActive
}

enum BedStatus { AVAILABLE OCCUPIED RESERVED BLOCKED DIRTY CLEANING INSPECTED MAINTENANCE OUT_OF_SERVICE }

model Admission {
  // KEEP patient/diagnosis fields; ADD:
  // admissionNo (per-org sequence), status AdmissionStatus (enum, state machine),
  // admissionType, admissionSource, mlcId?, isCritical, careLevel,
  // primaryConsultantId, currentBedId (denormalized convenience),
  // payerType, deletedAt (soft delete)
}

enum AdmissionStatus { REQUESTED BED_RESERVED ADMITTED IN_TREATMENT DISCHARGE_INITIATED CLEARANCES_PENDING BILL_FINALIZED DISCHARGED LAMA ABSCONDED EXPIRED TRANSFERRED_OUT }

model BedOccupancy {              // ★ the segment ledger — replaces single bedId billing
  id String @id @default(cuid())
  organizationId String
  admissionId String
  bedId String
  bedCategoryId String            // snapshot the category at time of occupancy
  startAt DateTime
  endAt DateTime?                 // null = current
  reason String?                  // ADMIT | TRANSFER | ESCALATION | DE_ESCALATION
  @@index([organizationId, admissionId])
  @@index([bedId, startAt])
}

model AdmissionTransfer {
  id String @id @default(cuid())
  admissionId String
  fromBedId String? fromWardId String?
  toBedId String   toWardId String
  reason String
  orderedById String?
  handoverNote String?            // SBAR
  transferredAt DateTime @default(now())
}

model ClinicalNote {              // ★ out of JSON, into a table
  id String @id @default(cuid())
  organizationId String
  admissionId String
  noteType NoteType               // PROGRESS | NURSING | CONSULTANT | PROCEDURE | TRANSFER | DISCHARGE
  body String
  authorId String
  authoredAt DateTime @default(now())
  // append-only: no update path; corrections via addendum row linking parentId
  parentId String?
  @@index([organizationId, admissionId, authoredAt])
}

model VitalsRecord {
  id String @id @default(cuid())
  admissionId String
  recordedAt DateTime
  bp String? hr Int? rr Int? spo2 Float? tempC Float? painScore Int? gcs Int?
  intakeMl Int? outputMl Int? bloodSugar Float?
  newsScore Int?                  // computed early-warning
  recordedById String
  @@index([admissionId, recordedAt])
}

model MedicationAdministration {  // ★ eMAR — links Pharmacy prescription to bedside admin
  id String @id @default(cuid())
  admissionId String
  prescriptionItemId String       // FK to existing Pharmacy module
  scheduledAt DateTime
  administeredAt DateTime?
  status MARStatus                // GIVEN | MISSED | HELD | REFUSED
  reason String?
  nurseId String?
  @@index([admissionId, scheduledAt])
}
enum MARStatus { GIVEN MISSED HELD REFUSED }

model ProcedureRecord { /* admissionId, chargeItemId, performedBy, consumables Json, performedAt */ }

model DischargeSummary {          // structured, not free-form on Admission
  id String @id @default(cuid())
  admissionId String @unique
  finalDiagnosis String
  courseInHospital String?
  proceduresDone String?
  conditionAtDischarge String
  medsOnDischarge Json?
  followUpInstructions String?
  followUpDate DateTime?
  dischargeType DischargeType     // NORMAL | LAMA | ABSCONDED | EXPIRED | TRANSFER_OUT
  preparedById String? approvedById String?
}
enum DischargeType { NORMAL LAMA ABSCONDED EXPIRED TRANSFER_OUT }

model DischargeClearance {        // ★ the multi-disciplinary gate
  id String @id @default(cuid())
  admissionId String
  type ClearanceType              // DOCTOR | NURSING | PHARMACY | BILLING | HOUSEKEEPING
  status ClearanceStatus          // PENDING | CLEARED | BLOCKED
  clearedById String? clearedAt DateTime? remark String?
  @@unique([admissionId, type])
}
enum ClearanceType { DOCTOR NURSING PHARMACY BILLING HOUSEKEEPING }
enum ClearanceStatus { PENDING CLEARED BLOCKED }

model HousekeepingTask {          // bed turnover
  id String @id @default(cuid())
  bedId String admissionId String?
  type String                     // CLEANING | FUMIGATION | INSPECTION
  status String                   // OPEN | IN_PROGRESS | DONE
  assignedToId String?
  openedAt DateTime @default(now()) closedAt DateTime?
}

model IpdCharge {                 // ★ charges as rows, not JSON
  id String @id @default(cuid())
  organizationId String
  admissionId String
  chargeItemId String?            // FK ChargeMaster (null for ad-hoc)
  description String
  serviceGroup ServiceGroup
  unitPrice Float quantity Float @default(1)
  resolvedFrom Json?              // {planId, bedCategoryId, ruleId} for audit
  serviceDate DateTime
  sourceModule String?            // LAB | RADIOLOGY | PHARMACY | IPD | PROCEDURE
  sourceRef String?               // id in that module (idempotency)
  createdAt DateTime @default(now())
  @@index([organizationId, admissionId])
  @@unique([sourceModule, sourceRef])   // prevents double-posting from Lab/Pharmacy
}

model IpdBill {                   // header; lines = IpdCharge
  id String @id @default(cuid())
  admissionId String @unique
  status String                   // DRAFT | INTERIM | FINAL | SETTLED
  subtotal Float taxTotal Float discountTotal Float depositTotal Float
  payableTotal Float
  finalizedAt DateTime?
}
```

### 5.2 Cross-cutting strategy
- **Multi-tenant**: every table carries `organizationId`; every query is org-scoped (you already do this) — enforce with Prisma middleware, not per-handler discipline.
- **Soft delete**: `deletedAt DateTime?` on clinical/financial tables; never hard-delete an admission, note, vitals, or charge (medico-legal retention).
- **Audit**: a single `AuditLog` (you already have one) extended to capture `before`/`after` JSON for every mutating IPD action; append-only.
- **Indexes**: composite `(organizationId, admissionId, …time)` on all time-series; `(bedId, startAt)` on occupancy; unique `(sourceModule, sourceRef)` on charges for idempotency.
- **Sequences**: per-org human IDs (`ADM-2026-000123`) via a counter table, not `cuid()` for user-facing numbers.

---

# DELIVERABLE 6 — API Architecture

Move off the single `?resource=` switch toward **resourceful, versioned routes** while keeping the controller pattern you like. Each gets payload + RBAC.

| Action | Method & Route | RBAC roles | Key validation |
|---|---|---|---|
| Admit patient | `POST /api/v2/ipd/admissions` | reception, doctor, ipd_clerk | patient exists, payer plan resolvable, bed available |
| Assign/Reserve bed | `POST /api/v2/ipd/admissions/:id/bed` | ipd_clerk, charge_nurse | bed status AVAILABLE/RESERVED, gender/category match |
| Transfer | `POST /api/v2/ipd/admissions/:id/transfer` | doctor, charge_nurse | closes occupancy segment, opens new, writes transfer note |
| Record vitals | `POST /api/v2/ipd/admissions/:id/vitals` | nurse, doctor | ranges sane; computes NEWS |
| Clinical note | `POST /api/v2/ipd/admissions/:id/notes` | doctor, nurse | append-only; author = token user |
| eMAR administer | `POST /api/v2/ipd/admissions/:id/mar` | nurse | links valid prescription item; status reason if not GIVEN |
| Add charge | `POST /api/v2/ipd/admissions/:id/charges` | billing, system (from Lab/Pharmacy) | idempotent on (sourceModule, sourceRef) |
| Tariff preview | `GET /api/v2/ipd/admissions/:id/tariff/preview?itemCode=` | billing, doctor | returns resolved price + rule trail |
| Running bill | `GET /api/v2/ipd/admissions/:id/bill` | billing, reception | recomputes segments + charges |
| Initiate discharge | `POST /api/v2/ipd/admissions/:id/discharge/initiate` | doctor | creates clearance rows |
| Clear (per dept) | `POST /api/v2/ipd/admissions/:id/clearances/:type` | role per type | all CLEARED gates final discharge |
| Finalize discharge | `POST /api/v2/ipd/admissions/:id/discharge` | doctor + billing | blocked unless clearances CLEARED & bill SETTLED/approved |
| Bed board | `GET /api/v2/ipd/beds/board?building=&floor=&status=` | all IPD | live occupancy |

**Standard envelope** (you already use `{success, data, meta}`): keep it. Add `traceId`, structured error codes (`IPD_BED_UNAVAILABLE`, `IPD_DISCHARGE_BLOCKED_CLEARANCE`), and Zod validation on every payload (you already use Zod — extend it).

**RBAC**: introduce IPD-specific roles — `ipd_clerk`, `charge_nurse`, `staff_nurse`, `housekeeping`, `billing_ipd` — layered on your existing RBAC, with field-level rules (a nurse can write vitals/notes/MAR but cannot finalize a bill).

---

# DELIVERABLE 7 — Frontend Architecture

```
frontend/src/components/inpatient/
├── InpatientModule.jsx            // shell + tab router only (slim it down)
├── tabs/
│   ├── DashboardTab.jsx
│   ├── BedBoardTab.jsx            // ← rename/upgrade "Wards & Beds" bed map
│   ├── WardDashboardTab.jsx
│   ├── AdmissionsTab.jsx
│   ├── NewAdmissionTab.jsx
│   ├── NursingStationTab.jsx      // ← NEW: worklist, vitals, MAR, notes by ward/shift
│   ├── TransfersTab.jsx           // ← Movement, fixed to read AdmissionTransfer table
│   ├── DischargeTab.jsx           // ← with clearance checklist
│   ├── BillingTab.jsx             // ← segment-aware running bill
│   └── PatientHistoryTab.jsx
├── dialogs/
│   ├── AdmitDialog.jsx  TransferDialog.jsx  DischargeDialog.jsx
│   ├── AddChargeDialog.jsx  VitalsDialog.jsx  MARDialog.jsx
│   └── ClinicalNoteDialog.jsx
├── components/
│   ├── BedCell.jsx                // single bed tile (status colors)
│   ├── BedLegend.jsx  OccupancyBar.jsx  ClearanceChecklist.jsx
│   ├── VitalsChart.jsx  TariffPreview.jsx  PatientStrip.jsx
└── hooks/
    ├── useWards.js  useAdmissions.js  useBedBoard.js
    ├── useTariffPreview.js  useVitals.js
```

Principles:
- **Slim the 1,821-line monolith** into tab + dialog + presentational components (your current file mixes data fetching, print HTML generation, and 7 tabs in one render).
- **Shared, reusable** `BedCell`, `PatientStrip`, `TariffPreview` reused on web + mobile.
- **Bed Board** as the flagship screen: building → floor → ward → category-colored bed grid, drag-to-assign, click-to-admit, live status, filters (you've already started building→floor grouping — extend it to a true board with category colors and occupancy stats).
- **Server state** via a query hook layer (React Query-style) for cache + revalidation instead of manual `fetchAll()` everywhere.
- **Print** logic (admission slip / discharge summary / final bill) extracted to a `printTemplates/` util, not inline in the component.

---

# DELIVERABLE 8 — Mobile Workflow (React + Capacitor)

| Role | Primary mobile screens | Key actions |
|---|---|---|
| **Doctor** | My inpatients, round list, patient timeline | Write progress note, place orders, initiate discharge, view vitals chart |
| **Nurse** | Shift worklist by ward/bed, due-meds list | **Bedside vitals entry**, **eMAR administer (scan band → confirm 5 rights)**, nursing notes, escalate (NEWS alert) |
| **Ward Clerk** | Bed board, admissions queue | Reserve/assign bed, register admission, transfers |
| **Billing Staff** | Pending bills, deposits | Add charge, collect deposit, view running bill, clearance |
| **Housekeeping** | Dirty-bed queue | Accept task, mark cleaning → done (drives bed turnover) |

Mobile-specific: barcode/QR **patient wristband scanning** (you already use a barcode provider in Pharmacy — reuse it), offline-tolerant vitals capture with sync, push notifications for NEWS escalations and STAT orders.

---

# DELIVERABLE 9 — Compliance & Safety (NABH-aligned)

- **Audit trail** — every clinical/financial mutation logged append-only with who/what/when/before/after; clinical notes never edited, only addended.
- **Patient safety** — eMAR 5-rights, allergy checks at order time (pull from patient record), NEWS/MEWS early-warning, fall/pressure-ulcer risk flags.
- **Bed traceability** — full occupancy ledger: which patient was in which bed when, including the DIRTY→CLEANING cycle (infection-source tracing).
- **Infection control** — isolation flags, notifiable disease reporting, biomedical-waste linkage, cohorting reports.
- **Medication safety** — high-alert drug flags, look-alike/sound-alike checks, administration reconciliation against pharmacy dispensing.
- **Transfer documentation** — SBAR handover mandatory on care-level changes.
- **Medico-legal (MLC)** — MLC registration at admission, police-intimation tracking, restricted access, immutable records, link to your existing patient `mlcNumber` field.
- **Consent** — admission consent, high-risk consent, LAMA/DAMA consent capture.
- **Data retention** — soft delete + retention policy aligned to medico-legal norms (often years); no destructive deletes on clinical data.

---

# DELIVERABLE 10 — Deep Gap Analysis (current code, ranked)

| # | Severity | Finding (grounded in your code) | Effort |
|---|---|---|---|
| 1 | **CRITICAL** | **Bed-day billing is `rate × totalDays`** (`generate-bill`, `billing` handlers). Ignores transfers/category changes → systematically **wrong revenue** for any transferred patient. Needs `BedOccupancy` segment ledger. | L (3–4 wk) |
| 2 | **CRITICAL** | **No tariff engine.** Daily rate is typed by hand per admission; services don't inherit room pricing. No charge master, no payer plans. This is the core revenue gap vs Apollo/Medanta. | XL (6–8 wk) |
| 3 | **CRITICAL** | **Clinical notes, billing, charges stored as JSON strings inside `Admission`.** Not queryable, not auditable, race-prone (read-modify-write of a JSON blob), no per-author integrity. eMAR/vitals impossible on this model. | L (4 wk) to migrate |
| 4 | **HIGH** | **Movement tab is dead.** `transfer` handler moves the bed but **never writes the `WARD TRANSFER NOTE`** the Movement tab parses → transfers never show. Confirmed disconnect. | S (3–5 d) interim / folded into #1 |
| 5 | **HIGH** | **No multi-disciplinary discharge clearance.** Discharge is a single write; no doctor/nursing/pharmacy/billing gate → patients can be "discharged" with unpaid bills / unreturned meds. | M (2 wk) |
| 6 | **HIGH** | **No eMAR / vitals / orders.** The entire nursing-station clinical core is absent. | XL (6–8 wk) |
| 7 | **HIGH** | **No bed turnover / housekeeping.** Discharge sets bed straight to `available`, skipping DIRTY→CLEANING → fails NABH infection-control traceability. | M (2 wk) |
| 8 | **HIGH** | **No admission state machine.** Status is free-text (`admitted/discharged/transferred`); no LAMA/absconded/expired/reserved; no guarded transitions. | M (2 wk) |
| 9 | **MEDIUM** | **Two divergent note paths** (`note` parses JSON string; `clinical-note` assumes array) → data written by one can be misread by the other. | S (folded into #3) |
| 10 | **MEDIUM** | **Charges not idempotent.** Lab/Pharmacy posting a charge twice would double-bill; no `(sourceModule, sourceRef)` guard. | S (3 d) |
| 11 | **MEDIUM** | **Patient History "Bill" column hardcoded `—`.** Cosmetic but visible. | XS (½ d) |
| 12 | **MEDIUM** | **Auto-created beds are all `Standard`** → new Ventilator/Burn/OT bed types only apply to manually-added beds; no `bedCategoryId` at all (blocks pricing). | S (folded into #2 schema) |
| 13 | **MEDIUM** | **Resource-router maintainability.** One `?resource=` switch across GET/POST/PATCH/DELETE will not scale to 20+ IPD operations; hard to apply per-action RBAC. | M (refactor, 2 wk) |
| 14 | **LOW** | **No soft delete** on admissions/notes/charges → medico-legal risk on any delete. | S |
| 15 | **LOW** | **Print HTML inline** in the React component → hard to maintain/brand. | S |
| 16 | **LOW** | **No per-org human-readable admission numbers** (uses internal ids). | S |

**Multi-tenant risk note:** the org-scoping discipline is currently per-handler. As IPD grows to ~20 tables, enforce tenancy via **Prisma middleware** so no future query can forget `organizationId`.

---

# DELIVERABLE 11 — Integration Strategy

You already own the modules IPD must consume — **the win is reuse, not rebuild**:

| Existing module | IPD integration | Data flow |
|---|---|---|
| **Patients** | Admission references patient; reuse demographics, allergies, MLC number | read |
| **Consultations** | "Advise admission" → creates admission request | OPD → IPD |
| **Laboratory** | Inpatient orders → results back; **lab charges auto-post to IPD bill** at room tariff | bidirectional; charge via `IpdCharge(sourceModule='LAB')` |
| **Radiology** | Same pattern as Lab | bidirectional |
| **Pharmacy** | Ward indents/prescriptions → **eMAR administration** + auto-charge; returns reconciliation at discharge | bidirectional |
| **Billing/Payments** | IPD bill is a bill *type*; deposits, refunds, insurance/TPA via existing payment rails | IPD → Billing |
| **Blood Bank** | Transfusion orders + charges | bidirectional |
| **Notifications/WhatsApp** | Admission/discharge/critical alerts, bill-ready, NEWS escalation | IPD → Notify |
| **Doctor Accountability** | Consultant visit charges feed commission/visit tracking | IPD → DA |

**Shared services to extract**: a `ChargeMaster` + `TariffEngine` service usable by OPD billing too; a `ledger/charge-posting` service with idempotency; the barcode provider (already in Pharmacy) for wristbands.

**Migration plan (data):** write the existing `Admission.clinicalNotes` / `additionalCharges` JSON into the new `ClinicalNote` / `IpdCharge` tables with a one-time backfill script; keep the JSON columns read-only for one release as a fallback, then drop.

**Performance:** time-series tables (vitals, MAR, charges) will dominate row counts — partition/index by `(organizationId, admissionId, time)`; the bed board should be a single indexed query, not N+1 per ward.

---

# DELIVERABLE 12 — Final Recommendation

### 1. Best open-source option
**Bahmni** conceptually (real Indian IPD + tariffs + ERP billing), **OpenMRS** for the clinical data-model ideas. But **for adoption: none** — running either beside your existing Lab/Radiology/Pharmacy/Billing creates a permanent dual-source-of-truth problem.

### 2. Best enterprise architecture
**Native build on your current stack** (Node/Express/Prisma/Postgres/React/Capacitor), re-implementing the proven concepts: occupancy-segment ledger, charge master, effective-dated payer tariffs, append-only clinical tables, eMAR, clearance-gated discharge, NABH audit.

### 3. Build vs Buy vs Integrate
- **Buy**: rejected — commercial HIS replacement throws away the working modules you've built.
- **Integrate (Bahmni/OpenMRS)**: rejected — integration cost is *higher* than build given your existing billing/lab/pharmacy ownership and the dual-DB sync burden.
- **Build**: ✅ recommended — you already have 80% of the surrounding ecosystem; IPD is the missing clinical+revenue core, and it must share your billing/tariff/patient data anyway.

### 4. Team size
~**8–10**: 1 solution architect, 3–4 backend, 2–3 frontend, 1 mobile, 1 QA/automation, 1 clinical/product analyst (NABH + workflow SME), 0.5 DevOps. A clinical SME is **non-negotiable** — IPD correctness is domain-driven.

### 5. Timeline (phased)
- **Phase 0 (2–3 wk)** — schema + tariff data model + Prisma middleware tenancy; migrate JSON → tables.
- **Phase 1 (6–8 wk)** — Tariff Engine + occupancy-segment billing + charge master + idempotent charge posting (fixes gaps #1, #2, #3, #10).
- **Phase 2 (6–8 wk)** — Nursing Station: vitals, clinical notes, eMAR, orders integration.
- **Phase 3 (4 wk)** — Discharge clearances, bed turnover/housekeeping, state machine, LAMA/death/absconded.
- **Phase 4 (4 wk)** — Bed board UX, mobile (nurse/doctor/housekeeping), reports/analytics.
- **Phase 5 (3–4 wk)** — NABH audit, compliance, hardening, UAT.
- **Enterprise MVP ≈ 4–5 months; world-class ≈ 9–12 months.**

### 6. Risks
- Migrating live JSON clinical/billing data without loss (mitigate: dual-read, backfill, fallback window).
- Tariff misconfiguration → revenue leakage (mitigate: tariff preview API + approval workflow + `TariffHistory`).
- eMAR adoption/clinical safety (mitigate: clinical SME, phased ward rollout, training).
- Scope creep — IPD is a platform, not a feature (mitigate: strict phase gates).

### 7. Production-readiness checklist
☐ Occupancy-segment billing verified against manual transfer cases
☐ Tariff engine: cash + 1 TPA + 1 corporate plan configured & previewed
☐ Charge posting idempotent (replay test)
☐ Clinical tables append-only + audit before/after
☐ Discharge blocked until clearances + bill settled
☐ Bed turnover cycle enforced (no direct occupied→available)
☐ RBAC per action incl. nurse/billing field limits
☐ Multi-tenant enforced via middleware (no unscoped query)
☐ Soft delete + retention on all clinical/financial tables
☐ NABH audit export; MLC restricted access
☐ Load test: bed board + running bill under realistic census
☐ Mobile offline vitals/MAR sync tested

### 8. Recommended roadmap (order of attack)
1. **Foundation & revenue correctness first** (Phases 0–1) — this is where the money is and where today's code is most wrong.
2. **Clinical core** (Phase 2) — nursing station unlocks the actual "inpatient" value.
3. **Safety & flow** (Phase 3).
4. **Experience & insight** (Phases 4–5).

---

## Appendix A — Immediate quick wins (decoupled from the big build)
These are small and can ship now without waiting for the platform rebuild:
- Fix Movement tab: have the `transfer` action write a transfer note (gap #4) — ~half day.
- Idempotency guard on charges (gap #10) — ~½ day once charges move to rows.
- Patient History bill column (gap #11) — ~½ day.
- Add `bedCategoryId` to Bed + carry bed type into auto-created beds (gap #12) — ~1 day.

## Appendix B — What "world-class vs current" comes down to, in one line
Today you can **put a patient in a bed and type a bill**. A world-class IPD **knows where every patient was every hour, prices every service by who's paying and which room they're in, proves every drug was given safely, and won't let them leave until clinical, pharmacy and finance all sign off** — all of it auditable for NABH. The gap is that second sentence.
