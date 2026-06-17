# Enterprise Birth Registration & Birth Certificate Management System — Architecture & Research

> Solution-architect blueprint for adding a **CRS / RBD Act 1969 (as amended 2023)-compliant
> Birth Registration & Birth Certificate module** to the existing multi-tenant HMS.
> Scope target: AIIMS / Apollo / Medanta / Max / Fortis / govt medical colleges / district
> & women-and-child hospitals / maternity centres acting as **notifiers/registrars** into
> the Civil Registration System (CRS).
> Last updated: 2026-06-11.

---

## 0. Executive summary (read this first)

**Recommendation: BUILD a native module inside the HMS**, structured as **two linked but
distinct domains** that most teams wrongly collapse into one:

1. **The clinical birth event** (mother → pregnancy/ANC → delivery → newborn) — owned by
   the hospital, the medical truth, captured in the labour room. This is *yours*.
2. **The legal civil-registration record** (birth report → verification → registrar approval
   → registered birth → certificate) — a **government-owned legal instrument**. The hospital
   is only the **notifier/informant** under the **RBD Act 1969 (Amendment 2023)**; the
   **Registrar of Births & Deaths** (municipal/panchayat) issues the legally valid certificate
   via the central **CRS portal** (`dc.crsorgi.gov.in`), which since **1 Oct 2023 is the only
   official channel** for digital birth certificates.

**The single most important architectural decision:** your HMS does **not** mint the legally
valid birth certificate — it **captures the birth event, generates the statutory Birth Report
(Form 1), submits it to CRS within the 21-day window, tracks the registration, and issues a
hospital "Birth Record / certificate of birth" + a copy of the CRS certificate once returned.**
Modelling the certificate as a hospital-issued legal document (like a naive death-cert clone)
is the classic mistake — it creates a document with no legal standing and a compliance gap.
We model the **government submission lifecycle as a first-class state machine.**

**You already own ~70% of the substrate.** Patients (mother + newborn become patients),
your existing **Death Certificate module** is the closest analog (certificate numbering,
certifier/issuance tracking, snapshotted demographics — reuse its exact pattern), plus
multi-tenancy, RBAC, Billing, Notifications/WhatsApp, Patient Portal, Mobile, Audit scaffold.

**Effort:** ~3.5–5 months for a senior squad of 3–4 to NABH/CRS-auditable production; MVP
(mother→delivery→newborn→Form 1 generation + hospital birth record) in ~7–9 weeks.

**The four invariants the whole design enforces:**
- **Mother↔Baby unbreakable link** (medico-legal; the #1 maternity-safety control — no
  newborn exists without a verified mother link; twins/multiples explicitly mapped).
- **21-day statutory clock** — every birth event starts a countdown to CRS reporting; the
  system nags and escalates before it lapses (penalty + delayed-registration path after).
- **Legal vs clinical separation** — clinical data is editable by clinicians; once a birth is
  *registered* (CRS number issued) the legal record is immutable and only changes via the
  formal **Correction / Cancellation / Reissue** workflows with audit.
- **Full auditability** — every field change, approval, print, correction is traceable
  (legal record, retained per statute).

---

# Deliverable 1 — Birth registration workflow (clinical)

```
 MOTHER / PREGNANCY              DELIVERY (Labour Room)            NEWBORN
 ┌────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
 │ Mother register    │         │ Admission → Labour   │         │ Newborn register      │
 │ (= Patient)        │  ANC    │ Room registration    │ birth   │ Temp Newborn ID       │
 │ ANC registration   ├────────►│ Delivery details     ├────────►│ Mother-Baby LINK      │
 │ Pregnancy tracking │ visits  │ Delivery type        │ event   │ (twin/multiple map)   │
 │ High-risk flag     │         │ Doctor + Nurse assign│         │ Weight/APGAR/length   │
 │ Delivery plan/EDD  │         │ Outcome (live/still) │         │ Initial assessment    │
 └────────────────────┘         └──────────┬───────────┘         └──────────┬───────────┘
                                            │                                │
                                            ▼                                ▼
                                   BirthEvent record  ──────────────►  starts 21-day CRS clock
                                   (date/time/place/order/method/
                                    gender/gestation/weight…)
```

### 1.1 Pregnancy & mother registration
- **Mother registration** → create/lookup a `Patient` (mother), link an **ANC episode**.
  Reuse `PatientLookup`/`RegisterPatientForm`; mother is a full patient (allergies, blood
  group, history all reused).
- **ANC registration** (`AntenatalCare`): LMP, **EDD** (Naegele), gravida/para, blood group,
  Rh (anti-D tracking), height/weight/BMI baseline, registered week.
- **Pregnancy tracking**: ANC visit timeline (BP, weight, fundal height, fetal HR, urine
  albumin/sugar, Hb, USG findings), TT/Td immunisation, IFA compliance — reuse Consultations
  + Laboratory + Radiology for investigations.
- **High-risk pregnancy flagging**: rule-driven (age <18/>35, prior C-section, PIH/eclampsia,
  GDM, anaemia <7, placenta praevia, multiple gestation, bad obstetric history) → `riskLevel`
  + alerts; feeds delivery planning + NICU pre-alert.
- **Delivery planning**: planned mode (vaginal/elective LSCS), planned facility, referral in/out.

### 1.2 Delivery workflow
- **Admission** → IPD admission (reuse Inpatient/Ward/Bed); **Labour Room registration**
  (`LabourAdmission`): onset, membrane status, partograph start, examining doctor.
- **Delivery details** (`Delivery`): onset (spontaneous/induced), augmentation, stages
  duration, liquor, episiotomy, blood loss, placenta/cord, complications (PPH, shoulder
  dystocia), anaesthesia.
- **Delivery type** (`deliveryType`): `normal | assisted_forceps | assisted_vacuum |
  cesarean_elective | cesarean_emergency | vbac | multiple | still_birth | mtp | home_brought_in`.
- **Doctor & Nurse assignment**: attending obstetrician, conducting doctor/midwife, paediatric/
  NICU on call, anaesthetist (LSCS) — all `User` FKs (feeds Doctor Accountability).
- **Outcome**: per delivery → one or more newborn outcomes (live birth / **still birth** /
  early neonatal death) — a delivery can yield **multiple** newborns (twins/triplets).

**Delivery types — handling:**
| Type | Special handling |
|---|---|
| Normal / Assisted | standard newborn flow |
| Cesarean (elective/emergency) | OT linkage, anaesthetist, theatre notes |
| **Multiple birth** | ONE `Delivery` → N `Newborn` rows, each its own birth order + time; twin/triplet map |
| **Still birth** | `Newborn.outcome = still_birth`; **reported to CRS as still birth** (separate statutory category), no live-birth certificate, MCCD-stillbirth where applicable; sensitive UX (no "congratulations" notifications) |

### 1.3 Newborn registration
- **Newborn registration** (`Newborn`): created **only** from a `Delivery` (enforces mother
  link). Each baby = a row; multiple birth = multiple rows sharing `deliveryId`.
- **Temporary Newborn ID** — auto, before naming: `BB/of <MotherName>/<MRN>/<seq>` + wristband
  barcode (reuse `BarcodeScanner.jsx`); becomes the **mother-baby identity band** pair.
- **Mother-Baby linking** — hard FK `Newborn.motherId` + `deliveryId`; **two-band check**
  (mother band ↔ baby band) recorded — medico-legal anti-swap control.
- **Twin/multiple registration** — `birthOrder` (1,2,3…), `plurality` (single/twin/triplet…),
  `zygosity?`; all babies cross-linked via shared `deliveryId` + a `siblingGroupId`.
- **Birth weight**, **APGAR** (1/5/10 min), **length**, **head circumference**, gestational
  age (Ballard/by-dates), resuscitation needed, NICU admission, congenital anomalies, feeding,
  Vitamin K / BCG / OPV-0 / Hep-B birth dose, newborn screening sample.
- **Initial assessment** — paediatric exam, reflexes; abnormal → NICU (reuse IPD).

### 1.4 Birth event recording (the statutory core)
`BirthEvent` captures every field the **CRS Form 1 (Birth Report)** legally needs:
date of birth, **time of birth**, place of birth (`hospital/institution | home | other` +
hospital details), **birth order**, delivery method, **gender** (`male|female|transgender`
per CRS), gestational age, birth weight, length, head circumference, plus the statutory
context (mother's residence town/village — *may differ from place of birth*, mother's age at
this birth, number of children born alive to mother including this, father/mother education
& occupation, religion, mother's Aadhaar (hashed) for the 2023-amendment national-DB linkage).
**This record starts the 21-day clock.**

---

# Deliverable 2 — Birth certificate lifecycle

> Reframed correctly: the hospital runs an **internal approval chain**, **submits Form 1 to
> CRS**, and tracks the **government registration**; the *legally valid* certificate is the
> CRS-issued digital certificate. The hospital additionally issues an internal **Birth
> Record / Certificate of Birth** (useful immediately, e.g. for discharge) clearly marked
> "for hospital purposes — statutory certificate issued by Registrar via CRS."

```
BirthEvent (clinical, complete)
      │
      ▼
[Birth Registration draft]  Form 1 assembled from clinical + informant data
      │
      ▼
[Verification]  records clerk checks completeness/consistency (no blank fields per CRS rule)
      │
      ▼
[Medical Officer Approval]  RMO/medical officer attests medical facts (weight, gestation, type)
      │
      ▼
[Registrar Approval]  hospital registrar/authorised notifier signs the statutory report
      │
      ▼
[CRS Government Submission]  ──► see Deliverable 4 (state machine: queued→submitted→ack→registered)
      │                          returns CRS Registration Number + date
      ▼
[Certificate Generation]  digital PDF (hospital birth record) + store CRS certificate copy
      │
      ▼
[Digital Signature]  DSC (Class 3) / Aadhaar eSign on the hospital PDF; CRS cert carries its own
      │
      ▼
[Certificate Printing / Download]  parent portal + counter; QR for verification
      │
      ├─ [Reprint]              same content, watermark "REPRINT", logged
      ├─ [Duplicate Copy]       certified duplicate, reason + requester, logged, fee
      ├─ [Correction]           name/spelling/date fix → new revision + CRS correction submission
      ├─ [Cancellation]         erroneous/duplicate registration → cancel + audit + CRS intimation
      └─ [Reissue]              after correction/legal order → new version, supersedes prior, history kept
```

**Key rules:**
- **Name-not-yet-decided** is normal — India allows registering a birth and adding the
  **child's name later** (within statutory window) without re-registration. So
  `BirthCertificate` supports a **name-addition** event distinct from a correction.
- **Status machine** on the registration: `draft → verified → mo_approved → registrar_approved
  → submitted_to_crs → registered → certificate_issued` (+ branches `correction_pending`,
  `cancelled`, `reissued`). State transitions are gated by RBAC + write the audit trail.
- Once `registered`, clinical edits are **frozen** for the legal fields — changes only via
  Correction/Reissue.

---

# Deliverable 3 — Mother & child relationship management

```
                ┌──────────── Pregnancy ────────────┐
   Mother (Patient) 1───* Pregnancy 1───* Delivery 1───* Newborn (Patient, optional)
        │                                                   │
        │  Father (Person, may be Patient or external)      │
        │  Guardian (Person)                                │
        └──────────────── FamilyRelationship ◄─────────────┘  (mother/father/guardian/sibling)
                                   │
                         siblingGroupId links twins/triplets
```

- **Mother–Baby link**: `Newborn.motherId` (mandatory FK) + `deliveryId`; band-match record.
- **Father information**: name, age, education, occupation, Aadhaar(hashed), nationality —
  stored on the `BirthEvent`/`FamilyRelationship`; father is **optional** (single-mother,
  unknown father supported per CRS — not a hard requirement, never block registration on it).
- **Guardian information**: where parents absent/deceased — legal guardian with relationship
  + ID; drives who can collect/portal-access the certificate.
- **Family information**: permanent address, mother's usual residence (separate field, CRS
  requires it), religion, parents' marital context (captured neutrally, never gating).
- **Multiple children / twins**: shared `deliveryId` + `siblingGroupId`, distinct `birthOrder`
  & birth time; each gets its own registration + certificate but cross-referenced.
- **Adoption cases**: handled as a **post-registration legal event**, NOT at birth — original
  birth record preserved; an `AdoptionLink`/correction records the legal adoption order
  (court order ref), and a **new/amended certificate** may be issued under amended particulars
  while the original is sealed (audit-only access). Model adoption as a correction-class event
  with elevated authorisation + sealed original.
- **Surrogacy cases**: under the Surrogacy (Regulation) Act 2021 — intended parents recorded
  per the certificate of parentage / court order; `parentageBasis = surrogacy` with document
  refs; surrogate (birth mother) recorded clinically but **intended parents** on the legal
  certificate per the order. Elevated authorisation + document verification required.

These edge cases are exactly why parentage is a **typed, evidence-backed relationship**, not
just `fatherName`/`motherName` strings.

---

# Deliverable 4 — Government registration integration (CRS)

**The regulatory reality (India):**
- **RBD Act 1969, amended by Act 20 of 2023** (in force ~Oct 2023): births must be **registered
  within 21 days** of occurrence; **medical officers in hospitals are obligated reporters**;
  Chief Registrars/Registrars must share data into a **national + state database** (RGI);
  digital birth certificate becomes a single document usable for admission, marriage, govt
  jobs, Aadhaar, etc. Penalty for non-/false reporting raised (up to ₹1,000; section 23 for
  false info).
- **CRS portal** (`dc.crsorgi.gov.in`, C-DAC/RGI) is, since **1 Oct 2023, the only official
  channel** for digital birth/death certificates; rolling state/UT onboarding.
- Hospital's legal role = **notifier/informant** submitting **Form 1 (Birth Report)**;
  the **local Registrar** registers and issues the certificate.

**Integration architecture (design for reality — there is no open public hospital-push API
universally available yet):** build an **adapter layer** with pluggable submission modes so
each tenant/state is configured, not hard-coded:

| Mode | When | How |
|---|---|---|
| **CRS API push** (preferred) | State/integrator exposes an API (APISetu-style) | `GovernmentSubmission` adapter posts Form 1 JSON, polls/receives ack + registration no. |
| **Bulk file export** | State accepts structured upload | Generate CRS-format file (XML/CSV/JSON) for portal/SFTP upload; import the returned registration nos. |
| **Assisted/manual** (fallback) | API not yet live for that state | System produces a **print-ready Form 1** + a worklist; clerk enters on CRS portal, then records the CRS registration number back into HMS (closes the loop, keeps traceability). |

**Data exchange / API requirements:**
- Outbound: Form 1 dataset (child, mother, father, informant, place, statutory particulars),
  hospital notifier credentials, idempotency key (the `BirthEvent` id) to prevent double-submit.
- Inbound: acknowledgement id, **CRS registration number**, registration date, status,
  certificate document (PDF/URL), error/clarification requests.
- **Registration numbers:** store CRS **registration number** + **registration date** +
  issuing **Registrar unit** on the registration; the hospital's internal cert number
  (`BC-YYYY-XXXX`, mirroring your `DeathCertificate` `DC-YYYY-XXXX`) is **separate** and never
  conflated with the legal CRS number.
- **Approval workflows:** internal MO + Registrar approval **before** submission; CRS-side
  registrar approval tracked as external states.
- **Health-department reporting:** parallel aggregate reporting (HMIS/RCH portal,
  institutional delivery & still-birth statistics) — generated from the same `BirthEvent` data.
- **Compliance:** 21-day clock with escalation; **delayed registration** path (21 days–1 year:
  registrar permission + late fee; >1 year: magistrate order) modelled as registration sub-states.

Sources: [RBD (Amendment) Act 2023 (PRS)](https://prsindia.org/files/bills_acts/acts_parliament/2023/Registration_of_Births_and_Deaths_(Amendment)_Act,_2023.pdf) · [CRS — About (RGI)](https://dc.crsorgi.gov.in/crs/about) · [CRS FAQ](https://dc.crsorgi.gov.in/assets/download/FAQ_of_CRS_Latest.pdf) · [CRS Form 1 Birth Report](https://dc.crsorgi.gov.in/assets/download/all_forms_CRS_2019_new.pdf) · [India.gov.in CRS service](https://services.india.gov.in/service/detail/civil-registration-system-birth-and-death-certificate)

---

# Deliverable 5 — Enterprise module breakdown

```
Birth Registration & Certificate
│
├── Mother Management
│   ├── Mother Registry (= Patient link)
│   ├── ANC Registration & Visits
│   ├── Obstetric History (gravida/para)
│   └── High-Risk Flagging & Alerts
│
├── Pregnancy Records
│   ├── Pregnancy/Episode tracking (LMP/EDD)
│   ├── Investigations (↔ Lab/Radiology)
│   ├── Immunisation (TT/Td) & IFA
│   └── Delivery Planning & Referral
│
├── Delivery Records (Labour Room)
│   ├── Labour Admission & Partograph
│   ├── Delivery Details & Type
│   ├── Staff Assignment (doctor/nurse/anaesthetist)
│   ├── Complications & Outcomes
│   └── OT/Cesarean linkage
│
├── Newborn Management
│   ├── Newborn Registry + Temp ID + Wristband
│   ├── Mother-Baby Linking (two-band check)
│   ├── Twin/Multiple Mapping (siblingGroup)
│   ├── Anthropometry (weight/length/HC) & APGAR
│   ├── Initial Assessment & NICU referral
│   └── Birth-dose immunisation & newborn screening
│
├── Birth Event & Registration
│   ├── Birth Event capture (statutory dataset / Form 1)
│   ├── Informant capture
│   ├── Verification
│   ├── Medical Officer Approval
│   ├── Registrar Approval
│   └── Delayed-registration handling
│
├── Certificate Management
│   ├── Hospital Birth Record generation (PDF)
│   ├── CRS certificate storage/linking
│   ├── Name Addition (post-registration)
│   ├── Reprint / Duplicate
│   └── Print/Download/Portal delivery
│
├── Government Registration (CRS)
│   ├── Submission adapter (API / file / assisted)
│   ├── Acknowledgement & Registration-number tracking
│   ├── Status sync & error handling
│   └── Health-dept aggregate reporting (HMIS/RCH)
│
├── Corrections Management
│   ├── Correction requests (name/date/spelling)
│   ├── Approval & evidence
│   └── CRS correction submission + revision history
│
├── Reissue & Cancellation
│   ├── Duplicate/Reissue (post-correction/legal order)
│   ├── Cancellation (erroneous/duplicate)
│   └── Adoption/Surrogacy amended issuance (sealed original)
│
├── Digital Signatures
│   ├── DSC (Class 3) signing
│   ├── Aadhaar eSign
│   └── Signature/verification audit
│
├── Reports & Analytics (D11)
├── Audit Logs (D12 — immutable)
└── Administration (master data: delivery types, risk rules, fee config,
    notifier/registrar config, CRS endpoint config per tenant, certificate templates)
```

---

# Deliverable 6 — Database architecture (PostgreSQL / Prisma)

Matches your conventions: `cuid()` IDs, `organizationId` + `@@index` on every model, string
status with inline-enum comments, `@unique` certificate numbers, **snapshotted demographics**
and **certifier/issuance tracking exactly like your `DeathCertificate`**, JSON-as-string for
arrays (as your `Patient.allergies`). New models relate to existing `Organization`, `User`,
`Patient`, `Admission`, `Invoice`.

### 6.1 ER overview

```
Organization 1─* Patient(mother) 1─* AntenatalCare
                      │
                      1─* Pregnancy 1─* Delivery 1─* Newborn ─1 Patient(newborn, optional)
                                                │           │
                                                │           1─1 BirthEvent ─1─ BirthRegistration
                                                │                                   │
                              FamilyRelationship*┘                                   ├─* BirthCertificate ─* CertificateRevision
                              (mother/father/guardian)                              ├─* BirthCorrection
                                                                                    ├─* GovernmentSubmission
                                                                                    └─* DigitalSignature
   Everything safety/legal ─► BirthAuditLog (immutable)
```

### 6.2 Prisma models (drop-in style; abbreviated to key fields)

```prisma
// ============================================================
// MOTHER / PREGNANCY  (mother is an existing Patient)
// ============================================================

model AntenatalCare {
  id             String @id @default(cuid())
  organizationId String
  motherId       String   // -> Patient

  ancNumber      String
  lmp            DateTime?
  edd            DateTime?
  gravida        Int?
  para           Int?
  living         Int?
  abortions      Int?
  bloodGroup     String?
  rhFactor       String?   // positive | negative
  registeredWeek Int?
  riskLevel      String   @default("low") // low | high
  riskFactors    String?  // JSON array
  status         String   @default("active") // active | delivered | closed | referred

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  pregnancy   Pregnancy?
  visits      AncVisit[]

  @@unique([organizationId, ancNumber])
  @@index([organizationId])
  @@index([motherId])
}

model AncVisit {
  id             String @id @default(cuid())
  organizationId String
  ancId          String
  visitDate      DateTime
  gestationWeeks Int?
  weightKg       Float?
  bpSystolic     Int?
  bpDiastolic    Int?
  fundalHeight   String?
  fetalHeartRate Int?
  hb             Float?
  urineAlbumin   String?
  urineSugar     String?
  notes          String?

  anc AntenatalCare @relation(fields: [ancId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ancId])
}

model Pregnancy {
  id             String @id @default(cuid())
  organizationId String
  motherId       String
  ancId          String? @unique

  edd            DateTime?
  plurality      String  @default("single") // single | twin | triplet | higher
  plannedMode    String?  // vaginal | elective_lscs
  outcome        String   @default("ongoing") // ongoing | delivered | aborted | referred_out
  createdAt   DateTime @default(now())

  anc        AntenatalCare? @relation(fields: [ancId], references: [id])
  deliveries Delivery[]

  @@index([organizationId])
  @@index([motherId])
}

// ============================================================
// DELIVERY  (one delivery -> one or more newborns)
// ============================================================

model Delivery {
  id             String @id @default(cuid())
  organizationId String
  pregnancyId    String
  motherId       String
  admissionId    String?  // -> Admission (IPD)

  labourOnset    String?  // spontaneous | induced
  deliveryDateTime DateTime
  deliveryType   String   // normal | assisted_forceps | assisted_vacuum | cesarean_elective | cesarean_emergency | vbac | multiple | still_birth | mtp | home_brought_in
  placeOfBirth   String   @default("hospital") // hospital | home | transit | other
  bloodLossMl    Int?
  complications  String?  // JSON array
  anaesthesia    String?

  attendingDoctorId String?
  conductedById     String?  // doctor/midwife
  paediatricianId   String?
  anaesthetistId    String?
  nurseId           String?

  createdAt   DateTime @default(now())
  createdById String?

  pregnancy Pregnancy @relation(fields: [pregnancyId], references: [id])
  newborns  Newborn[]

  @@index([organizationId])
  @@index([motherId])
  @@index([deliveryDateTime])
}

// ============================================================
// NEWBORN
// ============================================================

model Newborn {
  id             String @id @default(cuid())
  organizationId String
  deliveryId     String
  motherId       String   // hard mother link (medico-legal)
  patientId      String?  // promoted to a Patient record (optional, often post-naming)

  tempId         String   // "BB/of <mother>/<mrn>/<seq>"
  siblingGroupId String?  // shared across twins/triplets
  birthOrder     Int      @default(1)
  plurality      String   @default("single") // single | twin | triplet | higher
  zygosity       String?

  outcome        String   @default("live_birth") // live_birth | still_birth | neonatal_death
  gender         String   // male | female | transgender | ambiguous
  birthWeightG   Int?
  lengthCm       Float?
  headCircCm     Float?
  gestationWeeks Int?
  apgar1         Int?
  apgar5         Int?
  apgar10        Int?
  resuscitation  Boolean  @default(false)
  nicuAdmission  Boolean  @default(false)
  anomalies      String?  // JSON array
  birthDoseGiven String?  // JSON: {vitK, bcg, opv0, hepB}
  motherBandMatchById String? // two-band verification

  createdAt   DateTime @default(now())
  createdById String?

  delivery   Delivery       @relation(fields: [deliveryId], references: [id])
  birthEvent BirthEvent?

  @@unique([organizationId, tempId])
  @@index([organizationId])
  @@index([motherId])
  @@index([deliveryId])
  @@index([siblingGroupId])
}

// ============================================================
// BIRTH EVENT  (statutory dataset — CRS Form 1)
// ============================================================

model BirthEvent {
  id             String @id @default(cuid())
  organizationId String
  newbornId      String @unique

  // Child
  dateOfBirth    DateTime
  timeOfBirth    String?  // HH:mm
  gender         String
  birthOrder     Int?
  deliveryMethod String?
  gestationWeeks Int?
  birthWeightG   Int?
  lengthCm       Float?
  headCircCm     Float?

  // Place
  placeType      String   @default("hospital") // hospital | home | other
  hospitalName   String?
  placeAddress   String?

  // Mother (statutory snapshot)
  motherName        String
  motherAgeAtBirth  Int?
  motherEducation   String?
  motherOccupation  String?
  motherResidence   String?  // usual residence town/village (CRS-distinct from place)
  motherAadhaarHash String?
  childrenBornAlive Int?     // incl. this child

  // Father (optional — never gate registration)
  fatherName        String?
  fatherAgeAtBirth  Int?
  fatherEducation   String?
  fatherOccupation  String?
  fatherAadhaarHash String?

  religion       String?
  parentageBasis String  @default("biological") // biological | adoption | surrogacy

  // Informant (legal declarant)
  informantName     String?
  informantRelation String?
  informantAddress  String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  newborn      Newborn        @relation(fields: [newbornId], references: [id], onDelete: Cascade)
  registration BirthRegistration?

  @@index([organizationId])
  @@index([dateOfBirth])
}

// ============================================================
// REGISTRATION + CERTIFICATE + GOV SUBMISSION + LEGAL EVENTS
// ============================================================

model BirthRegistration {
  id             String @id @default(cuid())
  organizationId String
  birthEventId   String @unique

  internalNumber String   // BR-YYYY-XXXX (hospital)
  status         String   @default("draft")
  // draft | verified | mo_approved | registrar_approved | submitted_to_crs | registered | certificate_issued | correction_pending | cancelled

  // statutory clock
  reportDueDate  DateTime // dateOfBirth + 21 days
  isDelayed      Boolean  @default(false)
  delayCategory  String?  // within_year_registrar | beyond_year_magistrate

  // internal approvals
  verifiedById      String?
  verifiedAt        DateTime?
  medicalOfficerId  String?
  moApprovedAt      DateTime?
  registrarUserId   String?
  registrarApprovedAt DateTime?

  // CRS outcome
  crsRegistrationNumber String?  @unique
  crsRegistrationDate   DateTime?
  crsRegistrarUnit      String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  birthEvent   BirthEvent           @relation(fields: [birthEventId], references: [id])
  certificates BirthCertificate[]
  corrections  BirthCorrection[]
  submissions  GovernmentSubmission[]
  signatures   DigitalSignature[]

  @@unique([organizationId, internalNumber])
  @@index([organizationId])
  @@index([status])
  @@index([reportDueDate])
}

model BirthCertificate {
  id             String @id @default(cuid())
  organizationId String
  registrationId String

  certificateNumber String @unique // BC-YYYY-XXXX (hospital record; NOT the CRS number)
  certificateType   String @default("original") // original | reprint | duplicate | reissue | name_addition
  version           Int    @default(1)
  supersedesId      String? // prior cert this replaces

  childName     String?  // may be blank at first issue (name added later)
  pdfUrl        String?
  qrToken       String? @unique // for public verification link
  crsCertCopyUrl String? // stored copy of the legal CRS certificate

  // issuance tracking (mirrors DeathCertificate)
  issuedTo             String?
  issuedToRelationship String?
  issuedToNationalId   String?
  issuedAt             DateTime?
  issuedById           String?
  isRevoked            Boolean @default(false)

  createdAt DateTime @default(now())

  registration BirthRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  revisions    CertificateRevision[]

  @@index([organizationId])
  @@index([registrationId])
  @@index([certificateNumber])
}

model CertificateRevision {
  id             String @id @default(cuid())
  organizationId String
  certificateId  String
  version        Int
  changeReason   String
  beforeJson     String?
  afterJson      String?
  changedById    String?
  createdAt      DateTime @default(now())

  certificate BirthCertificate @relation(fields: [certificateId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([certificateId])
}

model BirthCorrection {
  id             String @id @default(cuid())
  organizationId String
  registrationId String

  field        String   // child_name | dob | gender | mother_name | father_name | spelling | other
  oldValue     String?
  newValue     String?
  reason       String
  evidenceUrl  String?
  status       String   @default("requested") // requested | approved | rejected | submitted_crs | completed
  requestedById String?
  approvedById   String?
  createdAt    DateTime @default(now())

  registration BirthRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([registrationId])
}

model GovernmentSubmission {
  id             String @id @default(cuid())
  organizationId String
  registrationId String

  channel      String   // crs_api | file_export | assisted_manual
  payloadJson  String?  // the Form 1 dataset submitted
  idempotencyKey String @unique
  status       String   @default("queued") // queued | submitted | acknowledged | registered | rejected | error
  ackId        String?
  responseJson String?
  errorMessage String?
  submittedById String?
  submittedAt  DateTime?
  registeredAt DateTime?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  registration BirthRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([registrationId])
  @@index([status])
}

model DigitalSignature {
  id             String @id @default(cuid())
  organizationId String
  registrationId String
  certificateId  String?

  method       String   // dsc_class3 | aadhaar_esign
  signerUserId String?
  signerName   String?
  signerRole   String?  // medical_officer | registrar
  certSerial   String?  // DSC serial / eSign txn id
  signatureHash String? // hash of signed doc
  signedDocHash String? // SHA-256 of the PDF at signing (tamper detection)
  signedAt     DateTime @default(now())

  registration BirthRegistration @relation(fields: [registrationId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([registrationId])
}

model FamilyRelationship {
  id             String @id @default(cuid())
  organizationId String
  newbornId      String

  relation     String   // mother | father | guardian | sibling
  personName   String
  personPatientId String? // if they're also a Patient
  age          Int?
  occupation   String?
  education     String?
  nationality  String?
  idType       String?
  idLast4      String?
  idHash       String?
  isLegalGuardian Boolean @default(false)

  createdAt DateTime @default(now())
  @@index([organizationId])
  @@index([newbornId])
}

// Immutable legal audit (never hard-deleted)
model BirthAuditLog {
  id             String @id @default(cuid())
  organizationId String
  entityType String   // birth_event | registration | certificate | correction | submission | signature
  entityId   String
  action     String   // create | update | verify | approve | submit | register | print | correct | cancel | reissue
  actorId    String?
  beforeJson String?
  afterJson  String?
  reason     String?
  ipAddress  String?
  createdAt  DateTime @default(now())
  @@index([organizationId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

**Constraints/relationships that matter:**
- `Newborn.motherId` **mandatory** → no orphan newborns; `BirthEvent.newbornId @unique` (1:1);
  `BirthRegistration.birthEventId @unique` (1:1) → clean legal chain.
- `crsRegistrationNumber @unique` and **separate** from hospital `certificateNumber` — the two
  are never conflated (the executive-summary mistake, prevented at the schema level).
- `siblingGroupId` ties multiples; each still gets its own registration/certificate.
- **No hard deletes** on registration/certificate/correction/submission — status + `BirthAuditLog`.
- `GovernmentSubmission.idempotencyKey @unique` prevents double CRS submission.
- `DigitalSignature.signedDocHash` enables tamper detection (D10).

---

# Deliverable 7 — API architecture (REST, Express + Prisma)

Mount `/api/birth-registration` behind `authenticate` + `authorize()`; files mirror your
per-module layout (`routes/birthRegistration.js` → `controllers/birth/*.controller.js` + zod).

```
Mother / ANC
  POST   /birth/anc                          register ANC (+ link mother Patient)
  POST   /birth/anc/:id/visits               add ANC visit
  PATCH  /birth/anc/:id/risk                 set/clear high-risk

Delivery
  POST   /birth/deliveries                   create delivery (from pregnancy/admission)
  PATCH  /birth/deliveries/:id               update details/staff/outcome

Newborn
  POST   /birth/deliveries/:id/newborns      register newborn (enforces mother link) -> tempId+band
  POST   /birth/newborns/:id/assessment      APGAR/anthropometry/initial assessment
  POST   /birth/newborns/:id/promote-patient create Patient record for the baby

Birth event / registration
  POST   /birth/newborns/:id/birth-event     capture statutory dataset (Form 1)
  POST   /birth/registrations                create draft registration from birth event
  POST   /birth/registrations/:id/verify
  POST   /birth/registrations/:id/mo-approve
  POST   /birth/registrations/:id/registrar-approve
  GET    /birth/registrations/:id/form1      render statutory Form 1 (PDF/print)

Government (CRS)
  POST   /birth/registrations/:id/submit     submit to CRS (channel per tenant config)
  POST   /birth/submissions/:id/sync         poll/refresh status
  POST   /birth/registrations/:id/crs-number record returned CRS reg no. (assisted mode)

Certificate
  POST   /birth/registrations/:id/certificate     generate hospital birth record (PDF)
  POST   /birth/certificates/:id/sign             DSC / Aadhaar eSign
  GET    /birth/certificates/:id/pdf               download
  POST   /birth/certificates/:id/reprint
  POST   /birth/certificates/:id/duplicate
  POST   /birth/registrations/:id/add-name         post-registration name addition
  GET    /verify/birth/:qrToken                    PUBLIC verification (no auth) -> minimal status

Corrections / reissue / cancel
  POST   /birth/registrations/:id/corrections
  POST   /birth/corrections/:id/approve
  POST   /birth/certificates/:id/reissue
  POST   /birth/registrations/:id/cancel

Reports
  GET    /birth/reports/daily|monthly|delivery-type|gender|multiple|high-risk
  GET    /birth/reports/crs|hmis                    govt formats
```

### 7.1 Example payloads (the two that matter)

**Register newborn** — `POST /birth/deliveries/:id/newborns`
```jsonc
// request:
{ "gender":"female", "outcome":"live_birth", "birthOrder":1, "plurality":"single",
  "birthWeightG":2980, "lengthCm":49, "headCircCm":34, "gestationWeeks":39,
  "apgar1":8, "apgar5":9, "motherBandMatchById":"usr_nurse" }
// 201:
{ "id":"clx...", "tempId":"BB/of Sunita Devi/MRN-10234/1", "motherId":"pat...",
  "wristbandBarcode":"NB-... ", "siblingGroupId":null }
// 422 (mother link missing/invalid): { "error":"MOTHER_LINK_REQUIRED" }
```

**Submit to CRS** — `POST /birth/registrations/:id/submit`
```jsonc
// guard: status must be registrar_approved + all Form-1 mandatory fields present
// 200:
{ "submissionId":"cly...", "channel":"crs_api", "status":"submitted",
  "idempotencyKey":"birthEvent:clx...", "dueDate":"2026-06-30" }
// 409 (clock/gate):
{ "error":"SUBMIT_BLOCKED", "reasons":["NOT_REGISTRAR_APPROVED","MISSING:motherResidence"] }
```

### 7.2 Validation rules (zod, server-side)
- Newborn requires a valid `deliveryId` + resolves a `motherId` (hard mother link).
- `BirthEvent`: dateOfBirth not in future, time valid, gender ∈ enum, place + mother fields
  required (CRS "no blank items" rule); father optional.
- Registration submit: `status == registrar_approved`, all Form-1 mandatory fields non-empty,
  within 21 days else `isDelayed` + delay category required.
- Correction/cancel/reissue: require `reason` + evidence + approver role; legal fields frozen
  post-`registered` except via these flows.
- Public verify endpoint: rate-limited, returns **minimal** non-PII status (valid/revoked +
  cert number + issue date), never full record.

### 7.3 Security controls
- RBAC per transition (matrix below); approvals require distinct users (4-eyes on MO vs Registrar).
- Aadhaar: **never store raw** — hash + last4 only (DPDP Act 2023).
- Signed-doc hash stored for tamper detection; certificate PDFs in access-controlled storage
  with signed, expiring URLs.
- Immutable `BirthAuditLog` with actor + IP on every state change; no hard delete.

### 7.4 RBAC matrix
| Capability | Super Admin | Hospital Admin | Obstetrician/Doctor | Nurse/Midwife | Records Clerk | Medical Officer | Registrar (hospital) | Parent (portal) | Auditor |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| ANC/delivery/newborn capture | ✓ | ✓ | ✓ | ✓ | – | – | – | – | R |
| Birth event / Form 1 draft | ✓ | ✓ | ✓ | ✓ | ✓ | – | – | – | R |
| Verify | ✓ | ✓ | – | – | ✓ | – | – | – | R |
| MO approve (medical facts) | ✓ | – | – | – | – | ✓ | – | – | R |
| Registrar approve + submit CRS | ✓ | – | – | – | – | – | ✓ | – | R |
| Generate/sign certificate | ✓ | ✓ | – | – | – | ✓ (sign) | ✓ (sign) | – | R |
| Reprint/duplicate | ✓ | ✓ | – | – | ✓ | – | ✓ | request | R |
| Correction/cancel/reissue | ✓ | ✓ | – | – | request | approve | approve | request | R |
| View/download own child cert | ✓ | ✓ | ✓ | – | ✓ | – | ✓ | **✓ own** | R |
| Reports / audit | ✓ | ✓ | R | – | R | R | ✓ | – | **✓** |

---

# Deliverable 8 — Frontend architecture (React + Vite + shadcn/ui)

Mirror your existing module structure; reuse `components/common/*`, `components/ui/*`,
`DateFilter`, `BarcodeScanner`, `BulkImportDialog`, and the Death-Certificate module's
form/print patterns.

```
frontend/src/
├── pages/BirthRegistrationPage.jsx
├── lib/roleConfig.js                         // add `birthRegistration` module + role mappings
└── components/birth-registration/
    ├── BirthRegistrationModule.jsx           // shell + tabs + KPI header
    ├── dashboard/
    │   ├── BirthDashboard.jsx                // births today/MTD, pending CRS, due-soon (21-day)
    │   └── ComplianceWidget.jsx              // registrations approaching/over 21 days
    ├── labour-room/
    │   ├── LabourBoard.jsx                   // live labour-room board (admitted mothers)
    │   ├── DeliveryForm.jsx  PartographPanel.jsx
    │   └── StaffAssignment.jsx
    ├── mother/
    │   ├── AncRegister.jsx  AncVisitForm.jsx  HighRiskBadge.jsx
    ├── newborn/
    │   ├── NewbornRegisterForm.jsx           // enforces mother link, prints wristband
    │   ├── MotherBabyBandCheck.jsx (scan)    │ TwinMappingPanel.jsx
    │   └── NewbornAssessment.jsx (APGAR/anthropometry)
    ├── registration/
    │   ├── BirthEventForm.jsx (Form 1)        VerificationScreen.jsx
    │   ├── ApprovalScreen.jsx (MO + Registrar) Form1Preview.jsx
    │   └── DelayedRegistrationDialog.jsx
    ├── certificate/
    │   ├── CertificateManager.jsx  CertificatePreview.jsx (QR)
    │   ├── NameAdditionDialog.jsx  ReprintDuplicateDialog.jsx
    │   └── SignDialog.jsx (DSC/eSign)
    ├── government/
    │   ├── CrsSubmissionPanel.jsx  SubmissionStatus.jsx  CrsWorklist.jsx (assisted mode)
    ├── corrections/CorrectionRequest.jsx  ReissueScreen.jsx  CancelDialog.jsx
    └── reports/BirthReports.jsx
```

**Hero screens:**
- **Labour Room Dashboard** — live board of admitted/in-labour mothers, delivery outcomes,
  newborns awaiting registration; the department's home.
- **Newborn Registration** — mother-link-enforced form + **two-band scan check** +
  wristband print; twin panel adds siblings sharing the delivery.
- **Form 1 / Approval** — statutory form with completeness validation (no blanks), MO and
  Registrar approval steps, Form-1 print preview.
- **CRS Submission panel** — submit + live status; **assisted-mode worklist** (print Form 1,
  paste back CRS registration number).
- **Certificate Manager** — generate hospital birth record, sign (DSC/eSign), QR, reprint/
  duplicate, name-addition; revision history visible.

---

# Deliverable 9 — Mobile application features (React + Capacitor)

**Hospital staff app** (extend `mobile-frontend` Mobile* components):
- Bedside **newborn registration** + **mother-baby band scan** (Capacitor camera + your
  `BarcodeScanner`) — the anti-swap control at point of care.
- Quick birth-event capture / APGAR entry in the labour room.
- **Certificate / QR verification** — scan a certificate QR → calls `/verify/birth/:qrToken`
  → valid/revoked + issue details.
- **Approval workflow** — MO/Registrar approve pending registrations on the go (with eSign).
- Push alerts: registrations nearing the 21-day deadline.

**Parent portal** (reuse your Patient Portal auth + WhatsApp):
- View child's birth record + (once available) CRS certificate.
- **Download PDF** (signed, QR).
- **Request correction** (name spelling/DOB) with evidence upload.
- **Request reissue / duplicate**.
- **Track application status** — live CRS submission/registration status timeline.
- Name-addition request if registered before naming.
- Notifications/WhatsApp on each status change + a digital "birth announcement" card.

---

# Deliverable 10 — Digital certificate architecture

> The legally valid certificate is the **CRS-signed** one. The hospital PDF is an **internal
> record** that must be clearly labelled as such and independently verifiable.

- **PDF generation**: server-side from a versioned HTML template (Puppeteer/`pdfkit`) →
  deterministic layout, embedded fonts, hospital + tenant branding (reuse your branding vars),
  bilingual (English + state language) where required.
- **QR codes**: encode a **verification URL** `…/verify/birth/<qrToken>` (opaque random token,
  not the record id) → public, rate-limited endpoint returns minimal status. Optionally a
  signed JWT/JWS payload in the QR carrying cert no. + issue date + doc hash for **offline**
  validation.
- **Verification links**: public page shows valid/revoked, certificate number, child (initial),
  DOB, issue date, issuing facility — **no full PII**; "for full copy, log in to parent portal."
- **Digital signature**: **DSC Class 3** (USB token, private key never leaves device — for the
  signing officer/registrar) for the authoritative internal record; or **Aadhaar eSign**
  (CCA-licensed ASP, OTP/biometric, IT-Act-valid) where a token-less flow is needed. Store
  signer, cert serial/txn id, time, and **SHA-256 of the signed bytes** in `DigitalSignature`.
- **Tamper detection**: persist `signedDocHash`; verification recomputes the hash of the served
  PDF and compares; mismatch → "document altered." Embed a **PAdES-style** signature in the PDF
  so standard readers show the signature/validity.
- **Certificate validation**: chain = QR token → registration → not revoked + hash match +
  signature valid. Auditor view shows full revision history.
- **Duplicate prevention**: one **active** `original` certificate per registration; reprints/
  duplicates are explicit typed records with watermark + reason + audit; `isRevoked` supersedes;
  `version`/`supersedesId` keep an unbroken chain. `GovernmentSubmission.idempotencyKey` blocks
  double CRS registration.

Sources: [CCA — Digital Signature](https://cca.gov.in/digital_sign.html) · [Aadhaar eSign vs DSC](https://www.leegality.com/blog/aadhaar-esign-vs-dsc) · [CRS (RGI)](https://dc.crsorgi.gov.in/)

---

# Deliverable 11 — Reporting & analytics

Build on existing `analytics`/`dashboard` + `ReportsModule` + `DateFilter`. Org-scoped, export
to PDF/Excel (your SheetJS pipeline).

**Management dashboard**
- Births per day / month / year; live-birth vs still-birth.
- **Delivery-type statistics** (normal vs LSCS vs assisted) + **C-section rate** (a watched
  clinical-quality + audit indicator).
- Gender statistics + sex ratio at birth (SRB) — a sensitive govt metric (PCPNDT context).
- Multiple-birth statistics (twin/triplet rate).
- **High-risk pregnancy outcomes** (risk-flagged → outcome correlation), low-birth-weight rate,
  NICU admission rate, neonatal mortality.
- Average birth weight, gestational-age distribution.

**Operations**
- Registrations pending verification/approval; **21-day compliance** (on-time vs delayed vs
  overdue); CRS submission success/error rate; certificate issuance turnaround; reprint/
  duplicate/correction volumes.

**Government / statutory reports**
- **Daily & monthly birth reports** in CRS/state formats; still-birth report.
- **CRS reconciliation** (submitted vs registered vs pending) per registrar unit.
- **HMIS/RCH** aggregate institutional-delivery reporting.
- Sex-ratio-at-birth report; LBW report — health-department formats.

**Compliance**
- 21-day adherence, false-info/correction log, audit-trail exports, certificate revision history.

---

# Deliverable 12 — Audit & compliance

- **Complete audit trail**: every create/update/approve/submit/print/correct/cancel/reissue →
  immutable `BirthAuditLog` (actor, role, timestamp, IP, before/after JSON, reason). No hard
  deletes on any legal entity.
- **User activity tracking**: reuse your `UserActivity`/`AuditLog` scaffold; tie blood-…er,
  birth-critical actions to named users with 4-eyes separation (MO ≠ Registrar).
- **Change history**: `CertificateRevision` + `BirthCorrection` give a full field-level history
  of every legal change with evidence and approver.
- **Certificate revision history**: `version`/`supersedesId` chain; each reissue/correction
  visible with reason; superseded copies marked, never destroyed.
- **Legal record retention**: birth records are **permanent legal records** — design archival,
  **never purge**; align to the strictest statute (CRS/RBD treats these as lifelong). Soft-
  delete + reason only. Tenant data export on offboarding.
- **Hospital compliance**: NABH (medical records, identification/anti-swap, MLC handling),
  RBD Act notifier obligations + 21-day reporting, DPDP Act (consent, Aadhaar minimisation),
  PCPNDT (no pre-natal sex determination — the module must **never** capture/expose foetal sex
  antenatally), MTP Act for terminations. Build these as policy checks, not afterthoughts.

---

# Deliverable 13 — Integration strategy with existing HMS

### Reuse (do NOT rebuild)
| Existing module | Use in birth registration |
|---|---|
| **Patients** | Mother = `Patient`; newborn promoted to `Patient`. Reuse `PatientLookup`/`RegisterPatientForm`. |
| **Inpatient / Ward-Bed** | Maternity admission, labour-room/ward bed, NICU. |
| **Consultations** | ANC visits, paediatric newborn exam. |
| **Laboratory / Radiology** | ANC investigations, USG, newborn screening, blood group/Rh. |
| **Death Certificate module** | **Closest analog & template** — certificate numbering, certifier/issuance tracking, snapshotted demographics, print/PDF. Neonatal death / still-birth also links here (MCCD). |
| **Billing / Payments** | Delivery package, certificate duplicate/reissue fees → `Invoice`/`Payment`. |
| **Notifications / WhatsApp** | Status updates, 21-day reminders, birth announcement, correction status. |
| **Patient Portal** | Becomes the **parent portal** for certificate view/download/requests. |
| **Mobile** | Staff app (bedside registration/band scan/approval) + parent portal. |
| **Auth / RBAC / Multi-tenant** | New roles (`medical_officer`, `hospital_registrar`, `records_clerk`) + `authorize()` matrix; all models org-scoped. |
| **Audit scaffold / Analytics / DateFilter** | Audit trail + dashboards/reports. |

### New modules required
ANC/pregnancy tracking, labour-room/delivery, newborn + mother-baby linking, birth-event/Form 1,
internal approval chain (MO + Registrar), **CRS government-submission adapter**, certificate
generation + **digital signature (DSC/eSign)** + QR verification, corrections/reissue/cancel,
adoption/surrogacy handling, statutory + HMIS reporting.

### Data-flow architecture
```
Mother(Patient)+ANC ─► Pregnancy ─► Delivery ─► Newborn ─► BirthEvent(Form1)
                                       │                        │
                                  (IPD/OT/Lab/Radiology reused)  ▼
                                                          BirthRegistration
                                          ┌──── verify→MO→Registrar approve ────┐
                                          ▼                                     ▼
                                  GovernmentSubmission(CRS) ──► CRS reg no. ──► BirthCertificate
                                          │                                     │ sign(DSC/eSign)+QR
                                  Billing(fees) ◄── duplicate/reissue           ▼
                                  Notifications/WhatsApp ◄─────────── status ──► Parent Portal/Mobile
                                  Everything ─► BirthAuditLog (immutable)
```

### Multi-tenant implementation
- Every model `organizationId`-scoped; composite uniques (`internalNumber`, `certificateNumber`,
  `ancNumber`, `tempId`) **per org**; `crsRegistrationNumber` globally unique.
- **Per-tenant CRS config** (channel = api/file/assisted, state endpoint, notifier credentials,
  registrar unit), certificate templates/branding, fee config, enabled sub-features — via your
  `Organization.settings` + `modulesEnabled` (`birthRegistration` toggle), ship dark per tenant.
- No cross-tenant visibility; tenant-scoped retention/export.

### Migration strategy
1. **Additive Prisma migration** — new models only; add reverse relations on `Organization`/
   `User`/`Patient`/`Admission`. Safe `prisma migrate`.
2. Seed master data per org: delivery types, risk rules, fee items, certificate templates,
   roles/permissions, CRS endpoint config.
3. **Legacy import** of historical births via `BulkImportDialog`/SheetJS (validate→commit),
   backfilling CRS numbers where known, flagging the rest.
4. Phase behind the `birthRegistration` module toggle; pilot one maternity tenant.

---

# Deliverable 14 — Final recommendation

### 1. Best architecture
**Native HMS module, two-domain design**: clinical (mother→pregnancy→delivery→newborn→birth
event) + legal (registration→approval→**CRS submission**→certificate), reusing ~70% of existing
substrate (Patients, IPD, Lab/Radiology, **Death-Cert pattern**, Billing, Notifications, Portal,
Mobile, RBAC, Audit). The hospital acts as **notifier into CRS**, never as the issuer of the
legally valid certificate — that separation is the architectural backbone.

### 2. Recommended database design
The 16-model schema in D6, anchored on the **mandatory mother-link**, the **1:1 newborn→birth
event→registration** legal chain, the **separated CRS number vs hospital cert number**, the
**government-submission state machine** with idempotency, typed **corrections/revisions**, and
the **immutable `BirthAuditLog`**. No hard deletes on legal entities; Aadhaar hashed only.

### 3. Recommended workflow
Labour room → newborn (mother-link + band check) → birth event/Form 1 → verify → MO approve →
Registrar approve → CRS submit (api/file/assisted) → record CRS number → generate + sign +
QR certificate → portal delivery; corrections/reissue/cancel as audited legal events; 21-day
clock with escalation throughout.

### 4. Development roadmap
| Phase | Scope | Effort |
|---|---|---|
| **P0 Foundations** | Schema + migration, RBAC roles, master data, module toggle, tenant CRS config | 2 wks |
| **P1 Clinical capture** | ANC, delivery, newborn + **mother-baby link/band**, twins, birth event | 3–4 wks |
| **P2 Registration + approvals** | Form 1, verify, MO + Registrar approval, 21-day clock | 2–3 wks |
| **P3 Certificate + signature** | PDF gen, DSC/eSign, QR verify, reprint/duplicate/name-addition | 3 wks |
| **P4 CRS integration** | Submission adapter (assisted → file → api), status sync, reconciliation | 3–4 wks |
| **P5 Corrections/reissue + Reports** | correction/cancel/reissue, statutory + HMIS reports, dashboards | 3 wks |
| **P6 Mobile + Portal + Hardening** | staff app, parent portal, audit, perf, NABH/CRS dry-run | 3–4 wks |
| **Total to production** | | **~3.5–5 months** |
| **MVP (P0–P3)** | clinical→hospital birth record + Form 1 | **~7–9 weeks** |

### 5. Team size
3–4 senior: 1–2 backend (Node/Prisma + CRS adapter + signing), 1–2 frontend/mobile, 0.5 QA,
plus a **part-time obstetrics/medical-records SME + a CRS/registration compliance advisor**
(validates Form 1 fields, approval chain, state CRS specifics) and a PM.

### 6. Risks
- **Legal-validity confusion** (hospital cert mistaken for statutory) — mitigated by the
  two-domain design + explicit labelling + separate numbers.
- **CRS integration uncertainty** (no uniform public hospital-push API; state-by-state rollout)
  — mitigated by the **pluggable adapter** (assisted mode always works as fallback); spike the
  target state early.
- **Mother-baby mismatch / swap** (catastrophic medico-legal) — hard FK + two-band scan +
  audit; never optional.
- **PCPNDT exposure** — module must never capture/expose antenatal foetal sex; design-time guard.
- **DPDP/Aadhaar** — hash-only, consent, minimisation, retention.
- **Digital-signature integration** (DSC token UX / eSign ASP onboarding) — choose CCA-licensed
  ASP early; abstract behind `DigitalSignature`.
- **Permanent retention** — archival, never purge; validate backups.

### 7. Production-readiness checklist
- [ ] Mother-baby link enforced in code (no orphan newborns) + two-band verification logged.
- [ ] 21-day clock + escalation + delayed-registration (registrar/magistrate) paths.
- [ ] Internal approval chain (Verify → MO → Registrar) with 4-eyes RBAC.
- [ ] CRS submission adapter live for target state(s); assisted-mode fallback + reconciliation.
- [ ] CRS registration number captured & distinct from hospital cert number.
- [ ] Certificate PDF + DSC/eSign + QR public verification + tamper-hash check.
- [ ] Corrections / cancellation / reissue / name-addition flows with evidence + audit.
- [ ] Adoption & surrogacy handled as authorised legal events with sealed originals.
- [ ] Still-birth / neonatal-death handled (sensitive UX, correct statutory category, MCCD link).
- [ ] Immutable `BirthAuditLog`; no hard deletes; permanent retention + tenant export.
- [ ] Aadhaar hashed only; DPDP consent; PCPNDT antenatal-sex guard.
- [ ] Multi-tenant scoping + per-tenant CRS/template/fee config + module toggle.
- [ ] Statutory (CRS/HMIS) + management reports validated against official formats.
- [ ] Parent portal + staff mobile (band scan, approvals, QR verify).
- [ ] Validation test suite covering the mother-link, approval gates, and submit idempotency.

---

### Final architecture statement
Build Birth Registration as a **first-class, two-domain HMS module** that cleanly separates the
**clinical birth event** the hospital owns from the **legal civil registration** the State owns —
capturing the labour-room reality, enforcing the unbreakable **mother-baby link**, generating the
statutory **Form 1**, driving an internal **MO + Registrar** approval chain, and **submitting to
CRS within 21 days** via a pluggable adapter (so it works in every state today, API or not).
Reuse your Patients/IPD/Lab/Billing/Notifications/Portal/Mobile/RBAC and the existing
**Death-Certificate pattern**; add the registration legal chain, **DSC/eSign + QR** certificates,
corrections/reissue, and immutable audit. The result is legally sound, NABH/CRS-auditable,
scalable to thousands of births a year, and correct about the one thing most "birth certificate
CRUD" apps get wrong — *who actually issues the certificate.*
