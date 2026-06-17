# Enterprise Blood Bank & Blood Donation Management System — Architecture & Research

> Solution-architect blueprint for adding a **NABH / NBTC / CDSCO / ISBT 128-grade
> Blood Centre module** to the existing multi-tenant HMS.
> Scope target: AIIMS / Apollo / Medanta / Max / Fortis / Narayana / Govt medical
> colleges / regional & national blood centres handling thousands of donations and
> transfusions per year.
> Last updated: 2026-06-11.

---

## 0. Executive summary (read this first)

**Recommendation: BUILD a new native module inside the existing HMS** (option C), not
integrate or fork. Reasoning in detail in Deliverable 12, but the short version:

1. **No open-source blood-bank project is production-grade for Indian regulated use.**
   The GitHub field is dominated by student/CRUD projects (PHP/MySQL, Django) — donor
   list + stock counter, no component traceability, no ISBT 128, no cross-match audit,
   no recall/look-back. None are safe to put blood in a patient's arm behind.
2. **The serious systems are closed/regulated** — eProgesa (MAK-System/EGIS), Bagmo
   (India, e-RaktKosh + NABH compliant), e-RaktKosh itself (C-DAC, govt — integrate,
   don't replace). These are BECS (Blood Establishment Computer Software), an FDA
   *medical-device-class* software category. You cannot meaningfully fork them.
3. **Your HMS already owns 70% of the hard substrate** — multi-tenancy, RBAC, JWT,
   Patients, Lab (sample/result/verify lifecycle), Pharmacy (batch + expiry +
   append-only **StockLedger** + barcode scanning + bulk import), Billing, Payments,
   Notifications/WhatsApp, Analytics, Mobile. A blood centre is essentially
   *"Pharmacy inventory with a donor pipeline, a transfusion-safety gate, and
   regulatory traceability."* You are closer than a green-field team.
4. **The risk in blood banking is not CRUD — it's traceability & the safety gate.**
   The entire architecture below is organised around two invariants:
   - **Vein-to-vein traceability:** every transfused unit can be walked backwards to a
     specific donor, donation, test result, component split, fridge, and issue event —
     and forwards (look-back/recall) from an infected donor to every recipient.
   - **The issue gate:** no unit leaves the fridge for a patient unless it is
     `available` (all mandatory tests non-reactive), ABO/Rh compatible, cross-match
     compatible, and bedside two-person verified.

**Effort:** ~5–7 months for a senior squad of 4–5 to reach NABH-auditable production
(see Deliverable 12 roadmap). MVP (donor→collection→testing→inventory→issue) in ~10–12 weeks.

---

# Deliverable 1 — Enterprise Blood Bank Business Workflow

The blood centre is a regulated manufacturing + dispensing pipeline. Five macro-stages,
each a state machine. Below: the master flow, then each sub-workflow with its states,
guards (the rules that block progression), and the records written.

### 1.0 Master vein-to-vein flow

```
 DONOR                    COLLECTION              TESTING / TTI            PROCESSING
 ┌──────────────┐         ┌──────────────┐        ┌──────────────────┐    ┌────────────────────┐
 │ Register     │         │ Phlebotomy   │        │ Mandatory tests  │    │ Component sep.     │
 │ Screen +     │  pass   │ Bag + DIN    │ sample │ HIV HBsAg HCV    │    │ WB → PRBC/Plasma/  │
 │ Eligibility  ├────────►│ barcode      ├───────►│ Syphilis Malaria │    │ Platelet/Cryo      │
 │ Consent      │ defer?  │ Collect 350/ │        │ NAT + ABO/Rh     │    │ each child unit    │
 └──────┬───────┘  │      │ 450 mL       │        └────────┬─────────┘    └─────────┬──────────┘
        │      ┌───▼───┐  │ Adverse evt? │            reactive│ non-reactive          │
        │      │Deferral│ └──────┬───────┘            ┌───────▼──────┐                │
        │      │(temp/  │        │ unit created       │ QUARANTINE → │                │
        │      │perm)   │        ▼                    │ discard +    │                │
        │      └────────┘  ┌─────────────┐            │ NAT confirm  │                │
        │                  │ BloodUnit   │◄───────────┤ donor notify │                │
        │                  │ status=     │            │ (counsel/NACO)│               │
        │                  │ quarantine  │            └──────────────┘                │
        │                  └─────────────┘                                            │
        │                                                                             ▼
 INVENTORY / STORAGE                 REQUEST / ISSUE                          ┌────────────────┐
 ┌────────────────────┐             ┌──────────────────────────────────┐    │ available units│
 │ Fridge/freezer/     │            │ Doctor raises BloodRequest        │◄───┤ labelled,      │
 │ agitator by         │  reserve   │ → cross-match → reserve → issue   │    │ ABO/Rh, expiry │
 │ component+group     ├───────────►│ → bedside 2-person check          │    └────────────────┘
 │ temp-logged,        │            │ → transfusion + vitals monitoring │
 │ expiry FEFO         │            │ → adverse-reaction watch          │
 └────────────────────┘            └──────────────────────────────────┘
        ▲                                          │
        │           RECALL / LOOK-BACK             ▼
        └──────────── if donor later tests reactive: trace every component & recipient,
                      recall un-transfused units, notify treating doctors, audit trail.
```

---

### 1.1 Donor lifecycle

```
Walk-in / Camp / Appointment
      │
      ▼
[Register Donor] ── existing? ──► match by phone/Aadhaar-hash/donor#  (reuse Patient identity patterns)
      │ new
      ▼
[Identity Verification]  govt ID (Aadhaar/Voter/DL/Passport) — store ID *type+last4+hash*, never raw Aadhaar
      │
      ▼
[Donor Questionnaire / Medical History]  travel, tattoo, surgery, meds, prior deferrals, high-risk behaviour
      │
      ▼
[Physical Screening]  Hb (≥12.5 g/dL), BP, pulse, temp, weight (≥45 kg), last-donation interval
      │
      ├── FAIL ──► [Deferral]  temporary (date-bound) | permanent  → donor.status, blocks booking
      │
      ▼ PASS
[Consent]  e-signed/printed, versioned consent text, timestamp + witness
      │
      ▼
[Eligibility = ELIGIBLE]  → proceed to collection (walk-in) or [Book Appointment]
      │
      ▼
After donation → [Repeat Donor Tracking]  next-eligible-date (M 90d / F 120d for whole blood),
                  lifetime donation count, donor tier (bronze/silver/gold), retention campaigns
```

**Key guards (must be enforced in code, not just UI):**
- **Inter-donation interval:** whole blood ≥ 90 days (M) / 120 days (F); plateletpheresis ≥ 48 h (max 24/yr). Block registration→collection if `lastDonationDate + interval > today`.
- **Hb / weight / age (18–65) / vitals** thresholds → auto-suggest deferral.
- **Active deferral** (temporary not expired, or permanent) → hard block, reason shown.
- **No paid/professional donors** (illegal under D&C Rules) — `donorType ∈ {voluntary, replacement}` only; "paid" disallowed.

**Deferral management:** every deferral is a row (`DonorDeferral`) with category
(temporary/permanent), reason code (NACO/NBTC list: low-Hb, recent-illness, travel-malaria,
tattoo-6mo, high-risk, reactive-TTI…), start date, end date (null = permanent), deferring
officer. Donor's current status is derived from the most restrictive active deferral.

**Donor retention** (the commercial value): tier, last contact, WhatsApp re-call when
`nextEligibleDate` reached, "your blood was used / saved a life" thank-you, camp invites,
birthday/anniversary nudges, rare-group (Bombay/Rh-null) registry.

---

### 1.2 Blood collection workflow

```
[Donation Registration]  link eligible Donor → create Donation (session)
      │
      ▼
[Collection Bag Assignment]  pick bag type: single / double / triple / quad (decides components)
      │  + anticoagulant (CPDA-1, CPD, SAGM) → drives shelf life
      ▼
[Barcode Generation]  assign Donation Identification Number (DIN) — ISBT 128 (see D9)
      │                print donor-sample tube labels + bag labels with SAME DIN
      ▼
[Collection Process]  phlebotomist, start time, target volume (350/450 mL),
      │                gross weight monitoring, mixing
      ▼
[Adverse Event?] ── yes ──► [Donor Adverse Reaction]  vasovagal/haematoma/etc. severity,
      │                       treatment, outcome → may trigger deferral
      ▼ no / mild
[Collection Verification]  volume in range? duration OK? not under/over-collected?
      │                     under-collection / >15 min slow draw → flag unit quality
      ▼
[Collection Completion]  end time, final volume, segments/pilot tubes retained
      │
      ▼
[Blood Unit Creation]  BloodUnit (status=collected→quarantine), donor sample tube → lab
```

The **same DIN binds bag + pilot tubes + donor record** — this is the root of traceability.

---

### 1.3 Blood testing workflow (TTI + immunohematology)

Two parallel tracks on the donor sample: **blood grouping** and **transfusion-transmissible
infection (TTI) screening**. A unit is not releasable until **both** complete and pass.

```
[Sample Receipt]  match tube DIN ↔ donation; reject mislabelled/clotted/insufficient
      │
      ├──────────────► [Blood Grouping]  ABO forward+reverse, RhD (+ weak-D if neg), antibody screen
      │                       │ discrepancy? → repeat / resolve, never release on discrepancy
      ▼                       ▼
[TTI Mandatory Panel]   [Group Confirmed]
   HIV 1&2 (Ag/Ab)
   HBsAg
   Anti-HCV
   Syphilis (VDRL/TPHA)
   Malaria (antigen)
   + NAT (HIV/HBV/HCV) where available  ◄── ID-NAT / MP-NAT, shortens window period
      │
      ▼
[Result Entry] ─ per test: reactive / non-reactive / invalid / grey-zone
      │           (auto-import from analyzer via MachineResultsQueue where integrated)
      ▼
[Verification]  second tech / supervisor verifies against raw analyzer values
      │
   ┌──┴────────────────────────────┐
   │ ANY reactive / invalid          │ ALL non-reactive
   ▼                                 ▼
[Quarantine → Rejection]        [Approval / Release]
   unit + all components →          unit + components → status `available`
   status `discarded`               released to inventory, labelled "FOR TRANSFUSION"
   reason=TTI_reactive
   → repeat in duplicate; if confirmed:
     • donor permanent deferral
     • confidential donor notification + counselling referral (NACO ICTC)
     • look-back if donor donated before (D1.8 recall)
     • mandatory disposal record
```

**Hard guards:**
- Unit `status` can only become `available` when there exists a **verified, non-reactive**
  result for **every** mandatory test **and** a confirmed ABO/Rh group. Enforce in a single
  `releaseUnit()` transaction, not via UI checkboxes.
- Grey-zone / invalid = treat as reactive until resolved (fail-safe).
- All test runs keep lot number, kit expiry, analyzer ID, operator (NABH QC requirement).

---

### 1.4 Component separation workflow

```
Whole Blood (within time/temp window from collection)
   │  centrifuge (soft/hard spin)
   ├──────────────► Packed Red Cells (PRBC)      shelf life: 35–42 d (SAGM), 2–6 °C
   ├──────────────► Platelet Concentrate (PC)    shelf life: 5 d, 20–24 °C + agitation
   ├──────────────► Fresh Frozen Plasma (FFP)    shelf life: 1 yr, ≤ −30 °C  (freeze ≤6–8 h)
   └──────────────► Cryoprecipitate (from FFP)   shelf life: 1 yr, ≤ −30 °C

Apheresis path (separate): SDP (single-donor platelets), plasmapheresis, double-RBC.
```

**Workflow & inventory handling:**
1. Eligible whole-blood unit (`available` or pre-release within validity) selected for processing.
2. `ComponentSeparation` event records method, operator, centrifuge, start/end, temp.
3. **Each child component becomes its own `BloodUnit`** with:
   - its **own component code** + expiry (derived from component type + collection datetime),
   - a **`parentUnitId`** pointing back to the whole-blood unit (traceability tree),
   - **inherited DIN** (ISBT 128 keeps the DIN; product description code changes).
4. Parent whole-blood unit status → `separated` (no longer issuable as whole blood).
5. Each child inherits the parent's TTI/group result linkage (so release gate still applies).
6. Inventory: child units enter inventory under their component+group+fridge bucket.
7. **Component yield** is tracked (units produced / whole-blood processed) — a QC KPI.

This parent→child tree is what makes recall work: infect one donor → walk the tree to
every PRBC/FFP/platelet/cryo derived from every donation and every recipient.

---

### 1.5 Blood inventory workflow

```
[Inventory Creation]  on unit release → row in BloodInventory (or derived view over BloodUnit)
      │                bucketed by: component × ABO/Rh × storage location × status
      ▼
[Storage Management]  assign to a BloodStorage device (fridge/freezer/platelet-agitator)
      │                with set-point + alarm range; FEFO placement
      ▼
[Refrigerator / Temperature Monitoring]  TemperatureLog rows (manual q4h + IoT sensor feed)
      │                breach → alarm, affected units flagged "quarantine pending review"
      ▼
[Stock states]  available │ reserved (for a request) │ quarantine │ issued │ expired │ discarded
      │
      ├─ [Expiry Management]  FEFO picking, T-minus alerts (platelets daily!), auto-expire job
      ├─ [Stock Movement]    every change = append-only BloodStockLedger row (mirror PharmacyStockLedger)
      ├─ [Transfers]         inter-fridge / inter-branch / inter-hospital transfer w/ cold-chain record
      ├─ [Quarantine Stock]  pre-test, post-breach, under-investigation
      ├─ [Reserved Stock]    cross-matched & held for a named patient (auto-release on TTL)
      └─ [Emergency Stock]   O-neg / uncrossmatched emergency issue register (retrospective XM)
```

**Invariants** (mirroring your Pharmacy `StockLedger` discipline):
- Every unit-state change goes through one `recordBloodMovement(tx, …)` writing the ledger
  atomically — counts never drift.
- **FEFO** (First-Expiry-First-Out), not FIFO — expiry-driven, especially platelets (5 days).
- Reserved units have a **reservation TTL**; expired reservations auto-return to `available`.
- Temperature excursions quarantine affected units pending a QC disposition.

---

### 1.6 Blood request → issue → transfusion workflow

```
[Patient Blood Request]  doctor/ward raises request: patient, component, units, urgency
      │                   (routine / urgent / emergency / MTP massive-transfusion-protocol),
      │                   clinical indication, pre-transfusion Hb/platelet
      ▼
[Doctor Approval]  authorised by treating consultant; emergency path can defer paperwork
      │
      ▼
[Sample + Recipient Grouping]  patient ABO/Rh (independent of any historical value), antibody screen
      │
      ▼
[Cross-Match]  serological (AHG/Coombs) or electronic XM (if antibody screen neg & 2 historical groups)
      │           per candidate unit → compatible / incompatible
      │  incompatible → pick another unit / investigate antibody / refer
      ▼ compatible
[Compatibility Verification]  ABO/Rh rules re-checked (recipient vs unit), antibody considerations
      │
      ▼
[Blood Allocation / Reserve]  unit status → reserved, compatibility label printed (patient + unit IDs)
      │
      ▼
[Blood Issue]  unit physically released; issue note; cold-chain start; status → issued
      │           emergency/uncrossmatched O-neg path = flagged, retrospective XM mandatory
      ▼
[Bedside Verification]  TWO-PERSON check at bedside: patient wristband ID ↔ unit label ↔ XM report
      │                   (scan unit barcode + patient barcode — the last safety gate)
      ▼
[Transfusion Recording]  start time, vitals @0/15/30 min + end, volume, transfusionist
      │
      ├── [Adverse Reaction?] ── yes ──► stop, AdverseReaction record (febrile/allergic/AHTR/TACO/TRALI),
      │                                   return bag + sample to lab, haemovigilance report (NACO/NBTC)
      ▼ no
[Transfusion Complete]  unit status → transfused (terminal); outcome + post-Hb logged
```

**The issue gate (single most important rule):** `issueUnit()` must reject unless
`unit.status == reserved-for-this-patient` AND a **compatible** `CrossMatch` exists for
`(unit, patient)` AND unit is non-expired AND all mandatory tests passed. Emergency
override requires explicit reason + authoriser + retrospective cross-match task.

---

### 1.7 Blood disposal workflow

```
Disposal trigger:
  • Expired units (FEFO/auto-expire job)
  • Damaged (leak, clot, haemolysis, breakage)
  • Contaminated (visible/cultured)
  • Failed testing (TTI reactive / group discrepancy unresolved)
  • Temperature-excursion beyond tolerance

[Flag for Disposal]  unit.status → pending_disposal, reason code, quarantine fridge
      │
      ▼
[Disposal Authorisation]  blood-bank officer signs off; second check for TTI-reactive
      │
      ▼
[Segregation]  biomedical waste category (yellow bag, infectious), per BMW Rules 2016
      │
      ▼
[Disposal Execution]  method (autoclave→incinerate / deep burial / CBWTF handover),
      │                date, quantity, witness, BMW manifest #
      ▼
[Disposal Record]  immutable DisposalRecord row → feeds wastage analytics + audit
                   unit.status → discarded (terminal)
```

Wastage % (discarded / collected) and TTI-positivity rate are board-level + NABH KPIs.

---

### 1.8 Blood recall / look-back workflow (the auditor's exam question)

Triggered when a **previously released donor is later found reactive** (next donation, or
a recipient's post-transfusion infection investigation, or kit recall).

```
[Recall Initiation]  trigger: donor reactive on later donation / recipient seroconversion / kit lot recall
      │
      ▼
[Traceability — backward & forward]
      │   from donor → all past Donations → all BloodUnits → all child Components
      │   → for each: where is it now? (in-stock / issued / transfused / discarded)
      ▼
[Quarantine in-stock units]  any still available/reserved from this donor → freeze immediately
      │
      ▼
[Recipient Identification]  for transfused units → resolve to patient + treating doctor + ward/date
      │
      ▼
[Notifications]  alert treating doctors, blood-bank officer, infection-control;
      │           recipient recall for testing/counselling (NACO look-back protocol)
      ▼
[Audit Trail]  BloodRecall case file: trigger, scope, every unit's disposition, every
               notification, recipient outcomes, closure sign-off — fully immutable.
```

This is **impossible to retrofit** onto a CRUD app — it's why the schema (D5) is built
around the donor→donation→unit→component→issue→transfusion chain from day one.

---

# Deliverable 2 — Industry & open-source research

> Verdict up front: **nothing here is a drop-in for regulated Indian blood banking.**
> Use OpenMRS/Bahmni/OpenELIS as *interoperability references*, integrate with
> **e-RaktKosh** (mandatory reporting reality in India), and study **eProgesa/Bagmo**
> as the feature bar. Build the module natively.

| Project | URL | License | Stack / DB | API | Activity | Community | Prod use | Blood-bank fit | Suitability /10 |
|---|---|---|---|---|---|---|---|---|---|
| **OpenMRS** | github.com/openmrs · openmrs.org | MPL 2.0 + HD | Java/Spring, **MySQL/MariaDB** | REST + FHIR | Very active | Very large (global) | Yes, 6000+ sites | EMR platform; **no native blood bank**; would be a module build on a Java stack | 4 |
| **Bahmni** | github.com/Bahmni · bahmni.org | AGPL/MPL | OpenMRS+Odoo+**OpenELIS**+PACS, MySQL/Postgres | REST, Atom feeds | Active | Large (India/LMIC) | Yes (India, Africa) | Strong LIS + EMR; blood bank only via custom forms; heavy stack | 5 |
| **OpenELIS Global** | github.com/I-TECH-UW/OpenELIS-Global-2 | MPL 2.0 | Java, **PostgreSQL** | REST, FHIR/HL7 | Active | Moderate | Yes (national LIS, Haiti/Africa) | Best **lab** engine; some blood-bank variants exist; Java/Postgres | 6 (as LIS ref) |
| **GNU Health** | github.com/.../gnuhealth · gnuhealth.org | GPL v3 | **Python/Tryton**, PostgreSQL | XML-RPC/REST | Active | Moderate | Yes (hospitals, UN/LMIC) | HMIS + LIMS; no full ISBT blood bank; different stack | 4 |
| **ERPNext / Frappe Health** | github.com/frappe/health | GPL v3 | Python/Frappe, **MariaDB** | REST | Active | Large | Yes | Healthcare module, weak blood bank; ERP-coupled | 3 |
| **DHIS2** | github.com/dhis2 · dhis2.org | BSD-3 | Java, **PostgreSQL** | REST | Very active | Very large | Yes (national HMIS, 80+ countries) | **Aggregate reporting**, not transactional blood bank | 3 (reporting ref) |
| **OpenHospital (ISF)** | github.com/informatici/openhospital | GPL v3 | Java, **MySQL/MariaDB** | REST (core+api) | Active | Moderate | Yes (Africa) | Has a **blood module** (donor/stock) but basic, no ISBT/recall | 4 |
| **OpenClinic GA** | sourceforge openclinic | GPL | Java/JSP, MySQL | Limited | Low/maintenance | Small | Some (Africa) | Dated; basic blood stock; not a fit | 2 |
| **MediBoard / OpenXtrem** | gitlab/openxtrem | GPL | PHP, MySQL | SOAP/REST | Low | Small (FR) | Yes (France) | Full HIS incl. transfusion (FR rules); French ecosystem | 3 |
| **e-RaktKosh** | cdac.in / eraktkosh.in · APISetu | Govt (closed) | C-DAC stack | **APIs via APISetu** | Active (govt) | National (2800+ banks) | **Yes — national standard** | The system Indian banks *report to*. **Integrate, don't replace** | N/A — integrate |
| **Bagmo** | bagmo.in / bloodcentresoftware.com | Commercial | Cloud, RFID | Yes | Active | Commercial (India, Kerala) | Yes (Kerala traceability) | e-RaktKosh + NABH compliant, RFID. **Feature bar / buy reference** | N/A — buy |
| **eProgesa** (MAK-System/EGIS) | egis.com/eprogesa · mak-system.com | Commercial | Enterprise BECS | Yes (HL7) | Active | Large (national blood services) | **Yes — national blood services worldwide** | Gold-standard BECS. **Feature bar** | N/A — buy |
| GitHub student BBMS (sumitkumar1503 Django, Shridharshukl PHP, eBloodBank DRF, varunsardana, KSruthiVel, Guri10…) | github.com/topics/blood-bank-management | MIT/none | PHP/Django/MERN, MySQL | Minimal | Varies | Small | **No** | Donor list + stock counter; **no traceability/ISBT/recall/QC** | 1–2 |

**Why none of the OSS blood-bank repos qualify:** they model "donor + request + stock
number." They do **not** model the donation→unit→component parent/child tree, TTI release
gate, cross-match/compatibility records, bedside verification, temperature ledger,
disposal/BMW, or recall/look-back. Putting one behind a real transfusion is a patient-safety
and legal liability. They're fine as UI inspiration only.

**Integration complexity note:** every "serious" platform here is a *different language/DB*
(Java+MySQL, Python+Tryton, PHP). Bolting one onto your Node+Postgres+Prisma stack means
running and syncing a second system — *more* complexity than building native. Your Pharmacy
sub-module already proves you can build regulated inventory natively.

Sources: [e-RaktKosh (C-DAC)](https://www.cdac.in/index.aspx?id=product_details&productId=e-RaktKosh) · [e-RaktKosh APIs (APISetu)](https://directory.apisetu.gov.in/api-collection/eraktkosh) · [Bahmni Lab/OpenELIS](https://bahmni.atlassian.net/wiki/spaces/BAH/pages/32014586/Laboratory+Module) · [OpenELIS Global](https://github.com/I-TECH-UW/OpenELIS-Global-2) · [OpenHospital](https://github.com/informatici/openhospital) · [Bagmo](https://www.bagmo.in/) · [eProgesa (MAK-System)](https://mak-system.com/products/eprogesa/) · [GitHub blood-bank topic](https://github.com/topics/blood-bank-management)

---

# Deliverable 3 — Regulatory & compliance requirements

### India (the binding ones)

| Body | Role | What it forces on the software |
|---|---|---|
| **CDSCO + State Drug Controller** (Drugs & Cosmetics Act 1940 / Rules 1945, **Part XII-B & XII-C, Schedule F**) | **Licenses** the blood centre (Form 27C; license Form 28C). Blood is a "drug". | Mandatory record-keeping & registers, retention, label format, **no paid donors**, component manufacturing conditions, master/batch records. The legal floor. |
| **NBTC / NACO** (National & State Blood Transfusion Councils) | National standards, SOPs, haemovigilance, donor counselling, look-back | Donor selection/deferral criteria, mandatory TTI panel, donor notification/counselling of reactives, **haemovigilance (HvPI)** adverse-reaction reporting, look-back protocol. |
| **NABH** (Blood Bank/Centre accreditation standards) | Quality accreditation hospitals demand | Documented SOPs, **traceability**, QC logs (equipment/reagent/temperature), competency records, internal/external audits, indicator tracking (wastage %, TTI rate, reaction rate, turnaround). |
| **e-RaktKosh (MoHFW/C-DAC)** | National BBMS / reporting portal (2800+ banks) | De-facto mandatory **stock + transaction reporting**; you must be able to **push/sync** donor, stock, issue data (APISetu APIs). Design for it. |
| **BMW Rules 2016** (Biomedical Waste) | Disposal of blood/components | Disposal records, category segregation, CBWTF manifests. |
| **DPDP Act 2023** | Data protection | Consent, purpose limitation, data minimisation (esp. **Aadhaar — store hash/last-4, never raw**), retention, breach handling, audit. |

### International (target if exporting / NABH-plus / research / cell therapy)

| Body | What it adds |
|---|---|
| **AABB Standards** | The global blood-bank quality bar: SHALL-statements on identity, testing, labelling, issue, QC, traceability, validation. |
| **US FDA (21 CFR 606/610/630/640; 211)** | **BECS = regulated medical-device-class software**; donor eligibility, testing, look-back (610.46/.47), labelling, biologics cGMP. The "software must be validated" mandate. |
| **WHO** | Blood safety framework, GMP for blood establishments, model donor criteria (reference for LMIC). |
| **ISBT 128 (ICCBBA)** | Global identification/labelling standard — DIN, product description codes, ABO/Rh, expiry; **Code 128** barcodes + Data Matrix. (Full detail in D9.) |
| **EU GMP Annex / Council Directives** (if EU) | Haemovigilance, traceability 30 years, batch release. |

### Cross-cutting software requirements these impose

- **Audit requirements:** *immutable, append-only* audit of every safety-critical action —
  who/what/when/old→new — for **release, issue, cross-match, disposal, recall, deferral,
  result verification**. No hard deletes on clinical records (soft-delete + reason).
- **Labelling standards:** ISBT 128 DIN + ABO/Rh + product code + expiry + "properly
  identify the donor unit" + cross-match/compatibility tag at issue. Eye-readable + barcode.
- **Traceability standards:** full **vein-to-vein** both directions; every unit reconstructable
  to donor, tests, components, fridge, recipient — on demand, for an auditor, in seconds.
- **Record retention:** plan for the **longest** applicable — many jurisdictions require
  donor/unit/transfusion records **30 years** (look-back can reach back decades). Design
  archival, never destructive purge, for clinical chains. (India registers: multi-year;
  align to the strictest.)
- **Validation:** BECS must be *validated* (IQ/OQ/PQ, test evidence) — implies a documented
  test suite + change control. Build CI tests for the safety gates as audit evidence.

Sources: [NBTC standards (MoHFW)](http://nbtc.naco.gov.in/page/bloodbankstandard/) · [CDSCO blood-bank guidelines](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2018/UploadBloodBank/guidelines_for_blood_bank.doc) · [D&C Rule 122 blood-bank amendment](https://cdsco.gov.in/opencms/resources/UploadCDSCOWeb/2022/drug_rules/DR_G.S.R.%20245(E)%20dt_05.04.1999_Amendment%20to%20Rule%20122_Requirements%20of%20blood%20bank.pdf) · [ISBT 128 standard (ICCBBA)](https://iccbba.org/our-standard/) · [ISBT 128 overview (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3012209/)

---

# Deliverable 4 — Enterprise module breakdown

```
Blood Bank / Blood Centre
│
├── Donor Management
│   ├── Donor Registry (identity, demographics, blood group, donor#)
│   ├── Donor Screening (questionnaire, physical/Hb/vitals)
│   ├── Medical History & Risk Assessment
│   ├── Eligibility Engine (interval, deferral, thresholds)
│   ├── Deferral Management (temporary / permanent, reason codes)
│   ├── Consent Management (versioned, e-sign)
│   ├── Donor Notification & Counselling (reactive donor, NACO ICTC referral)
│   ├── Repeat-Donor & Loyalty (tier, next-eligible, rare registry)
│   └── Donor Retention / Campaigns (WhatsApp recall, thank-you, certificates)
│
├── Donation & Appointment Management
│   ├── Appointment Booking (slots, camp vs centre)
│   ├── Walk-in Registration
│   ├── Donation Session lifecycle
│   └── Donor Adverse-Event (donor-side reactions)
│
├── Blood Camp / Drive Management
│   ├── Camp Planning (organiser, venue, target, staff roster)
│   ├── Mobile Collection (offline-capable)
│   ├── Camp Inventory Reconciliation
│   └── Camp Performance Analytics
│
├── Blood Collection
│   ├── Bag Assignment (type → component capability, anticoagulant)
│   ├── DIN / Barcode Generation (ISBT 128)
│   ├── Phlebotomy & Volume Verification
│   └── Blood Unit Creation
│
├── Blood Testing (TTI + Immunohematology)
│   ├── Sample Receipt & Acceptance
│   ├── Blood Grouping (ABO/Rh, weak-D, antibody screen)
│   ├── TTI Panel (HIV/HBsAg/HCV/Syphilis/Malaria/NAT)
│   ├── Result Entry & Analyzer Integration (reuse MachineResultsQueue)
│   ├── Verification & Approval (two-person)
│   ├── Quarantine & Rejection
│   └── Reagent/Kit Lot & QC tracking
│
├── Component Separation / Processing
│   ├── Separation Orders (single/double/triple/quad, apheresis)
│   ├── Component Creation (parent→child unit tree)
│   ├── Irradiation / Leucodepletion / Aliquoting (modifications)
│   └── Component Yield QC
│
├── Inventory & Storage Management
│   ├── Stock Ledger (append-only, FEFO)
│   ├── Storage Devices (fridge/freezer/agitator) + set-points
│   ├── Temperature Monitoring (manual + IoT) & Alarms
│   ├── Expiry Management & Auto-expire
│   ├── Quarantine / Reserved / Emergency buckets
│   └── Transfers (intra/inter-branch, inter-hospital, cold-chain)
│
├── Blood Requests & Cross-Match
│   ├── Request Intake (ward/OT/emergency, MTP)
│   ├── Recipient Grouping & Antibody Screen
│   ├── Cross-Match (serological / electronic)
│   ├── Compatibility Verification & Allocation/Reservation
│   └── Emergency / Uncrossmatched issue register
│
├── Transfusion Management
│   ├── Issue / Dispense (with compatibility label)
│   ├── Bedside Two-Person Verification (barcode)
│   ├── Transfusion Monitoring (vitals timeline)
│   ├── Adverse Reaction / Haemovigilance
│   └── Return / Re-issue handling
│
├── Disposal & Wastage
│   ├── Disposal Flagging (expired/damaged/contaminated/reactive)
│   ├── Authorisation & BMW Segregation
│   └── Disposal Records & Manifests
│
├── Recall & Look-back
│   ├── Recall Case Management
│   ├── Backward/Forward Traceability Engine
│   ├── Recipient Identification & Notification
│   └── Closure & Audit
│
├── Quality Control & Compliance
│   ├── Equipment QC & Calibration Logs
│   ├── Reagent/Kit Lot Management
│   ├── SOP / Document Control
│   ├── Indicators (wastage %, TTI rate, reaction rate, TAT)
│   ├── e-RaktKosh Reporting / Sync
│   └── NABH/NACO Audit Reports
│
├── Billing Integration (processing/service charges, replacement, camps)
│
├── Reporting & Analytics (Management / Operations / Compliance — see D10)
│
├── Audit Logs (immutable, safety-critical actions)
│
└── Administration (master data: components, deferral reasons, test panels,
    storage devices, bag types, fee config, RBAC roles)
```

---

# Deliverable 5 — Database architecture (PostgreSQL / Prisma)

Designed to **match your existing conventions**: `cuid()` IDs, `organizationId` on every
model with `@@index`, string status fields with inline enum comments (as you do in
`PharmacyBatch`), `Float` money / `Int` quantities, and an **append-only ledger** exactly
like your `StockLedger`. New models live in `schema.prisma` and relate back to existing
`Organization`, `User`, `Patient`, `Department`, `Invoice`, `MachineResultsQueue`.

### 5.1 ER overview (the traceability spine)

```
Organization 1───* Donor 1───* DonorDeferral
                     │
                     1
                     │*
                  Donation *───1 DonationCamp        DonationAppointment *───1 Donor
                     │                                          
                     1 (whole blood / apheresis session)
                     │
                  BloodUnit (parent, whole blood) 1───* BloodUnit (child components)  [parentUnitId self-FK]
                     │  │                                   │
                     │  1───* ScreeningTest (TTI)           1───* TemperatureLog (via storage)
                     │  1───1 BloodGroupResult              │
                     │  *───1 BloodStorage (current fridge) │
                     │                                      │
                     │                              BloodStockLedger *───1 BloodUnit (append-only)
                     │
                     │* (when issued)
                  BloodRequest 1───* CrossMatch *───1 BloodUnit
                     │  │  *───1 Patient                 │
                     │  │  *───1 User (doctor)           │
                     │  1───* BloodIssue 1───1 BloodUnit │
                     │            │                       
                     │            1───0..1 Transfusion 1───0..1 AdverseReaction
                     │
                  BloodRecall *───* BloodUnit (recalled)  +  *───* Patient (recipients)

QualityControl, DisposalRecord, BloodBankAudit  →  reference BloodUnit / device / user
```

### 5.2 Prisma models (drop-in style)

> Abbreviated to the safety-critical fields + key constraints/indexes. Money = `Float`
> (matches your codebase), enums = string + inline comment (matches `PharmacyBatch.status`).
> Add the reverse relations on `Organization`, `User`, `Patient` as you wire them.

```prisma
// ============================================================
// BLOOD BANK — DONOR DOMAIN
// ============================================================

model Donor {
  id             String @id @default(cuid())
  organizationId String

  donorNumber    String   // human-readable, unique per org (e.g. DNR-2026-000123)
  // Identity — store privacy-safe ID, never raw Aadhaar
  fullName       String
  dateOfBirth    DateTime?
  gender         String   // male | female | other
  phone          String?
  email          String?
  bloodGroup     String?  // A+ A- B+ B- AB+ AB- O+ O- | unknown  (confirmed at testing)
  idType         String?  // aadhaar | voter | dl | passport
  idLast4        String?
  idHash         String?  // sha256(salt+full id) for dedupe/look-up without storing raw

  donorType      String   @default("voluntary") // voluntary | replacement  (NOT paid — illegal)
  status         String   @default("active")    // active | deferred_temp | deferred_perm | blacklisted
  donorTier      String?  // bronze | silver | gold | platinum

  lifetimeDonations Int      @default(0)
  lastDonationDate  DateTime?
  nextEligibleDate  DateTime?

  // Linkage: a donor may also be a patient in this org
  patientId      String?

  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  createdById String?

  deferrals     DonorDeferral[]
  donations     Donation[]
  appointments  DonationAppointment[]

  @@unique([organizationId, donorNumber])
  @@index([organizationId])
  @@index([organizationId, phone])
  @@index([organizationId, bloodGroup])
  @@index([idHash])
}

model DonorDeferral {
  id             String @id @default(cuid())
  organizationId String
  donorId        String

  category   String    // temporary | permanent
  reasonCode String    // low_hb | recent_illness | travel_malaria | tattoo_6mo | high_risk | tti_reactive | medication | other
  reason     String?
  startDate  DateTime  @default(now())
  endDate    DateTime? // null = permanent
  deferredById String?

  createdAt  DateTime  @default(now())

  donor Donor @relation(fields: [donorId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([donorId])
  @@index([endDate])
}

model DonationCamp {
  id             String @id @default(cuid())
  organizationId String

  name        String
  organizer   String?
  venue       String?
  campDate    DateTime
  startTime   String?
  endTime     String?
  targetUnits Int?
  status      String   @default("planned") // planned | active | completed | cancelled

  createdAt   DateTime @default(now())
  createdById String?

  donations   Donation[]

  @@index([organizationId])
  @@index([campDate])
}

model DonationAppointment {
  id             String @id @default(cuid())
  organizationId String
  donorId        String

  scheduledAt DateTime
  donationType String  @default("whole_blood") // whole_blood | plateletpheresis | plasmapheresis | double_rbc
  status      String   @default("booked")      // booked | confirmed | arrived | completed | no_show | cancelled
  campId      String?

  createdAt   DateTime @default(now())

  donor Donor @relation(fields: [donorId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([donorId])
  @@index([scheduledAt])
}

// ============================================================
// DONATION & COLLECTION
// ============================================================

model Donation {
  id             String @id @default(cuid())
  organizationId String
  donorId        String

  din            String   // Donation Identification Number (ISBT 128) — the traceability root
  donationType   String   @default("whole_blood") // whole_blood | apheresis_*
  campId         String?
  appointmentId  String?

  // Screening snapshot at donation time (eligibility evidence)
  hemoglobin     Float?
  weightKg       Float?
  bpSystolic     Int?
  bpDiastolic    Int?
  pulse          Int?
  temperatureC   Float?
  eligibility    String   @default("eligible") // eligible | deferred

  // Collection
  bagType         String?  // single | double | triple | quad | apheresis_kit
  anticoagulant   String?  // CPDA1 | CPD | SAGM
  collectionStart DateTime?
  collectionEnd   DateTime?
  volumeMl        Int?
  phlebotomistId  String?
  collectionStatus String  @default("registered") // registered | in_progress | completed | aborted
  donorReaction   String?  // none | vasovagal | haematoma | other  (see DonorAdverseEvent for detail)

  consentVersion  String?
  consentSignedAt DateTime?

  createdAt   DateTime @default(now())
  createdById String?

  donor Donor          @relation(fields: [donorId], references: [id])
  camp  DonationCamp?  @relation(fields: [campId], references: [id])
  units BloodUnit[]
  screeningTests ScreeningTest[]

  @@unique([organizationId, din])
  @@index([organizationId])
  @@index([donorId])
  @@index([collectionStatus])
}

// ============================================================
// BLOOD UNITS & COMPONENTS  (parent→child tree)
// ============================================================

model BloodUnit {
  id             String @id @default(cuid())
  organizationId String
  donationId     String

  unitNumber     String   // ISBT 128 unit/segment id; child inherits DIN + component code
  parentUnitId   String?  // null = whole-blood parent; set = component child
  componentType  String   // whole_blood | prbc | platelet_rdp | platelet_sdp | ffp | cryo | plasma
  bloodGroup     String?  // confirmed at testing
  volumeMl       Int?

  collectedAt    DateTime
  expiresAt      DateTime // derived from componentType + collectedAt (35d PRBC, 5d platelet, 1yr FFP…)

  // Lifecycle — the heart of the gate
  status         String   @default("quarantine")
  // quarantine | testing | available | reserved | issued | transfused | separated | expired | discarded | recalled

  storageId      String?  // current BloodStorage device
  reservedForPatientId String?
  reservationExpiresAt DateTime?

  releasedAt     DateTime?
  releasedById   String?

  createdAt   DateTime @default(now())
  createdById String?

  donation     Donation     @relation(fields: [donationId], references: [id])
  parentUnit   BloodUnit?   @relation("UnitTree", fields: [parentUnitId], references: [id])
  childUnits   BloodUnit[]  @relation("UnitTree")
  storage      BloodStorage? @relation(fields: [storageId], references: [id])
  ledger       BloodStockLedger[]
  crossMatches CrossMatch[]
  issues       BloodIssue[]

  @@unique([organizationId, unitNumber])
  @@index([organizationId])
  @@index([organizationId, componentType, bloodGroup, status]) // inventory bucketing
  @@index([expiresAt])
  @@index([status])
  @@index([parentUnitId])
}

model BloodStorage {
  id             String @id @default(cuid())
  organizationId String

  name        String   // "Blood Fridge 1", "Platelet Agitator A"
  deviceType  String   // fridge | freezer | platelet_agitator | transport_box
  location    String?
  minTempC    Float    // alarm low
  maxTempC    Float    // alarm high
  setPointC   Float?
  status      String   @default("operational") // operational | maintenance | alarm | offline

  createdAt   DateTime @default(now())

  units           BloodUnit[]
  temperatureLogs TemperatureLog[]

  @@index([organizationId])
}

model TemperatureLog {
  id             String @id @default(cuid())
  organizationId String
  storageId      String

  temperatureC Float
  recordedAt   DateTime @default(now())
  source       String   @default("manual") // manual | iot_sensor
  isBreach     Boolean  @default(false)
  recordedById String?

  storage BloodStorage @relation(fields: [storageId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([storageId])
  @@index([recordedAt])
}

// Append-only stock movement ledger — mirrors your PharmacyStockLedger discipline.
model BloodStockLedger {
  id             String @id @default(cuid())
  organizationId String
  unitId         String

  changeType   String   // collect | release | reserve | unreserve | issue | transfuse | transfer | expire | discard | recall
  fromStatus   String?
  toStatus     String?
  fromStorageId String?
  toStorageId   String?
  reference    String?  // request/issue/recall id
  note         String?
  createdById  String?
  createdAt    DateTime @default(now())

  unit BloodUnit @relation(fields: [unitId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([unitId])
  @@index([createdAt])
}

// ============================================================
// TESTING
// ============================================================

model ScreeningTest {
  id             String @id @default(cuid())
  organizationId String
  donationId     String

  testType   String   // hiv | hbsag | hcv | syphilis | malaria | nat | abo_rh | antibody_screen
  method     String?  // elisa | rapid | clia | nat_id | nat_mp | serology
  result     String   // reactive | non_reactive | invalid | grey_zone | pending
  rawValue   String?  // analyzer OD/ratio
  kitLot     String?
  kitExpiry  DateTime?
  analyzerId String?  // FK-ish to MachineIntegration

  performedById String?
  performedAt   DateTime?
  verifiedById  String?
  verifiedAt    DateTime?
  status        String   @default("pending") // pending | performed | verified | rejected

  createdAt DateTime @default(now())

  donation Donation @relation(fields: [donationId], references: [id], onDelete: Cascade)

  @@index([organizationId])
  @@index([donationId])
  @@index([testType, result])
}

// ============================================================
// REQUEST → CROSS-MATCH → ISSUE → TRANSFUSION
// ============================================================

model BloodRequest {
  id             String @id @default(cuid())
  organizationId String

  requestNumber String
  patientId     String
  requestedById String   // doctor
  approvedById  String?
  wardId        String?

  componentType String   // prbc | platelet | ffp | cryo | whole_blood
  unitsRequested Int
  urgency       String   @default("routine") // routine | urgent | emergency | mtp
  indication    String?
  patientBloodGroup String?
  preHb         Float?

  status        String   @default("pending")
  // pending | approved | crossmatching | ready | partially_issued | issued | completed | cancelled

  invoiceId     String?  // link to existing Invoice for processing charges

  createdAt   DateTime @default(now())

  crossMatches CrossMatch[]
  issues       BloodIssue[]

  @@unique([organizationId, requestNumber])
  @@index([organizationId])
  @@index([patientId])
  @@index([status])
}

model CrossMatch {
  id             String @id @default(cuid())
  organizationId String
  requestId      String
  unitId         String

  method      String   // serological_ahg | immediate_spin | electronic
  result      String   // compatible | incompatible | pending
  antibodyScreen String? // negative | positive
  performedById String?
  performedAt   DateTime?
  verifiedById  String?
  expiresAt     DateTime? // cross-match validity (e.g. 72h)

  createdAt DateTime @default(now())

  request BloodRequest @relation(fields: [requestId], references: [id], onDelete: Cascade)
  unit    BloodUnit    @relation(fields: [unitId], references: [id])

  @@unique([requestId, unitId])
  @@index([organizationId])
  @@index([result])
}

model BloodIssue {
  id             String @id @default(cuid())
  organizationId String
  requestId      String
  unitId         String

  patientId      String
  issuedById     String
  issuedAt       DateTime @default(now())
  isEmergency    Boolean  @default(false) // uncrossmatched O-neg path
  retroCrossmatchDone Boolean @default(false)

  // bedside two-person verification
  bedsideVerifiedById1 String?
  bedsideVerifiedById2 String?
  bedsideVerifiedAt    DateTime?

  status String @default("issued") // issued | transfused | returned | wasted

  request BloodRequest @relation(fields: [requestId], references: [id])
  unit    BloodUnit    @relation(fields: [unitId], references: [id])
  transfusion Transfusion?

  @@index([organizationId])
  @@index([requestId])
  @@index([patientId])
}

model Transfusion {
  id             String @id @default(cuid())
  organizationId String
  issueId        String  @unique

  patientId      String
  startedAt      DateTime?
  endedAt        DateTime?
  volumeMl       Int?
  transfusionistId String?
  vitals         String?  // JSON: timeline [{t:0,bp,pulse,temp}, {t:15,...}]
  outcome        String   @default("ongoing") // ongoing | completed | stopped_reaction
  postHb         Float?

  createdAt DateTime @default(now())

  issue     BloodIssue @relation(fields: [issueId], references: [id])
  reaction  AdverseReaction?

  @@index([organizationId])
  @@index([patientId])
}

model AdverseReaction {
  id             String @id @default(cuid())
  organizationId String
  transfusionId  String  @unique

  reactionType String   // febrile | allergic | ahtr | dhtr | taco | trali | bacterial | other
  severity     String   // mild | moderate | severe | life_threatening | death
  onset        String?  // acute | delayed
  signsSymptoms String?
  management    String?
  reportedToHvPI Boolean @default(false) // NACO Haemovigilance reported
  investigationResult String?

  createdAt DateTime @default(now())

  transfusion Transfusion @relation(fields: [transfusionId], references: [id])

  @@index([organizationId])
}

// ============================================================
// DISPOSAL, RECALL, QC, AUDIT
// ============================================================

model DisposalRecord {
  id             String @id @default(cuid())
  organizationId String
  unitId         String

  reason       String   // expired | damaged | contaminated | tti_reactive | temp_excursion
  bmwCategory  String?  // yellow | red ...
  method       String?  // autoclave_incinerate | deep_burial | cbwtf
  manifestNo   String?
  authorisedById String?
  disposedById   String?
  disposedAt   DateTime @default(now())
  witnessId    String?

  @@index([organizationId])
  @@index([unitId])
}

model BloodRecall {
  id             String @id @default(cuid())
  organizationId String

  caseNumber String
  trigger    String   // donor_reactive_later | recipient_seroconversion | kit_lot_recall
  donorId    String?
  scope      String?  // JSON: affected DIN/unit ids
  status     String   @default("open") // open | investigating | recipients_notified | closed
  openedById String?
  closedById String?
  closedAt   DateTime?
  summary    String?

  createdAt DateTime @default(now())

  @@unique([organizationId, caseNumber])
  @@index([organizationId])
  @@index([status])
}

model QualityControl {
  id             String @id @default(cuid())
  organizationId String

  qcType     String   // equipment_calibration | reagent_qc | component_qc | temperature_audit
  subjectId  String?  // device/reagent/unit id
  parameter  String?
  expected   String?
  observed   String?
  result     String   // pass | fail
  performedById String?
  performedAt DateTime @default(now())

  @@index([organizationId])
  @@index([qcType])
}

// Immutable safety-critical audit (separate from your generic AuditLog if you want a
// blood-specific, never-deleted trail for release/issue/disposal/recall/deferral).
model BloodBankAudit {
  id             String @id @default(cuid())
  organizationId String

  entityType String   // blood_unit | blood_issue | cross_match | disposal | recall | deferral | screening
  entityId   String
  action     String   // release | issue | override | verify | discard | recall | defer
  actorId    String?
  beforeJson String?
  afterJson  String?
  reason     String?
  createdAt  DateTime @default(now())

  @@index([organizationId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

**Relationship notes / constraints that matter:**
- `BloodUnit.parentUnitId` self-relation is the **component tree** — recall walks it.
- `Donation.din` + `BloodUnit.unitNumber` are **unique per org** → ISBT identity.
- `CrossMatch @@unique([requestId, unitId])` — one XM verdict per (request, unit).
- `Transfusion.issueId @unique` + `AdverseReaction.transfusionId @unique` — 1:1 safety chain.
- Inventory bucket index `(componentType, bloodGroup, status)` powers the availability board.
- **No hard deletes** on `BloodUnit / BloodIssue / Transfusion / ScreeningTest / Disposal /
  Recall` — status transitions + `BloodBankAudit` only (retention/validation requirement).
- All `Float` for money to match your codebase; all status strings with inline enums to
  match `PharmacyBatch`/`StockLedger`.

---

# Deliverable 6 — API architecture (REST, Express + Prisma)

Mount under `/api/blood-bank` in `routes/index.js` behind `authenticate` + a new
`authorize()` matrix. Sub-routers mirror your existing per-module file layout
(`routes/bloodBank/*.js` → `controllers/bloodBank/*.controller.js` + zod `validations/`).

### 6.1 Endpoint map (representative; all org-scoped, all paginated where lists)

```
Donor
  POST   /blood-bank/donors                 register donor (+ dedupe by phone/idHash)
  GET    /blood-bank/donors?q&group&status  search/list
  GET    /blood-bank/donors/:id             profile + donation history + deferrals
  PATCH  /blood-bank/donors/:id
  POST   /blood-bank/donors/:id/screen      record screening → eligibility verdict
  POST   /blood-bank/donors/:id/defer       create deferral
  GET    /blood-bank/donors/:id/eligibility computed eligibility (interval/deferral/thresholds)

Appointments & Camps
  POST   /blood-bank/appointments           book
  GET    /blood-bank/appointments?date
  POST   /blood-bank/camps                   create camp
  GET    /blood-bank/camps/:id/summary       camp performance

Donation & Collection
  POST   /blood-bank/donations              start session (guards eligibility) → returns DIN
  PATCH  /blood-bank/donations/:id/collect  collection progress/volume
  POST   /blood-bank/donations/:id/complete creates BloodUnit(quarantine)
  POST   /blood-bank/donations/:id/adverse  donor adverse event

Testing
  GET    /blood-bank/testing/worklist       samples pending
  POST   /blood-bank/donations/:id/tests    enter results (batch)
  POST   /blood-bank/tests/:id/verify       second-person verify
  POST   /blood-bank/donations/:id/release  RELEASE GATE → units available (transactional)

Components
  POST   /blood-bank/units/:id/separate     parent→children, sets expiries
  POST   /blood-bank/units/:id/modify       irradiate/leucodeplete/aliquot

Inventory & Storage
  GET    /blood-bank/inventory?group&component  availability board (bucketed)
  GET    /blood-bank/inventory/expiring?days    FEFO expiry forecast
  POST   /blood-bank/units/:id/transfer
  GET    /blood-bank/storage                 devices + latest temp
  POST   /blood-bank/storage/:id/temperature log a reading (manual/IoT)

Requests / Cross-match / Issue / Transfusion
  POST   /blood-bank/requests               raise request
  POST   /blood-bank/requests/:id/approve
  GET    /blood-bank/requests/:id/compatible-units    candidates (ABO/Rh + stock)
  POST   /blood-bank/requests/:id/crossmatch          run XM on chosen units
  POST   /blood-bank/requests/:id/reserve
  POST   /blood-bank/requests/:id/issue               ISSUE GATE (compat+XM+bedside fields)
  POST   /blood-bank/issues/:id/bedside-verify        two-person scan
  POST   /blood-bank/issues/:id/transfuse             start/record transfusion
  POST   /blood-bank/transfusions/:id/reaction        adverse reaction + HvPI flag

Disposal / Recall / QC
  POST   /blood-bank/units/:id/dispose
  POST   /blood-bank/recalls                 open recall → auto-trace
  GET    /blood-bank/recalls/:id/trace       backward+forward chain + recipients
  POST   /blood-bank/qc

Reporting & Compliance
  GET    /blood-bank/reports/inventory|collection|utilization|wastage|tti-rate
  GET    /blood-bank/reports/traceability/:din    full vein-to-vein dossier (auditor view)
  POST   /blood-bank/eraktkosh/sync               push stock/transactions to e-RaktKosh
```

### 6.2 Example payloads (the two gates)

**Release gate** — `POST /blood-bank/donations/:id/release`
```jsonc
// request: {}  (no body — server recomputes from verified results)
// 200:
{ "released": true, "units": [
    { "unitNumber":"PRBC-A1234-26-0001","componentType":"prbc","status":"available","expiresAt":"2026-07-16" }
] }
// 409 (gate failed):
{ "error":"RELEASE_BLOCKED", "reasons":[
    {"test":"hcv","status":"reactive"}, {"test":"nat","status":"pending"} ] }
```

**Issue gate** — `POST /blood-bank/requests/:id/issue`
```jsonc
// request:
{ "unitId":"clx...", "isEmergency":false,
  "bedside": { "patientBarcode":"PAT-000987", "unitBarcode":"PRBC-A1234-26-0001",
               "verifiedById1":"usr_nurse","verifiedById2":"usr_doctor" } }
// 200:
{ "issueId":"cly...", "unit":{ "status":"issued" }, "compatibilityLabelUrl":"/labels/issue/cly..." }
// 422:
{ "error":"ISSUE_BLOCKED","reasons":["NO_COMPATIBLE_CROSSMATCH"] }  // or UNIT_EXPIRED / NOT_RESERVED / BARCODE_MISMATCH
```

### 6.3 Validation rules (zod, server-side — never trust UI)
- Donor: age 18–65, weight ≥ 45 kg, valid blood group enum, donorType ∈ {voluntary, replacement}.
- Donation start: donor has **no active deferral** and `today ≥ nextEligibleDate`, Hb/vitals within range — else 422 with reason.
- Release: every mandatory test verified+non_reactive AND ABO/Rh confirmed.
- Issue: unit reserved-for-this-patient, non-expired, compatible verified cross-match (or emergency-override with reason+authoriser), bedside two distinct users.
- Disposal/Recall/Override: require `reason` + authoriser role.

### 6.4 RBAC permission matrix

| Capability | Super Admin | BB Manager | BB Technician | Lab Technician | Doctor | Nurse | Receptionist | Auditor |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Donor register/screen | ✓ | ✓ | ✓ | – | – | – | ✓ (register) | R |
| Deferral create | ✓ | ✓ | ✓ | – | ✓ | – | – | R |
| Collection / donation | ✓ | ✓ | ✓ | – | – | – | – | R |
| Enter TTI/group results | ✓ | ✓ | – | ✓ | – | – | – | R |
| **Verify results / Release units** | ✓ | ✓ | – | ✓ (verify) | – | – | – | R |
| Component separation | ✓ | ✓ | ✓ | – | – | – | – | R |
| Inventory / transfer / temp log | ✓ | ✓ | ✓ | – | – | – | – | R |
| Raise blood request | ✓ | ✓ | – | – | ✓ | ✓ | – | R |
| Approve request | ✓ | ✓ | – | – | ✓ | – | – | R |
| Cross-match | ✓ | ✓ | – | ✓ | – | – | – | R |
| **Issue unit** | ✓ | ✓ | ✓ | – | – | – | – | R |
| Bedside verify | ✓ | – | – | – | ✓ | ✓ | – | R |
| Record transfusion / reaction | ✓ | ✓ | – | – | ✓ | ✓ | – | R |
| Dispose / Recall | ✓ | ✓ | – | – | – | – | – | R |
| Emergency override | ✓ | ✓ | – | – | ✓ | – | – | R |
| Reports / audit / traceability | ✓ | ✓ | R | R | R | – | – | **✓** |
| Admin/master data/RBAC | ✓ | ✓ | – | – | – | – | – | – |

`R` = read-only. Admin/super_admin bypass as in your existing `authorize()`. Add these
to your `Permission`/`RolePermission` scaffold tables (already in schema) + new roles
`blood_bank_manager`, `blood_bank_technician`, `auditor` (you already have `lab_tech`,
`doctor`, `nurse`, `receptionist`).

---

# Deliverable 7 — Frontend architecture (React + Vite + shadcn/ui)

Mirror your existing structure exactly: a `BloodBankPage` per role route, module
components under `components/blood-bank/`, reuse `components/common/` (PatientLookup,
RegisterPatientForm, Pagination, DateFilter, BulkImportDialog) and `components/ui/`.

```
frontend/src/
├── pages/BloodBankPage.jsx                 // tabbed shell (or sub-routes per role)
├── lib/roleConfig.js                       // add `bloodBank` module + role mappings
└── components/blood-bank/
    ├── BloodBankModule.jsx                 // shell + tab router + KPIs header
    ├── dashboard/
    │   ├── BloodBankDashboard.jsx          // availability board, expiry alerts, today's collection
    │   └── AvailabilityMatrix.jsx          // ABO/Rh × component grid (the iconic blood-bank screen)
    ├── donors/
    │   ├── DonorList.jsx  DonorRegisterForm.jsx  DonorProfile.jsx
    │   ├── ScreeningForm.jsx  EligibilityBadge.jsx  DeferralDialog.jsx
    │   └── DonorCard.jsx                    // printable/digital donor card (QR)
    ├── donation/
    │   ├── DonationSession.jsx  CollectionPanel.jsx  BagAssignment.jsx
    │   └── DinLabelPrint.jsx                // ISBT 128 label render/print
    ├── testing/
    │   ├── TestingWorklist.jsx  ResultEntryGrid.jsx  VerifyDialog.jsx
    │   └── ReleaseGatePanel.jsx             // shows pass/fail per test, Release button
    ├── components-sep/ComponentSeparation.jsx  UnitTree.jsx
    ├── inventory/
    │   ├── InventoryBoard.jsx  ExpiryForecast.jsx  UnitDetail.jsx (traceability timeline)
    │   ├── StorageDevices.jsx  TemperatureChart.jsx  TransferDialog.jsx
    ├── requests/
    │   ├── RequestList.jsx  RequestForm.jsx  CompatibleUnits.jsx
    │   ├── CrossMatchPanel.jsx  IssueDialog.jsx (bedside scan)
    │   └── TransfusionMonitor.jsx (vitals timeline)  ReactionDialog.jsx
    ├── camps/CampList.jsx  CampForm.jsx  CampSummary.jsx
    ├── recall/RecallCase.jsx  TraceabilityTree.jsx
    ├── qc/QcLogs.jsx  Calibration.jsx
    └── reports/BloodBankReports.jsx
```

**Workflow screens (the ones that matter):**
- **Availability Matrix** — the wall-board: rows = components, cols = ABO/Rh, cells = count
  + nearest-expiry colour. Live, the home screen for the whole department.
- **Release Gate panel** — per donation: green/red chips for each TTI + group; Release
  disabled until all green; one-click release writes units to inventory.
- **Issue/Bedside dialog** — scan patient wristband + unit barcode; mismatch = hard red
  block; two-user sign-off. Reuse your `BarcodeScanner.jsx`.
- **Unit Detail / Traceability timeline** — donor → tests → component split → fridge →
  reservation → issue → transfusion, as a vertical timeline (auditor-friendly).
- **Recall tree** — interactive parent→child unit tree with recipient leaves.

**KPI header components** reuse your dashboard/analytics patterns. **Reports** reuse
`ReportsModule` + `DateFilter`. **Bulk import** of legacy donors via your existing
`BulkImportDialog`/SheetJS pipeline.

---

# Deliverable 8 — Mobile application features (React + Capacitor)

Two distinct apps/sections off your existing `mobile-frontend/` (and a public donor app).

**Donor App (B2C, can be a separate public build):**
- Registration + e-KYC (ID type + selfie, no raw Aadhaar) → donor number.
- Appointment booking (centre/camp slots) + reschedule.
- **Eligibility tracker** — countdown to `nextEligibleDate`, "you can donate in 12 days".
- Donation history + lifetime impact ("3 lives helped").
- **Digital Donor Card** — QR (donor#) for fast check-in at camps; tier badge.
- Push/WhatsApp notifications (reuse your WhatsApp service): eligible-again, camp nearby,
  urgent need for their group, thank-you after donation.
- **Donation certificates** (PDF) auto-issued post-donation.
- Rare-group registry opt-in.

**Blood Bank Staff App (extend `mobile-frontend` Mobile* components):**
- **Camp collection mode** (offline-first via Capacitor storage; sync on reconnect) —
  register walk-ins, screen, assign bag/DIN, record collection.
- **Barcode scanning** (reuse `BarcodeScanner.jsx` / html5-qrcode + Capacitor camera) for
  DIN, units, patient wristbands.
- **Inventory lookup** — quick "do we have 2 O-neg PRBC?" availability check.
- **Blood issue / bedside verification** — scan unit + patient, two-person confirm at ward.
- Temperature spot-logging; transfer acknowledgement.
- Push alerts: expiring units, fridge temperature breach, urgent cross-match.

`MobileBloodDonor.jsx`, `MobileBloodInventory.jsx`, `MobileCollection.jsx`,
`MobileBloodIssue.jsx` + bottom-sheet flows matching your existing mobile sheet pattern.

---

# Deliverable 9 — Barcode & labelling architecture (ISBT 128)

**Adopt ISBT 128 (ICCBBA) — it is the global, regulated standard; do not invent your own
scheme** if there is any chance of cross-facility transfer (and for NABH credibility).

**What ISBT 128 mandates (the four core barcodes on a blood bag):**
1. **Donation Identification Number (DIN)** — 13 chars: 5-char ICCBBA **facility ID** +
   2-digit **year** + 6-digit **sequence** + flag/keyboard **check character** (boxed).
   This is your `Donation.din` and the root of every trace.
2. **ABO/RhD blood group** — coded data structure.
3. **Product Description Code** — what the unit *is* (PRBC/FFP/platelet, anticoagulant,
   volume, modifications like irradiated/leucodepleted). This changes per component child
   while the DIN is inherited.
4. **Expiration date (+ time for short-dated components like platelets).**

**Symbology:** linear barcodes **must be Code 128** per the ISBT 128 spec; you may add a
**Data Matrix (2D)** that packs all four data structures into one symbol (faster, less
label real estate). QR codes are fine for the **donor-facing** card/app check-in (not the
regulated bag label).

**Implementation recommendation:**
- **Registration to ICCBBA** for a real **Facility Identification Number** is required to
  emit standards-true DINs for inter-facility use. For internal MVP, generate a structurally
  valid DIN with a placeholder facility ID and a correct **ISO/IEC 7064 check character**,
  then swap in the registered FIN before go-live/transfer.
- **Generation:** a `isbt128.js` util in `backend/src/bloodBank/` — builds DIN, computes
  check char, encodes product/group/expiry data structures. Keep it isolated + unit-tested
  (this is validation evidence).
- **Encoding/printing:** `bwip-js` (server-side Code 128 + Data Matrix → PNG/SVG) rendered
  into label templates; print to **Zebra/TSC thermal label printers** (ZPL) common in Indian
  blood banks. Front-end label preview via the same images.
- **Scanning:** reuse your `BarcodeScanner.jsx` (html5-qrcode handles Code 128 + Data Matrix)
  + Capacitor camera on mobile; hardware USB/Bluetooth scanners act as keyboard wedge.
- **Verification on scan:** always recompute + validate the DIN check character before
  accepting input (the whole reason the check char exists).
- **Label content (eye-readable + barcode, per D&C/AABB):** DIN, ABO/RhD (large), component
  name, collection + expiry date/time, anticoagulant/additive, volume, storage temp,
  "FOR TRANSFUSION ONLY" / cross-match-pending state, facility name & license no. At issue,
  a **compatibility label** ties unit ↔ patient ID ↔ cross-match.

Sources: [ISBT 128 standard (ICCBBA)](https://iccbba.org/our-standard/) · [ISBT 128 a global information standard (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3012209/) · [ISBT 128 for Blood Components — Introduction 8th ed.](https://www.isbtweb.org/static/883b4072-a28f-4afe-995dcc102e0d2215/IN-003-ISBT-128-for-Blood-Components-An-Introduction-v8.pdf)

---

# Deliverable 10 — Reporting & analytics

Build on your existing `analytics`/`dashboard` controllers + `ReportsModule`. Three audiences:

**Management dashboard**
- Total donations (period, voluntary vs replacement, repeat vs first-time).
- **Blood availability matrix** (component × ABO/Rh, live) + days-of-supply per group.
- **Expiry forecast** (units expiring in 24h/3d/7d — platelet-critical).
- Camp performance (units/camp, yield, no-show %, cost/unit).
- Utilization metrics (issued vs collected, transfusion vs request, group-wise demand).
- Donor base growth, retention rate, rare-group registry size.

**Operations dashboard**
- Daily collection vs target; daily issues; pending cross-matches; testing worklist depth.
- **Inventory health** (available/reserved/quarantine/expired per group), reorder alerts.
- **Component yield** (components produced / whole-blood processed) — QC KPI.
- Turnaround times: collection→release, request→issue.
- Temperature-excursion incidents per device.

**Compliance dashboard / reports (auditor-facing)**
- **Traceability report** — input a DIN or patient → full vein-to-vein dossier (PDF).
- **Recall/look-back reports** — case list, affected units, recipients notified, closure.
- **TTI positivity rate** + discard/wastage % (NABH indicators).
- **Haemovigilance** — adverse-reaction register, rate, HvPI submission status.
- Donor deferral analysis; QC/calibration logs; **e-RaktKosh sync status** & reconciliation.
- Statutory registers (donor register, issue register, stock register) in D&C/NBTC format.

Every report is org-scoped, date-filtered, exportable (PDF/Excel via your SheetJS), and
read-restricted by RBAC (Auditor = read-all, others scoped).

---

# Deliverable 11 — Integration strategy with existing HMS

### Reuse (do NOT rebuild)
| Existing module | How the blood bank uses it |
|---|---|
| **Auth / RBAC / Multi-tenant** | New roles + `authorize()` matrix; every model `organizationId`-scoped. |
| **Patients** | Recipients = existing `Patient`. Donors *link* to a patient when applicable (`Donor.patientId`). Reuse `PatientLookup`/`RegisterPatientForm`. |
| **Laboratory** | TTI screening is conceptually lab work — **reuse the sample→result→verify lifecycle pattern** and `MachineIntegration`/`MachineResultsQueue` for analyzer auto-import. (Keep blood-bank tests in `ScreeningTest` for the release-gate semantics, but share analyzer plumbing.) |
| **Pharmacy** | **Direct template** — `BloodStockLedger` mirrors `StockLedger`; batch/expiry/FEFO, barcode scan (`BarcodeScanner.jsx`), `BulkImportDialog` for legacy donor/stock import all transfer over. |
| **Billing / Payments** | Processing/service charges, replacement-donation accounting, camp costs → existing `Invoice`/`Payment` (`BloodRequest.invoiceId`). |
| **Notifications / WhatsApp** | Donor recall, camp invites, certificates, urgent-need broadcasts, recipient recall, fridge-breach alerts — all via existing WhatsApp/notification service + templates. |
| **Analytics / Reports / DateFilter** | KPI + report scaffolding. |
| **Mobile** | Extend `mobile-frontend` for staff app; donor app reuses API + components. |
| **Consultations / IPD** | Doctor raises `BloodRequest` from a consultation/admission context; transfusion shows on patient timeline. |
| **Settings / Audit scaffold** | `Permission`/`RolePermission`/`AuditLog` tables already exist — wire blood-bank permissions + immutable `BloodBankAudit`. |

### New modules required (genuinely new)
Donor lifecycle + deferral/eligibility engine, donation/collection, **TTI release gate**,
component-separation tree, blood-specific storage + temperature ledger, request→**cross-match
→issue→bedside→transfusion** safety chain, adverse-reaction/haemovigilance, **disposal**,
**recall/look-back traceability engine**, ISBT 128 labelling, **e-RaktKosh sync**.

### Data flow between modules
```
Consultation/IPD ─raises─► BloodRequest ─► CrossMatch ─► Issue ─► Transfusion ─► Patient timeline
                                  │                                   │
                                  └─► Billing(Invoice) ◄──────────────┘ (processing charge)
Donor ─► Donation ─► ScreeningTest(↔Lab analyzers) ─► release ─► BloodUnit ─► Inventory
Inventory/Temp/Expiry ─► Notifications(WhatsApp) ; Recall ─► Notifications + Patient/Doctor
All safety actions ─► BloodBankAudit ; Stock/transactions ─► e-RaktKosh sync
```

### Migration strategy
1. **Additive Prisma migration** — new models only, zero changes to existing tables except
   adding reverse relations on `Organization`/`User`/`Patient`. Safe `prisma migrate`.
2. **Seed master data** per org: components, deferral reasons, TTI panel, bag types,
   storage devices, fee config, roles/permissions.
3. **Legacy import** — donors + current stock via `BulkImportDialog`/SheetJS (validate→commit,
   exactly like your medicine import). Backfill DINs structurally; flag for ISBT re-label.
4. **Phase behind a `bloodBank` module toggle** (you already have `modulesEnabled`) so it
   ships dark and enables per-tenant.
5. **e-RaktKosh reconciliation** before go-live for govt/regulated tenants.

### Multi-tenant considerations
- Every blood-bank model carries `organizationId` (+ composite uniques on `donorNumber`,
  `din`, `unitNumber`, `requestNumber` **per org**) — matches your existing tenancy.
- **No cross-tenant unit visibility** — except an explicit **inter-hospital transfer**
  workflow (regional blood-centre → hospital) which is a deliberate, audited move, not a
  shared table read.
- Per-tenant ISBT **facility ID**, label templates, fee config, enabled sub-features.
- Regional/National blood-centre tenants may run multiple branches → model branch as a
  `BloodStorage.location` / optional `branchId` dimension if needed later.

---

# Deliverable 12 — Final recommendation

### 1. Best open-source option
**None as a base to fork.** Use **OpenELIS Global** (Postgres, MPL) as a *reference* for
lab/TTI structure, **e-RaktKosh** as the *integration target* (mandatory in India), and
**eProgesa/Bagmo** as the *feature bar*. The student GitHub BBMS repos are UI inspiration
only — they lack the traceability/safety/regulatory core and would be liabilities.

### 2. Best enterprise architecture
**Native module inside the current HMS**: Node/Express + Prisma/Postgres + React, reusing
your multi-tenancy, RBAC, Patients, Lab analyzer plumbing, Pharmacy inventory/ledger/barcode,
Billing, Notifications, Mobile — adding the donor pipeline, the **two safety gates (release
+ issue)**, the component tree, the temperature/stock ledger, recall/look-back, and ISBT 128.
Architected around vein-to-vein traceability and append-only audit from day one.

### 3. Build vs Buy vs Integrate
- **Build (native): RECOMMENDED.** Lowest total complexity (one stack, one DB, one auth),
  deep HMS integration, full control of safety/compliance logic, reuse of ~70% substrate.
- **Buy (Bagmo/eProgesa):** fastest to compliance, but a second siloed system, integration
  tax, per-seat cost, weak coupling to your consultations/IPD/billing — consider only if a
  tenant *already mandates* a specific BECS.
- **Integrate (e-RaktKosh):** **do this regardless** — it's the national reporting fabric.
  It is *complementary* to building, not an alternative.
- **Fork OSS:** rejected — different stacks, immature blood-bank cores, validation burden
  exceeds building clean.

### 4. Estimated development effort
| Phase | Scope | Effort |
|---|---|---|
| **P0 Foundations** | Schema + migration, RBAC roles, master data, module toggle | 2–3 wks |
| **P1 Donor→Collection** | Donor lifecycle, eligibility/deferral engine, donation, DIN/ISBT labels | 3–4 wks |
| **P2 Testing + Release gate** | TTI/group entry, verify, analyzer import, release gate | 3 wks |
| **P3 Components + Inventory** | Separation tree, storage, temperature ledger, FEFO/expiry | 3 wks |
| **P4 Request→Transfusion** | Request, cross-match, **issue gate**, bedside, transfusion, reactions | 4 wks |
| **P5 Disposal + Recall** | Disposal/BMW, recall/look-back traceability engine | 2 wks |
| **P6 Reporting + e-RaktKosh + Mobile** | Dashboards, compliance reports, sync, donor/staff apps | 4–5 wks |
| **P7 Validation/Hardening** | Test suite as validation evidence, NABH audit dry-run, perf | 3 wks |
| **Total to NABH-auditable** | | **~5–7 months** |
| **MVP (P0–P3, internally usable)** | | **~10–12 weeks** |

### 5. Team size
4–5 senior people: 2 backend (Node/Prisma + domain), 1–2 frontend (React + mobile),
0.5 QA/validation, plus a **part-time blood-bank SME / transfusion-medicine consultant**
(non-negotiable — they sign off the clinical rules and NABH readiness) and a product/PM lead.

### 6. Risks
- **Patient-safety logic in code** — the release & issue gates *must* be transactional and
  test-covered; a bug here can kill. Mitigate: server-side guards only, exhaustive tests,
  SME sign-off, four-eyes on safety transitions.
- **Regulatory drift** (CDSCO/NBTC/NABH/e-RaktKosh formats change) — keep panels, deferral
  reasons, label formats, sync mappings **config-driven**, not hard-coded.
- **ISBT 128 facility registration** lead time — start ICCBBA registration early; ship MVP
  with structurally valid placeholder DINs.
- **Analyzer / e-RaktKosh integration** unknowns — spike early; reuse `MachineResultsQueue`.
- **Data retention/validation burden** (30-yr, BECS validation) — design archival + a
  documented test suite from P0; never hard-delete clinical chains.
- **Scope creep** (apheresis, tissue/cell therapy, NAT pooling) — phase explicitly.

### 7. Recommended roadmap
```
Now ──► P0 schema+RBAC+SME onboard ──► P1 donor/collection (+ISBT) ──► P2 release gate
   ──► P3 components/inventory/temp ──► [MVP: dark-launch one pilot tenant]
   ──► P4 request→issue→transfusion (safety chain) ──► P5 disposal/recall
   ──► P6 reports + e-RaktKosh sync + mobile donor/staff apps
   ──► P7 validation + NABH audit dry-run ──► GA per-tenant via modulesEnabled toggle
```
Start ICCBBA registration + e-RaktKosh API onboarding **in parallel from week 1**.

---

### Final architecture statement
Build the Blood Bank as a **first-class native HMS module** that treats every unit as a
**traceable, audited, gate-controlled asset from vein to vein**. Reuse your proven
multi-tenant + RBAC + Pharmacy-inventory + Lab-analyzer + Billing + WhatsApp + Mobile
substrate; add the donor pipeline, the two safety gates, the component tree, the
temperature/stock ledger, recall/look-back, and ISBT 128 labelling; and integrate
(not replace) **e-RaktKosh**. This yields a system that scales to thousands of donations
and transfusions a year, survives an NABH/CDSCO audit, and keeps patients safe — without
the integration tax and patient-safety risk of forking an immature open-source CRUD app.
