# Blood Bank & Blood Donation Management System — Research, Workflows & Compliance

> Deliverables 1–3 of the Blood Bank initiative: end-to-end clinical workflows,
> industry/open-source landscape research, and regulatory requirements (India + international).
> Companion document: [BLOOD_BANK_ARCHITECTURE.md](BLOOD_BANK_ARCHITECTURE.md) (modules, schema, APIs, roadmap).
> Researched & written: 2026-06-11.

---

# Executive Summary (read this first)

**Verdict: Build the module natively inside the existing HMS (Option C), borrow workflows — not code — from the industry, and integrate with e-RaktKosh (mandatory for Indian licensed blood centres).**

Why, in three sentences:

1. **No production-grade open-source blood bank exists in any stack, let alone Node/Prisma/React.**
   The serious systems (eProgesa, SafeTrace Tx, Bagmo, e-RaktKosh) are commercial or
   government-closed; everything on GitHub tagged "blood-bank" is student-project CRUD with
   zero quarantine logic, zero ISBT 128, zero traceability.
2. **A blood bank module is 70% state machine + audit trail, 30% UI** — and the existing HMS
   already has the hard parts: multi-tenant Prisma/Postgres, RBAC, the Laboratory module
   (TTI testing reuses it), Billing, Notifications/WhatsApp, barcode scanning, and an
   append-only ledger pattern (pharmacy `StockLedger`) that maps 1:1 to blood unit traceability.
3. **The differentiator is compliance, not features**: NBTC/CDSCO workflows, ISBT 128 labeling,
   quarantine-by-default inventory, 100% donation→transfusion traceability, and e-RaktKosh
   stock reporting. None of that is available to fork; all of it is specified well enough to build.

---

# Deliverable 1 — Enterprise Blood Bank Business Workflows

The single most important design rule, which every workflow below obeys:

> **A blood unit is GUILTY until proven innocent.** Every collected unit enters QUARANTINE
> and can only reach AVAILABLE through a recorded, two-person-verified chain of:
> grouping ✚ TTI screening ✚ component QC ✚ supervisor release. Every state transition is
> an immutable ledger event with who/when/why. This is what separates a blood bank system
> from a CRUD app.

## 1.1 Master state machine — the spine of the whole module

```
                            ┌─────────────────────────────────────────────────┐
                            │              BLOOD UNIT LIFECYCLE               │
                            └─────────────────────────────────────────────────┘

 COLLECTED ──► QUARANTINE ──► TESTING_COMPLETE ──► AVAILABLE ──► RESERVED ──► CROSSMATCHED ──► ISSUED ──► TRANSFUSED
     │              │                │                 │             │              │             │
     │              │                │                 │             │              │             ├──► RETURNED ──► (re-inspect)
     │              │                │                 │             │              │             │        │
     │              ▼                ▼                 ▼             ▼              ▼             ▼        ▼
     └────────► DISCARDED ◄──── (TTI reactive /   EXPIRED ◄──── (date passes   (crossmatch    RECALLED  AVAILABLE
                (collection      QC fail /         any time)     in any         incompatible             or DISCARDED
                 failure,        grouping                        non-terminal   → back to
                 underweight     discrepancy)                    state)         AVAILABLE)
                 bag, broken
                 cold chain)
```

Rules enforced in code, not convention:

* No transition skips QUARANTINE. Ever. Including emergency O-neg issue (that uses
  *emergency release* of an already-AVAILABLE unit, or a documented un-crossmatched issue —
  never an untested unit).
* Terminal states: `TRANSFUSED`, `DISCARDED`. `RECALLED` is terminal for the unit but spawns
  a look-back case.
* Every transition writes a `BloodUnitEvent` row (append-only) — this is the traceability ledger.
* Expiry is evaluated at read-time AND by a daily job (units auto-flip to `EXPIRED`,
  never silently issued).

## 1.2 Donor Lifecycle

```
   ┌──────────────┐   exists?   ┌────────────────┐
   │ Walk-in /    ├────────────►│ Donor Search   │── found ──► pull history, deferral check
   │ Camp / App   │             │ (phone/ID/DIN) │
   └──────────────┘             └──────┬─────────┘
                                       │ new
                                       ▼
   ┌────────────────────────────────────────────────────────────────────────┐
   │ 1. REGISTRATION   demographics, photo, govt ID (Aadhaar/PAN/passport), │
   │                   ABO/Rh if known, contact prefs, unique DonorNo       │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 2. DEFERRAL REGISTRY CHECK   automatic, before anything else:          │
   │      • permanent deferral? → polite refusal, log attempt               │
   │      • temporary deferral active? → show end-date, book future appt    │
   │      • interval rule: ≥90 days (M) / ≥120 days (F) since last whole-   │
   │        blood donation; ≥48h post-plateletpheresis (max 24/yr)          │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 3. DONOR QUESTIONNAIRE (DHQ)   NBTC-standard medical history form:     │
   │      illness, medication, surgery, tattoo/piercing (<12 mo → defer),   │
   │      high-risk behaviour, travel (malaria zone), pregnancy/lactation,  │
   │      vaccinations, dental work, alcohol <24h …                         │
   │      → answers stored verbatim + version of the questionnaire used    │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 4. PHYSICAL EXAMINATION (Medical Officer — legally required in India)  │
   │      age 18–65 · weight ≥45 kg (350 ml) / ≥55 kg (450 ml)              │
   │      Hb ≥12.5 g/dL (copper-sulphate or HemoCue, method recorded)       │
   │      BP 100–140 / 60–90 · pulse 60–100 regular · temp ≤37.5 °C         │
   │      arm inspection (venepuncture site, track marks)                   │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 5. ELIGIBILITY DECISION                                                │
   │      FIT → consent  │  TEMPORARY DEFER (reason + end date)             │
   │                     │  PERMANENT DEFER (reason; registry forever)      │
   ├────────────────────────────────────────────────────────────────────────┤
   │ 6. INFORMED CONSENT   digital/wet signature, language selection,       │
   │      includes TTI-testing consent + "inform me if reactive" election,  │
   │      counselling acknowledgement. Stored as immutable document.        │
   └────────────────────────────────────────────────────────────────────────┘

   Retention engine (runs nightly):
     • eligible-again reminders (day 91/121) via WhatsApp — reuse Notifications module
     • donation milestone badges/certificates (1st, 10th, 25th, 50th)
     • birthday / blood-shortage targeted campaigns by ABO group + pincode
     • rare-group registry (Bombay phenotype, Rh-null …) flagged for emergency call lists
```

**Deferral taxonomy** (drives the registry):

| Class | Examples | Action |
|---|---|---|
| Temporary | low Hb (3 mo), tattoo (12 mo), malaria treatment (3 mo), pregnancy (12 mo post-delivery), alcohol (24 h), antibiotics (varies) | auto-unblock at end date, reminder sent |
| Permanent | HIV/HBV/HCV positive, IV drug use, chronic cardiac/renal disease, epilepsy, malignancy | blocked forever, attempts logged |
| Self-deferral | confidential unit exclusion (CUE) post-donation | unit discarded silently, donor record marked |

## 1.3 Blood Collection Workflow

```
 Eligible donor ──► DONATION REGISTRATION
                     │  create Donation record, assign DIN (ISBT 128, 13-char)
                     │  print DIN label set (≥6 copies: bag, satellites, pilot tubes, DHQ, register)
                     ▼
                   BAG SELECTION & VERIFICATION
                     │  bag type: single(350/450) / double / triple / quadruple (CPDA-1 / CPD+SAGM)
                     │  scan bag lot barcode → record manufacturer, lot no, expiry  (recall-ready)
                     │  two-person check: DIN on bag == DIN on tubes == donor identity
                     ▼
                   PHLEBOTOMY
                     │  start time, phlebotomist ID, arm, scale/mixer ID
                     │  target volume: 350 ml ±10% or 450 ml ±10% (weight-based)
                     │  pilot samples drawn FROM THE LINE POUCH (EDTA + plain), same DIN
                     ▼
                   COMPLETION / TERMINATION
                     │  end time, actual volume (from bag weigher: g ÷ 1.053)
                     │  outcome: COMPLETE │ UNDERWEIGHT (<lower bound → mark unit DISCARD-pending,
                     │           still TTI-test the samples) │ ABORTED (vein failure, donor reaction)
                     ▼
                   DON