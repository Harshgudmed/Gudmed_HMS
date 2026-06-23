# Hospital Management System — Clean Client Diagram

> **How to turn this into an image for your client:**
> 1. Copy the code block below (everything between the ```` ```mermaid ```` lines).
> 2. Go to **https://mermaid.live**
> 3. Paste it on the left → a clean diagram appears on the right.
> 4. Click **Actions → PNG / SVG** to download a high-quality image to show the client.
>
> Because this uses **automatic layout**, the boxes will **never overlap** like the old image did.

---

## Diagram 1 — The Big Picture (recommended for the client)

```mermaid
flowchart TD
    ORG["🏥 ORGANIZATION<br/><small>One hospital / clinic<br/>Top parent of ALL data</small>"]

    PATIENT["🧑 PATIENT<br/><small>Registration & full 360° history</small>"]
    USER["👨‍⚕️ USER / STAFF<br/><small>Doctor, nurse, admin</small>"]
    DEPT["🏢 DEPARTMENT<br/><small>OPD, ward, lab, radiology</small>"]

    ORG --> USER
    ORG --> DEPT
    ORG --> PATIENT

    %% ---------- OPD LANE ----------
    subgraph OPD["🟦 OUTPATIENT FLOW (OPD)"]
        direction TB
        APPT["📅 APPOINTMENT<br/><small>Book with a doctor</small>"]
        CONS["🩺 CONSULTATION<br/><small>The doctor visit</small>"]
        LAB["🧪 LAB ORDER → LAB RESULT"]
        RAD["📷 RADIOLOGY ORDER → REPORT"]
        RX["💊 PRESCRIPTION → PHARMACY SALE"]
        INV["🧾 INVOICE → PAYMENT<br/><small>OPD billing</small>"]
        APPT --> CONS
        CONS --> LAB
        CONS --> RAD
        CONS --> RX
        CONS --> INV
    end

    %% ---------- IPD LANE ----------
    subgraph IPD["🟥 INPATIENT FLOW (IPD)"]
        direction TB
        ADM["🛏️ ADMISSION<br/><small>The inpatient hub</small>"]
        BED["🚪 BED / WARD<br/><small>Bed allocation</small>"]
        CARE["📋 VITALS / NOTES / MEDICINES<br/><small>Daily care records</small>"]
        IPDBILL["🧾 BILL → BILL PAYMENT<br/><small>IPD billing</small>"]
        ADM --> BED
        ADM --> CARE
        ADM --> IPDBILL
    end

    PATIENT --> APPT
    PATIENT --> ADM

    %% ---------- COLORS ----------
    classDef root fill:#1e3a8a,stroke:#1e3a8a,color:#fff,font-weight:bold;
    classDef patient fill:#dcfce7,stroke:#16a34a,color:#14532d,font-weight:bold;
    classDef core fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef opd fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a;
    classDef ipd fill:#fef2f2,stroke:#dc2626,color:#7f1d1d;

    class ORG root;
    class PATIENT patient;
    class USER,DEPT core;
    class APPT,CONS,LAB,RAD,RX,INV opd;
    class ADM,BED,CARE,IPDBILL ipd;
```

**One-line story to tell the client:**
> "Everything belongs to the **Organization**. Every patient has a single record. From there a patient flows **one of two ways** — Outpatient (blue: appointment → doctor → tests → bill) or Inpatient (red: admission → bed → daily care → bill). Clean and simple."

---

## Diagram 2 — Detailed Version (for technical reviewers)

```mermaid
flowchart TD
    ORG["🏥 ORGANIZATION"]:::root

    ORG --> USER["👨‍⚕️ User / Staff"]:::core
    ORG --> DEPT["🏢 Department"]:::core
    ORG --> PATIENT["🧑 PATIENT"]:::patient

    USER --> APPT
    DEPT --> WARD

    subgraph FRONT["Front Desk"]
        direction TB
        PRE["Pre-Triage"]
        QUEUE["Queue"]
        TRIAGE["Triage Assessment"]
    end
    PATIENT --> PRE
    PATIENT --> QUEUE
    PATIENT --> TRIAGE

    subgraph OPD["Outpatient (OPD)"]
        direction TB
        APPT["📅 Appointment"]:::opd
        CONS["🩺 Consultation"]:::opd
        LABO["🧪 Lab Order"]:::opd
        LABR["Lab Result"]:::opd
        RADO["📷 Radiology Order"]:::opd
        RADR["Radiology Report"]:::opd
        RX["💊 Prescription"]:::opd
        SALE["Pharmacy Sale"]:::opd
        INV["🧾 Invoice"]:::opd
        PAY["Payment"]:::opd
        APPT --> CONS
        CONS --> LABO --> LABR
        CONS --> RADO --> RADR
        CONS --> RX --> SALE
        CONS --> INV --> PAY
    end
    PATIENT --> APPT

    subgraph IPD["Inpatient (IPD)"]
        direction TB
        WARD["🏨 Ward"]:::ipd
        BED["🚪 Bed"]:::ipd
        ADM["🛏️ Admission"]:::ipd
        OCC["Bed Occupancy"]:::ipd
        VIT["Vitals Record"]:::ipd
        MED["Medication Admin"]:::ipd
        NOTE["Clinical Note"]:::ipd
        IBILL["🧾 Bill"]:::ipd
        IPAY["Bill Payment"]:::ipd
        WARD --> BED --> ADM
        ADM --> OCC
        ADM --> VIT
        ADM --> MED
        ADM --> NOTE
        ADM --> IBILL --> IPAY
    end
    PATIENT --> ADM

    classDef root fill:#1e3a8a,stroke:#1e3a8a,color:#fff,font-weight:bold;
    classDef patient fill:#dcfce7,stroke:#16a34a,color:#14532d,font-weight:bold;
    classDef core fill:#dbeafe,stroke:#2563eb,color:#1e3a8a;
    classDef opd fill:#eff6ff,stroke:#3b82f6,color:#1e3a8a;
    classDef ipd fill:#fef2f2,stroke:#dc2626,color:#7f1d1d;
```

---

## Why this is better than the old image

| Old image problem | Fixed here |
|---|---|
| Boxes overlapped (ADMISSION on DEPARTMENT, PHARMACY on records) | Auto-layout = **boxes never overlap** |
| Arrows crossed messily | Organized **top-to-bottom in lanes** |
| Hard to tell OPD from IPD | **Color-coded**: blue = OPD, red = IPD, green = patient |
| Looked cluttered | Clean, professional, presentation-ready |

> Tip: For the client meeting, use **Diagram 1** (big picture). Keep **Diagram 2** ready only if a technical person asks for detail.
