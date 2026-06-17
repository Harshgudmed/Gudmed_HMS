# Enterprise Ambulance & Emergency Medical Transport Management System — Architecture & Research

> Solution-architect blueprint for adding a **real-time EMS dispatch, GPS fleet-tracking, and
> ambulance-operations module** to the existing multi-tenant HMS.
> Scope target: AIIMS / Apollo / Medanta / Max / Fortis / Narayana / govt trauma centres /
> 108-style emergency response networks running BLS/ALS/ICU/neonatal fleets.
> Last updated: 2026-06-11.

---

## 0. Executive summary (read this first)

**Recommendation: BUILD the EMS/dispatch/operations domain natively in the HMS, but
INTEGRATE a purpose-built GPS telematics server (Traccar) rather than building device
ingestion yourself.** This is the first module in your series that is **not** a fit for
"pure build" — and the reason is one architectural fact:

> **Your current stack is request/response Express + Prisma. An ambulance system is
> fundamentally REAL-TIME and STATEFUL** — GPS pings every 5–10 s from dozens of vehicles,
> a dispatch board that must update on every operator's screen within a second, live ETAs,
> geofence events, and driver/medic apps streaming location. **This needs a transport layer
> your HMS does not have yet (WebSocket/SSE + a telematics ingestion pipeline + a
> time-series location store).** Pretending it's "Pharmacy with a map" is the trap.

So the design splits into **three tiers** with deliberately different technology:

1. **Telematics tier (integrate, don't build):** **Traccar** (open-source, AGPL, Java) — a
   battle-tested GPS server that already speaks **200+ device protocols** over TCP/UDP,
   computes geofence/overspeed/idle events, and exposes a **REST API + WebSocket** stream.
   Building device-protocol decoders from scratch is months of undifferentiated work. Run
   Traccar as a sidecar service; your HMS consumes its WebSocket/REST. (Mobile driver app
   can post positions to Traccar's OsmAnd/HTTP protocol too — no hardware needed for MVP.)
2. **Real-time tier (new in your stack):** a **Node "dispatch-realtime" service** (Socket.IO
   or `ws`) that fans out positions, dispatch state, and ETAs to dashboards and apps, holds
   the live dispatch board in memory (Redis-backed), and runs the allocation engine. This is
   genuinely new infrastructure — plan for it explicitly.
3. **System-of-record tier (build natively, your strength):** Express + Prisma + Postgres for
   everything transactional and auditable — fleet, drivers, trips, equipment, maintenance,
   billing, incidents, audit. This is exactly what you already do well, and it integrates
   1:1 with Patients/Billing/Blood Bank/Notifications.

**Routing/ETA:** use **Google Maps Directions/Distance-Matrix for live emergency ETAs**
(accuracy + live traffic matters when minutes are lives) with a **self-hosted OSRM/Valhalla**
fallback for high-volume, non-critical matrix queries (cost control — Google routing can run
thousands of ₹/month at fleet scale). Abstract behind a `RoutingProvider` interface.

**You already own ~50% of the substrate** — Patients (the EMS patient = a Patient/encounter),
Billing/Payments (trip billing → `Invoice`), Blood Bank (blood transport jobs), Notifications/
WhatsApp (ETA + dispatch alerts), Mobile (driver/medic apps), RBAC, Multi-tenant, Audit. The
**new** work is the real-time dispatch core, telematics integration, and fleet/equipment/
maintenance management.

**Effort:** ~5–7 months for a senior squad of 4–6 to production (the real-time + GPS tier is
what stretches it); dispatchable MVP (intake → allocate → live-track via Traccar → close trip)
in ~10–12 weeks. **Time-to-pickup is the product** — every design choice optimises the seconds
from call to wheels-rolling.

---

# Deliverable 1 — Enterprise ambulance workflow

### 1.1 Emergency request workflow (the golden-hour path)

```
 INTAKE                 DISPATCH                    EN-ROUTE / SCENE              HANDOVER
 ┌───────────────┐      ┌──────────────────────┐   ┌────────────────────────┐   ┌──────────────┐
 │ Call intake   │      │ Allocation engine     │   │ Live GPS track (Traccar│   │ Hospital     │
 │ (phone/app/   │ P1?  │ → nearest AVAILABLE   │   │  → realtime svc → board│   │ arrival      │
 │  108/walk-in) ├─────►│  capable unit (BLS/ALS│──►│ ETA recompute on traffic│─►│ ED handover  │
 │ Patient info  │      │  /ICU/neonatal)       │   │ Patient pickup confirm  │   │ + vitals     │
 │ Location (GPS │      │ Assign driver+medic   │   │ On-scene vitals/notes    │   │ Case closure │
 │  /address/    │      │ Notify crew (app/SMS) │   │ Transport begins         │   │ + billing    │
 │  what3words)  │      │ ETA to scene          │   │ Status: dispatched→      │   │ + ePCR lock  │
 │ Classify      │      │ Escalate if no unit   │   │ enroute→onscene→transport│   │              │
 └───────────────┘      └──────────────────────┘   └────────────────────────┘   └──────────────┘
        │                        ▲   │                                                   │
        └── EmergencyIncident ───┘   └── dynamic reassignment (breakdown/closer unit) ───┘
            (the case; 1 incident → 1+ trips)            Everything ─► AmbulanceAuditLog
```

**Trip status state machine** (the spine):
`requested → assigned → dispatched → enroute_to_scene → on_scene → patient_loaded →
transporting → at_destination → handover_complete → closed` (+ `cancelled`, `reassigned`,
`breakdown`, `diverted`). Each transition is timestamped — these timestamps **are** the
response-time KPIs (call→dispatch, dispatch→on-scene, on-scene→transport, total).

**Intake details:** caller/patient info (links to a `Patient` if known, else creates a
provisional one), **location capture** (device GPS lat/lng, reverse-geocoded address,
landmark, what3words optional), **emergency classification** (priority + chief complaint —
e.g. cardiac/trauma/obstetric/RTA), and required capability (BLS/ALS/ICU/neonatal) which the
allocation engine matches against fleet capability.

### 1.2 Non-emergency / scheduled transfer workflow

Same trip engine, different intake (scheduled, lower priority, planned route, often billed):

| Transfer type | Key handling |
|---|---|
| **Inter-hospital transfer** | sending + receiving facility, referral doc, accepting doctor, MoU/empanelment; ALS/ICU as clinical condition requires |
| **Home → hospital** | scheduled pickup, appointment linkage |
| **Hospital → home** | discharge linkage (reuse IPD discharge), mobility needs |
| **ICU transfer** | ICU ambulance + critical-care nurse/doctor, ventilator/monitor checklist, continuous vitals |
| **Neonatal transfer** | neonatal ambulance + transport incubator, paediatrician, warmer/O2 — links to Birth/NICU module |
| **Organ transport** | time-critical "green corridor", chain-of-custody, police coordination, geofenced priority route |
| **Blood transport** | links to **Blood Bank** module — cold-chain box, unit DINs manifest, temperature log on the trip |

Organ/blood transports are **cargo trips** (no patient, but a custody chain) — modelled as a
trip with `tripClass = logistics` and a manifest, reusing the same fleet/tracking/billing.

---

# Deliverable 2 — Ambulance fleet management

### 2.1 Ambulance types (capability tiers — drive allocation)
`bls | als | icu | neonatal | mortuary | ptv (patient transport vehicle) | air` — each with a
**capability profile** (equipment + staff it must carry) that the dispatch engine matches to
the incident's required capability. AIS-125 (National Ambulance Code) defines the build/spec;
staffing norms: BLS = EMT; ALS/ICU = critical-care nurse/doctor + EMT.

### 2.2 Vehicle management (the `Ambulance` master)
Registration no., **chassis/engine number**, make/model/year, ambulance type, ownership
(owned/contracted/108), home base/station, fuel type (diesel/CNG/EV), seating/stretcher
config, **GPS device id (links to Traccar device)**, and a **documents/compliance set** with
**expiry tracking + alerts**: insurance, PUC (pollution), **fitness certificate**, road tax,
permit, RC, AIS-125 conformity. Each document = a row with `expiryDate` → dashboard "expiring
in 30 days" + auto-grounding when a mandatory doc lapses (compliance gate — a vehicle with
expired fitness/insurance must not be dispatchable).

### 2.3 Fleet monitoring (Traccar-fed)
Real-time GPS position, **geofencing** (station, hospital, city zones — entry/exit events),
**route history** (polyline replay per trip), **distance tracking** (odometer + GPS-derived),
**fuel consumption** (fuel logs + optional fuel-sensor), **driver-behaviour** (overspeed,
harsh-braking/accel, cornering — Traccar computes these), **idle-time** monitoring. All of
these arrive as Traccar **events/positions** → your realtime service → dashboards + persisted
summaries for analytics (you don't store every 5-second ping forever — see D10 retention).

---

# Deliverable 3 — Driver & staff management

**Drivers** (`Driver`, linked to a `User`): profile, **driving licence (number, class, expiry)**,
defensive-driving/EMS-driving certification + expiry, badge/PSV, blood group, **shift
assignment**, **attendance** (clock-in/out, reuse if you have HR; else a `DutyRoster`),
**performance metrics** (trips, on-time %, harsh-driving score from Traccar, fuel efficiency,
complaints).

**Medical staff** (`MedicalStaff`, linked to `User`, role ∈ `emt | paramedic | nurse | doctor`):
**certifications (BLS/ALS/ACLS/PALS/NRP) with expiry**, duty roster, shift management,
emergency on-call assignments. The dispatch engine checks **crew certification currency** when
assigning to an ALS/ICU/neonatal unit (you can't send an unstaffed-for-level ambulance).

**Cross-cutting:** **expiry tracking is a first-class concern** — licences and certifications
gate assignability exactly like vehicle docs gate dispatchability. One unified
"compliance-expiry" engine drives alerts across drivers, staff, and vehicles.

---

# Deliverable 4 — Emergency dispatch center (the heart)

```
                          ┌──────────────── COMMAND CENTER DASHBOARD ─────────────────┐
                          │  Live map (all units) │ Emergency queue │ Active trips     │
                          └───────────────────────────────────────────────────────────┘
                                       ▲ (WebSocket fan-out: positions, queue, trip state)
                                       │
 New incident ─► [Emergency Queue] ─► [Priority Assignment] ─► [ALLOCATION ENGINE] ─► assign
   (P1 critical / P2 urgent /            (triage/ESI-like)        │
    P3 non-urgent / P4 scheduled)                                 ├─ filter: capability match (BLS/ALS/ICU/neonatal)
                                                                  ├─ filter: AVAILABLE + crew certified + compliant vehicle
                                                                  ├─ rank: nearest by ROAD ETA (not crow-flies) via routing provider
                                                                  ├─ tie-break: fewest active jobs, fuel, shift time left
                                                                  └─ propose → auto-assign (P1) or operator-confirm
                                       │
                  ┌────────────────────┼─────────────────────────┐
          [Dynamic Reassignment]  [Escalation Rules]      [Mutual Aid]
          closer unit frees / breakdown    no unit in X min → notify   borrow from partner
          / higher-priority preempts       supervisor; widen radius;   network / 108 / nearby
          → reassign + re-ETA              queue with timer            base
```

**Allocation engine design:** event-driven, runs in the realtime service against an in-memory
(Redis) view of unit states + last positions. Nearest = **road-network ETA** from the routing
provider, not Haversine (a unit across a river is "near" by crow-flies but 20 min by road).
P1 auto-assigns the best candidate instantly and notifies the crew; lower priorities present
ranked options to the operator. **Dynamic reassignment** continuously: if a closer unit frees
up before pickup, or the assigned unit breaks down, the engine re-proposes. **Escalation**:
configurable timers (no available unit / crew not acknowledging) escalate to supervisor, widen
search radius, or trigger **mutual-aid** to partner networks. Every decision is logged
(`DispatchAssignment` history) for the emergency-response audit.

---

# Deliverable 5 — GPS & live-tracking architecture

**Recommendation: Traccar as the telematics backbone + a `RoutingProvider` abstraction for
ETA/route, fed into your new realtime service.**

```
 GPS hardware (ambulance OBD/GPS) ──TCP/UDP (200+ protocols)──┐
 Driver mobile app (Capacitor) ─────HTTP/OsmAnd protocol──────┤
                                                              ▼
                                                  ┌────────────────────┐
                                                  │   TRACCAR server    │  (sidecar, Java)
                                                  │  decode • geofence  │
                                                  │  • events • store   │
                                                  └─────────┬──────────┘
                                          REST + WebSocket (positions/events)
                                                            ▼
                                          ┌──────────────────────────────────┐
                                          │  HMS REALTIME SERVICE (Node/ws)   │
                                          │  • subscribe Traccar WS           │
                                          │  • map deviceId → Ambulance/Trip  │
                                          │  • compute live ETA (RoutingProv) │
                                          │  • Redis: live unit/trip state    │
                                          │  • fan-out Socket.IO to clients   │
                                          │  • persist trip summaries/events  │
                                          │    to Postgres (via Prisma)       │
                                          └───────┬───────────────┬──────────┘
                                       Socket.IO  │               │ Prisma
                                ┌─────────────────▼──┐      ┌─────▼───────────┐
                                │ Dashboards / Apps   │      │ Postgres (SoR)  │
                                │ (command center,    │      │ trips, GPS snap-│
                                │  driver, medic)     │      │ shots, route    │
                                └─────────────────────┘      └─────────────────┘
```

- **GPS devices:** any Traccar-supported tracker; **or** the driver app posts positions (no
  hardware needed to launch). Position cadence 5–10 s en-route, throttled when idle.
- **Route optimization & ETA:** `RoutingProvider` interface with two implementations —
  **Google Maps** (Directions + Distance Matrix, **live traffic**, for emergency ETAs) and
  **self-hosted OSRM/Valhalla** (free, unlimited, for bulk/non-critical matrix & route replay).
  Pick per use-case; Google routing at fleet scale is costly, so reserve it for live emergency
  legs. (Mapbox is a third option but recent search/keystroke pricing changes hurt the math.)
- **Live location streaming:** Traccar WS → realtime service → **Socket.IO rooms** (one per
  trip, one per tenant command-center) → browsers/apps. Sub-second board updates.
- **Geofencing:** define in Traccar (stations, hospitals, zones); entry/exit events flow
  through and auto-advance trip state (e.g. entering hospital geofence → `at_destination`).
- **Map integration (frontend):** **MapLibre GL** (open-source, no per-load fee) with OSM or
  Mapbox tiles; Google JS SDK only if you standardise on Google. Abstract the tile/map layer.
- **Storage strategy:** keep **raw high-frequency pings in Traccar** (it's built for it; set
  retention there); persist **down-sampled trip route + key event snapshots** in Postgres for
  audit/replay. Don't dump 5-second pings into your transactional DB forever.

Sources: [Traccar (open-source GPS server)](https://www.traccar.org/) · [Traccar API + WebSocket](https://www.traccar.org/traccar-api/) · [Resgrid Core (open-source CAD)](https://github.com/Resgrid/Core) · [OSM routing alternatives (OSRM/Valhalla)](https://zeorouteplanner.com/openstreet-maps-api/) · [Google Maps API pricing 2026](https://www.woosmap.com/blog/google-maps-api-pricing-breakdown)

---

# Deliverable 6 — Patient transport workflow (the ePCR)

The clinical record of the trip — an **electronic Patient Care Report (ePCR)**, NEMSIS-inspired
(US national EMS data standard; good field reference even though India has no mandate yet):

```
Pickup location + time ─► Patient condition on contact ─► Vitals timeline (serial) ─►
Interventions/drugs given ─► Transfer notes ─► Destination ─► Handover to receiving facility ─►
Receiving staff sign-off ─► Completion verification ─► ePCR locked (immutable)
```

- **Pickup/destination**: geocoded, timestamped, linked to facilities/`Patient`.
- **Patient condition**: chief complaint, GCS, triage category, provisional dx.
- **Vitals**: serial `TripVitals` rows (BP, HR, SpO2, RR, temp, GRBS, pain) — a timeline, not a
  single snapshot; charts on handover.
- **Interventions**: O2, airway, IV, CPR, defib, drugs (links to Pharmacy item ids for
  consumption + restock), each timestamped with the administering crew member.
- **Transfer/handover notes**: structured (SBAR-style); **digital handover** signed by both EMS
  crew and receiving ED nurse/doctor (two-party sign-off — the chain-of-care proof).
- **Completion verification**: receiving facility confirms patient received; trip → `handover_
  complete`; ePCR **locks** (edits only via addendum + audit).
- Feeds straight into the **ED/IPD encounter** (reuse Patients/Consultations) and **Billing**.

---

# Deliverable 7 — Ambulance equipment management

Each ambulance carries an **equipment + supplies inventory** — model it as a **per-vehicle
stock location reusing your Pharmacy inventory/`StockLedger` discipline** (you already built
append-only stock movements, batch/expiry, barcode scan — this is that pattern applied to a
moving "warehouse").

- **Medical equipment** (assets, not consumables): defibrillator, ventilator, oxygen cylinder
  (+ level), suction machine, cardiac monitor, infusion pump, transport incubator (neonatal) —
  each an `AmbulanceEquipment` asset with serial, calibration/service due date, working status,
  and a **pre-trip checklist** state (present + functional). A unit fails dispatch readiness if
  a mandatory asset for its tier is missing/non-functional/out-of-calibration.
- **Medical supplies** (consumables, expiry-tracked): emergency drugs, IV fluids, consumables,
  **PPE kits** — `EquipmentInventory` rows with quantity + **batch/expiry** (reuse Pharmacy
  `Batch`/expiry + barcode), per-vehicle par levels.
- **Usage logs**: consumption during a trip decrements stock (ledger row, links to ePCR
  intervention) → **replenishment workflow** when below par → indent to central Pharmacy
  store (reuse Purchase-Order/indent pattern). **Expiry tracking** mirrors pharmacy FEFO.
- **Readiness gate**: a unit is "available for dispatch" only when checklist passed + no
  expired critical supply + mandatory assets functional. This is the equipment analog of the
  vehicle-document and crew-certification gates.

---

# Deliverable 8 — Vehicle maintenance management

```
Preventive (schedule-driven: km or time) ──► due alert ──► work order ──► service ──► history
Breakdown (event-driven: on-trip failure) ──► ground unit + reassign trip ──► repair ──► back in service
```

- **Preventive maintenance**: rules by odometer/time (oil change, tyre rotation, brake check,
  AIS-125 fitness re-cert) → auto-generated `MaintenanceRecord` (scheduled) + dashboard.
- **Breakdown maintenance**: raised mid-trip → **immediately grounds the unit** (removes from
  dispatch pool) and triggers dynamic reassignment of any active trip; repair tracked.
- **Service history**: full per-vehicle log (date, odometer, type, vendor/garage, cost, parts).
- **Spare parts / tyre / battery / oil**: line items on the work order, linked to inventory +
  cost → feeds vehicle TCO analytics. Tyre & battery get their own replacement-interval tracking.
- **Status integration**: vehicle status (`available | on_trip | maintenance | breakdown |
  grounded_compliance`) is the single source the dispatch engine reads — maintenance and
  compliance both feed it. A vehicle in maintenance is never dispatchable.

---

# Deliverable 9 — Billing & revenue management

**Reuse the existing Billing/Payments module** — ambulance billing produces `Invoice` line
items via a pluggable **tariff engine**:

| Charge type | Basis |
|---|---|
| Distance-based | GPS-verified km × per-km rate (by ambulance type) |
| Zone/slab-based | flat fare by zone or distance slab |
| Emergency / priority | surcharge for P1 / night / emergency |
| Waiting charges | waiting time at scene/facility × rate |
| Toll charges | actual tolls on route (from route data) pass-through |
| Oxygen charges | O2 consumed (cylinder delta) |
| Equipment charges | ventilator/monitor/incubator usage per trip |
| Staff/level charges | ALS/ICU/doctor-escort premium |
| Consumables | drugs/supplies used (from ePCR → Pharmacy item prices) |

- **Tariff config per tenant** (govt 108 = free-to-patient but cost-accounted; private = full
  tariff) via `Organization.settings`. **Distance is GPS-verified** (anti-fraud — billed km
  ties to the recorded route, not the driver's claim).
- A trip → an `AmbulanceBilling` draft → posts to the existing `Invoice`/`Payment` flow
  (insurance/TPA, package, cash) — no parallel billing system.

---

# Deliverable 10 — Database architecture (PostgreSQL / Prisma)

Matches your conventions: `cuid()` IDs, `organizationId` + `@@index` everywhere, string status
with inline-enum comments, `Float` money, append-only ledgers/audit, JSON-as-string. New models
relate to existing `Organization`, `User`, `Patient`, `Invoice`, `PharmacyDrug`. **GPS pings
live primarily in Traccar**; Postgres stores trip-grade snapshots + summaries.

### 10.1 ER overview

```
Organization 1─* Ambulance ─* AmbulanceDocument (expiry)
                    │   │
                    │   1─* AmbulanceEquipment / EquipmentInventory (per-vehicle stock)
                    │   1─* MaintenanceRecord  1─* FuelLog
                    │   *─1 AmbulanceType (capability profile)
                    │
   EmergencyIncident 1─* AmbulanceTrip *─1 Ambulance
        │                   │  *─1 Driver  *─* MedicalStaff (crew)
        │                   │  1─* DispatchAssignment (history)
        │                   │  1─* TripStatusEvent (timestamped state machine)
        │                   │  1─* TripVitals / TripIntervention (ePCR)
        │                   │  1─* GpsSnapshot (down-sampled) + 1 RouteHistory (polyline)
        │                   │  1─0..1 AmbulanceBilling ─► Invoice (existing)
        │                   *─0..1 Patient (existing)
   Driver/MedicalStaff ─* ShiftAssignment        Everything ─► AmbulanceAuditLog (immutable)
```

### 10.2 Prisma models (drop-in; abbreviated to key fields)

```prisma
model AmbulanceType {
  id             String @id @default(cuid())
  organizationId String
  code           String  // bls | als | icu | neonatal | mortuary | ptv | air
  name           String
  requiredEquipment String? // JSON: mandatory assets for readiness
  requiredCrew      String? // JSON: {emt:1, nurse?:1, doctor?:1}
  baseFarePerKm     Float?
  @@unique([organizationId, code])
  @@index([organizationId])
}

model Ambulance {
  id             String @id @default(cuid())
  organizationId String
  typeId         String

  registrationNo String
  chassisNo      String?
  engineNo       String?
  make           String?
  model          String?
  year           Int?
  ownership      String  @default("owned") // owned | contracted | partner_108
  homeStation    String?
  fuelType       String? // diesel | cng | ev | petrol
  gpsDeviceId    String? // -> Traccar device id
  odometerKm     Int?    @default(0)

  status         String  @default("available")
  // available | on_trip | maintenance | breakdown | grounded_compliance | offline
  isActive       Boolean @default(true)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  type        AmbulanceType @relation(fields: [typeId], references: [id])
  documents   AmbulanceDocument[]
  equipment   AmbulanceEquipment[]
  inventory   EquipmentInventory[]
  maintenance MaintenanceRecord[]
  fuelLogs    FuelLog[]
  trips       AmbulanceTrip[]

  @@unique([organizationId, registrationNo])
  @@index([organizationId])
  @@index([status])
  @@index([gpsDeviceId])
}

model AmbulanceDocument {
  id             String @id @default(cuid())
  organizationId String
  ambulanceId    String
  docType        String   // insurance | puc | fitness | road_tax | permit | rc | ais125
  number         String?
  issuedDate     DateTime?
  expiryDate     DateTime
  fileUrl        String?
  isMandatory    Boolean  @default(true)

  ambulance Ambulance @relation(fields: [ambulanceId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ambulanceId])
  @@index([expiryDate])
}

model Driver {
  id             String @id @default(cuid())
  organizationId String
  userId         String?

  fullName        String
  phone           String?
  licenseNumber   String
  licenseClass    String?
  licenseExpiry   DateTime?
  emsCertExpiry   DateTime?
  bloodGroup      String?
  status          String  @default("active") // active | on_duty | off_duty | suspended
  @@unique([organizationId, licenseNumber])
  @@index([organizationId])
  @@index([licenseExpiry])
}

model MedicalStaff {
  id             String @id @default(cuid())
  organizationId String
  userId         String?

  fullName     String
  role         String  // emt | paramedic | nurse | doctor
  certifications String? // JSON: [{type:BLS|ALS|ACLS|PALS|NRP, expiry}]
  status       String  @default("active")
  @@index([organizationId])
  @@index([role])
}

model ShiftAssignment {
  id             String @id @default(cuid())
  organizationId String
  shiftDate      DateTime
  shiftType      String   // day | night | custom
  ambulanceId    String?
  driverId       String?
  medicalStaffId String?
  status         String   @default("scheduled") // scheduled | active | completed | absent
  @@index([organizationId])
  @@index([shiftDate])
}

model EmergencyIncident {
  id             String @id @default(cuid())
  organizationId String

  incidentNumber String
  source         String   // phone | app | 108 | walk_in | referral
  callerName     String?
  callerPhone    String?
  patientId      String?  // existing Patient if known
  chiefComplaint String?
  category       String?  // cardiac | trauma | rta | obstetric | respiratory | other
  priority       String   @default("p2") // p1 | p2 | p3 | p4
  requiredCapability String? // bls | als | icu | neonatal

  // location
  pickupLat   Float?
  pickupLng   Float?
  pickupAddress String?
  landmark    String?

  status     String @default("open") // open | dispatched | closed | cancelled
  reportedAt DateTime @default(now())
  closedAt   DateTime?

  trips AmbulanceTrip[]
  @@unique([organizationId, incidentNumber])
  @@index([organizationId])
  @@index([priority])
  @@index([status])
}

model AmbulanceTrip {
  id             String @id @default(cuid())
  organizationId String
  incidentId     String?
  ambulanceId    String
  driverId       String?
  patientId      String?
  invoiceId      String?

  tripNumber  String
  tripClass   String  @default("emergency") // emergency | transfer | scheduled | logistics
  transferType String? // inter_hospital | home_to_hosp | hosp_to_home | icu | neonatal | organ | blood

  // locations
  originLat Float?  originLng Float?  originName String?
  destLat   Float?  destLng   Float?  destName   String?
  receivingFacility String?

  // the timestamped state machine (KPIs derive from these)
  status        String  @default("requested")
  // requested|assigned|dispatched|enroute_to_scene|on_scene|patient_loaded|transporting|at_destination|handover_complete|closed|cancelled|reassigned|breakdown|diverted
  requestedAt   DateTime @default(now())
  assignedAt    DateTime?
  dispatchedAt  DateTime?
  onSceneAt     DateTime?
  loadedAt      DateTime?
  atDestAt      DateTime?
  handoverAt    DateTime?
  closedAt      DateTime?

  distanceKm    Float?
  etaMinutes    Int?

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  incident     EmergencyIncident? @relation(fields: [incidentId], references: [id])
  ambulance    Ambulance          @relation(fields: [ambulanceId], references: [id])
  assignments  DispatchAssignment[]
  statusEvents TripStatusEvent[]
  vitals       TripVitals[]
  interventions TripIntervention[]
  gpsSnapshots GpsSnapshot[]
  billing      AmbulanceBilling?

  @@unique([organizationId, tripNumber])
  @@index([organizationId])
  @@index([ambulanceId])
  @@index([status])
  @@index([requestedAt])
}

model DispatchAssignment {
  id             String @id @default(cuid())
  organizationId String
  tripId         String
  ambulanceId    String
  reason         String   // initial | reassign_closer | reassign_breakdown | escalation | manual
  proposedEtaMin Int?
  acceptedAt     DateTime?
  createdById    String?
  createdAt      DateTime @default(now())

  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([tripId])
}

model TripStatusEvent {
  id             String @id @default(cuid())
  organizationId String
  tripId         String
  fromStatus String?
  toStatus   String
  lat        Float?
  lng        Float?
  byUserId   String?
  source     String   @default("manual") // manual | geofence | app
  createdAt  DateTime @default(now())

  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([tripId])
}

model TripVitals {
  id             String @id @default(cuid())
  organizationId String
  tripId         String
  recordedAt DateTime @default(now())
  bpSystolic Int?  bpDiastolic Int?  heartRate Int?
  spo2 Int?  respRate Int?  temperatureC Float?  grbs Int?  gcs Int?
  recordedById String?
  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([tripId])
}

model TripIntervention {
  id             String @id @default(cuid())
  organizationId String
  tripId         String
  type       String   // oxygen | airway | iv | cpr | defib | drug | splint | other
  drugItemId String?  // -> PharmacyDrug (consumption)
  quantity   Float?
  givenAt    DateTime @default(now())
  givenById  String?
  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([tripId])
}

model GpsSnapshot {
  id             String @id @default(cuid())
  organizationId String
  tripId         String
  lat        Float
  lng        Float
  speedKmph  Float?
  headingDeg Int?
  recordedAt DateTime
  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([tripId])
  @@index([recordedAt])
}

model AmbulanceEquipment {
  id             String @id @default(cuid())
  organizationId String
  ambulanceId    String
  name        String   // defibrillator | ventilator | o2_cylinder | suction | monitor | infusion_pump | incubator
  serialNo    String?
  status      String   @default("functional") // functional | faulty | out_for_calibration | missing
  calibrationDue DateTime?
  lastCheckedAt  DateTime?
  ambulance Ambulance @relation(fields: [ambulanceId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ambulanceId])
}

model EquipmentInventory {
  id             String @id @default(cuid())
  organizationId String
  ambulanceId    String
  itemName   String   // drug/consumable/PPE
  drugItemId String?  // -> PharmacyDrug
  batchNumber String?
  expiryDate  DateTime?
  quantity    Int      @default(0)
  parLevel    Int?
  ambulance Ambulance @relation(fields: [ambulanceId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ambulanceId])
  @@index([expiryDate])
}

model MaintenanceRecord {
  id             String @id @default(cuid())
  organizationId String
  ambulanceId    String
  type        String   // preventive | breakdown | tyre | battery | oil | fitness
  status      String   @default("scheduled") // scheduled | in_progress | completed
  odometerKm  Int?
  scheduledFor DateTime?
  completedAt DateTime?
  vendor      String?
  partsJson   String?  // JSON line items
  cost        Float?
  notes       String?
  ambulance Ambulance @relation(fields: [ambulanceId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ambulanceId])
  @@index([status])
}

model FuelLog {
  id             String @id @default(cuid())
  organizationId String
  ambulanceId    String
  filledAt   DateTime @default(now())
  litres     Float
  cost       Float?
  odometerKm Int?
  filledById String?
  ambulance Ambulance @relation(fields: [ambulanceId], references: [id], onDelete: Cascade)
  @@index([organizationId])
  @@index([ambulanceId])
}

model AmbulanceBilling {
  id             String @id @default(cuid())
  organizationId String
  tripId         String @unique
  invoiceId      String?
  distanceKm     Float?
  baseFare       Float?
  distanceCharge Float?
  waitingCharge  Float?
  oxygenCharge   Float?
  equipmentCharge Float?
  tollCharge     Float?
  emergencySurcharge Float?
  consumablesCharge  Float?
  totalAmount    Float?
  tariffPlan     String?
  createdAt DateTime @default(now())
  trip AmbulanceTrip @relation(fields: [tripId], references: [id], onDelete: Cascade)
  @@index([organizationId])
}

model AmbulanceAuditLog {
  id             String @id @default(cuid())
  organizationId String
  entityType String   // trip | dispatch | ambulance | driver | maintenance | billing
  entityId   String
  action     String
  actorId    String?
  beforeJson String?
  afterJson  String?
  createdAt  DateTime @default(now())
  @@index([organizationId])
  @@index([entityType, entityId])
  @@index([createdAt])
}
```

**Constraints that matter:** trip status timestamps are explicit columns (KPI source);
`AmbulanceBilling.tripId @unique` (1:1); per-org unique numbers; equipment/inventory scoped to
a vehicle; **GpsSnapshot is down-sampled** (raw pings stay in Traccar); no hard deletes on
trips/incidents/billing — status + `AmbulanceAuditLog`.

---

# Deliverable 11 — API architecture (REST + WebSocket)

Mount `/api/ambulance` (REST, Express/Prisma) + a **realtime namespace** (Socket.IO/WS) for
live data. REST for commands & records; WS for streams.

```
Dispatch (REST)
  POST  /ambulance/incidents                 create incident (intake)
  POST  /ambulance/incidents/:id/allocate     run allocation engine -> proposed unit(s)
  POST  /ambulance/incidents/:id/dispatch      confirm assignment -> creates trip, notifies crew
  POST  /ambulance/trips/:id/reassign          dynamic reassignment
  POST  /ambulance/trips/:id/status            advance state machine (enroute/on_scene/...)
  POST  /ambulance/trips/:id/cancel

Tracking (WebSocket + REST)
  WS    /rt/ambulance        rooms: tenant:command-center, trip:{id}, ambulance:{id}
                             server->client: position, eta, trip_state, geofence_event, alert
  GET   /ambulance/trips/:id/route            persisted route polyline + snapshots (replay)
  GET   /ambulance/units/live                 snapshot of all units' last position/state

Fleet (REST)
  GET/POST/PATCH /ambulance/vehicles          fleet CRUD
  POST  /ambulance/vehicles/:id/documents      add doc (expiry)
  PATCH /ambulance/vehicles/:id/status         set maintenance/available
  GET   /ambulance/compliance/expiring?days=30 docs+licenses+certs due

Driver / Staff (REST)
  GET/POST /ambulance/drivers  /ambulance/staff
  POST  /ambulance/shifts                      roster
  POST  /ambulance/drivers/:id/attendance

Equipment / Maintenance (REST)
  GET/POST /ambulance/vehicles/:id/equipment   /inventory
  POST  /ambulance/vehicles/:id/checklist       pre-trip readiness
  GET/POST /ambulance/vehicles/:id/maintenance  /fuel

ePCR (REST)
  POST  /ambulance/trips/:id/vitals  /interventions
  POST  /ambulance/trips/:id/handover           two-party sign-off -> lock ePCR

Billing (REST)
  POST  /ambulance/trips/:id/billing            compute tariff -> draft
  POST  /ambulance/trips/:id/billing/post       -> existing Invoice
```

### 11.1 Example payloads (the dispatch core)

**Allocate** — `POST /ambulance/incidents/:id/allocate`
```jsonc
// 200:
{ "candidates": [
   { "ambulanceId":"clx...", "regNo":"DL1CAB1234", "type":"als",
     "etaMinutes":6, "distanceKm":3.2, "crewReady":true, "compliant":true },
   { "ambulanceId":"cly...", "type":"als", "etaMinutes":9, "distanceKm":5.1 } ],
  "autoAssigned": true,            // P1 auto-picks candidates[0]
  "recommended": "clx..." }
// 409: { "error":"NO_UNIT_AVAILABLE", "action":"escalated", "escalatedTo":"supervisor" }
```

**Advance status** — `POST /ambulance/trips/:id/status`
```jsonc
// request: { "toStatus":"on_scene", "lat":28.61, "lng":77.20, "source":"app" }
// 200: { "tripId":"...", "status":"on_scene", "onSceneAt":"2026-06-11T10:32:05Z",
//        "responseTimeSec": 372 }   // dispatch->on_scene KPI auto-computed
// 422: { "error":"INVALID_TRANSITION", "from":"requested", "to":"on_scene" }
```

### 11.2 Validation & security
- Status transitions validated against the state machine (no skipping `dispatched`→`closed`).
- Dispatch only assigns units that are `available` + compliant docs + crew-cert current +
  equipment-ready (the four gates) — enforced server-side.
- Vehicle with expired mandatory doc → not in candidate pool (compliance gate).
- WS auth: JWT handshake; tenant-scoped rooms (a tenant never sees another's units); driver
  app scoped to its own trips.
- Geolocation rate-limited; billing distance bound to recorded route (anti-fraud).
- Immutable `AmbulanceAuditLog` on every dispatch/status/billing action.

### 11.3 RBAC matrix
| Capability | Super Admin | Fleet Admin | Dispatcher | Driver | Medic (EMT/Nurse/Doctor) | Biller | Auditor |
|---|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| Intake / create incident | ✓ | ✓ | ✓ | – | – | – | R |
| Allocate / dispatch / reassign | ✓ | ✓ | ✓ | – | – | – | R |
| Advance trip status | ✓ | – | ✓ | ✓ (own) | ✓ (own) | – | R |
| Live tracking board | ✓ | ✓ | ✓ | own trip | own trip | – | R |
| Fleet/vehicle/doc mgmt | ✓ | ✓ | – | – | – | – | R |
| Driver/staff/roster | ✓ | ✓ | R | own | own | – | R |
| Equipment/maintenance/fuel | ✓ | ✓ | – | checklist | – | – | R |
| ePCR vitals/interventions/handover | ✓ | – | – | – | ✓ | – | R |
| Billing compute/post | ✓ | ✓ | – | – | – | ✓ | R |
| Reports / audit | ✓ | ✓ | R | – | – | R | ✓ |

New roles to add: `fleet_admin`, `dispatcher`, `ambulance_driver`, `ems_medic` (+ reuse
`doctor`/`nurse`), `auditor`.

---

# Deliverable 12 — Frontend architecture (React + Vite + shadcn/ui)

Mirror your module structure; add a **map layer (MapLibre GL)** and a **realtime hook**
(`useRealtime`) wrapping the Socket.IO client. Reuse `components/ui/*`, `DateFilter`,
`BarcodeScanner`.

```
frontend/src/
├── pages/AmbulancePage.jsx
├── lib/roleConfig.js                       // add `ambulance` module + roles
├── lib/realtime.js                          // Socket.IO client + useRealtime() hook
└── components/ambulance/
    ├── AmbulanceModule.jsx                  // shell + tabs + role-aware
    ├── command-center/
    │   ├── CommandCenter.jsx                // THE screen: live map + queue + active trips
    │   ├── LiveMap.jsx (MapLibre, unit markers, trip routes, geofences)
    │   ├── EmergencyQueue.jsx (priority-sorted, timers)
    │   └── AllocationPanel.jsx (candidate units + ETAs + assign)
    ├── dispatch/
    │   ├── IncidentIntakeForm.jsx (location picker, classify)
    │   ├── ActiveTrips.jsx  TripDetail.jsx (timeline + map + ePCR)
    ├── tracking/LiveTrackingDashboard.jsx  RouteReplay.jsx
    ├── fleet/
    │   ├── FleetDashboard.jsx  VehicleList.jsx  VehicleDetail.jsx
    │   ├── DocumentsExpiry.jsx (compliance board)  ChecklistDialog.jsx
    ├── drivers/DriverDashboard.jsx  StaffList.jsx  RosterCalendar.jsx
    ├── equipment/EquipmentBoard.jsx  InventoryExpiry.jsx
    ├── maintenance/MaintenanceDashboard.jsx  WorkOrder.jsx  FuelLog.jsx
    ├── billing/AmbulanceBilling.jsx (-> reuse Invoice)
    └── reports/AmbulanceReports.jsx
```

**Hero screen — Command Center**: a live MapLibre map of all units (colour by status), the
priority-sorted emergency queue with countdown timers, active-trip cards advancing in
real-time, and one-click allocate. Everything driven by `useRealtime()` (Socket.IO rooms).
**RouteReplay** scrubs a completed trip's polyline for audits. **DocumentsExpiry** and
**InventoryExpiry** are compliance boards (red/amber/green by days-to-expiry).

---

# Deliverable 13 — Mobile application features (React + Capacitor)

Reuse `mobile-frontend`; add **background geolocation** (Capacitor plugin) + the realtime
client + MapLibre.

**Driver app:**
- **Trip assignment** push (accept/ack) + emergency alert (loud, full-screen for P1).
- **Turn-by-turn navigation** (deep-link to Google Maps/launch in-app MapLibre route).
- **Live GPS sharing** — background location → posts to Traccar (OsmAnd protocol) / realtime
  service; works screen-off (the crucial reliability detail).
- **Status updates** — one-tap state advance (enroute / on-scene / loaded / transporting /
  arrived) with auto-geotag.
- **Patient pickup confirmation**; breakdown/SOS button.

**Medical staff app:**
- **Patient assessment** + **vitals recording** (serial, feeds `TripVitals`).
- **Interventions/drug** logging (decrement vehicle inventory).
- **Transfer notes** (SBAR) + **digital handover** with receiving-staff signature.

**Admin/supervisor app:**
- **Fleet monitoring** (live map, unit states), **dispatch monitoring** (queue, response
  timers), **analytics** snapshots, compliance/expiry alerts.

---

# Deliverable 14 — Reporting & analytics

Reuse `analytics`/`dashboard` + `ReportsModule` + `DateFilter`; many KPIs derive directly from
the trip status timestamps.

**Management:** fleet utilization (% time on-trip vs idle, trips/vehicle/day), **response-time
distribution** (call→dispatch, dispatch→on-scene, total — p50/p90), vehicle availability,
revenue analysis (by type/zone/payer), driver performance (on-time %, harsh-driving score,
trips, fuel efficiency).

**Operations:** active trips (live), delayed trips (over-ETA), maintenance due, fuel
consumption & cost, compliance-expiry pipeline, equipment-readiness failures.

**Emergency:** **average response time** (the headline EMS metric — target/benchmark vs
actual), **dispatch success rate** (incidents served vs unmet/escalated), critical-incident
(P1) analysis, geographic heatmap of demand, time-of-day demand curve for shift planning.

---

# Deliverable 15 — Compliance & audit

- **Complete audit trail**: immutable `AmbulanceAuditLog` on every dispatch decision, status
  change, reassignment, billing post, fleet/driver change (actor, time, before/after). Dispatch
  decisions especially — for medico-legal "why did it take 18 minutes" inquiries.
- **Driver compliance**: licence + EMS-cert validity gates duty assignment; expiry dashboard;
  duty-hours (fatigue) tracking.
- **Vehicle compliance**: insurance/PUC/fitness/permit/AIS-125 — **expired mandatory doc
  auto-grounds the vehicle** (can't be dispatched); audit of grounding events.
- **Medical-equipment compliance**: calibration/service due tracking; pre-trip checklist;
  expired critical supply blocks readiness.
- **Emergency-response audits**: full trip reconstruction — timeline + route replay + ePCR +
  dispatch decisions — exportable for regulators/insurers/court.
- **Legal record retention**: ePCR + trip + incident are clinical-legal records — retain per
  statute (years), never hard-delete; tenant export on offboarding. (Raw GPS pings in Traccar
  have a shorter retention; trip-grade snapshots persist.)

---

# Deliverable 16 — Integration strategy with existing HMS

### Reuse (don't rebuild)
| Existing module | Use |
|---|---|
| **Patients** | EMS patient = `Patient` (or provisional → merged at ED); ePCR feeds the encounter. |
| **Consultations / IPD / ED** | Handover flows into ED/IPD; inter-facility transfer links discharge/admission. |
| **Billing / Payments** | Trip tariff → `Invoice`/`Payment` (insurance/TPA/cash). |
| **Pharmacy** | Vehicle drug/consumable inventory reuses Pharmacy item master + `StockLedger`/expiry/barcode; interventions decrement stock + restock indents. |
| **Blood Bank** | Blood-transport trips carry unit DINs + cold-chain temp log; links the two modules. |
| **Birth/Neonatal** | Neonatal transfer ties to NICU/birth records. |
| **Notifications / WhatsApp** | Crew dispatch alerts, ETA-to-family, "ambulance arriving", compliance-expiry nudges. |
| **Mobile** | Driver/medic/admin apps extend `mobile-frontend`. |
| **Auth / RBAC / Multi-tenant / Audit / Analytics** | New roles + scoping + audit + dashboards. |

### New modules / infrastructure required
The **real-time dispatch service** (Socket.IO/ws + Redis), **Traccar telematics integration**,
the **allocation/ETA engine**, **`RoutingProvider`** (Google + OSRM/Valhalla), **MapLibre**
front-end map layer, **Capacitor background-geolocation**, and all the transactional fleet/
driver/equipment/maintenance/trip/ePCR/billing models. The real-time tier is the genuinely new
architectural capability for your stack.

### Data-flow architecture
```
Intake ─► EmergencyIncident ─► Allocation engine (realtime svc + RoutingProvider + Redis unit state)
   ─► AmbulanceTrip + DispatchAssignment ─► crew notified (Notifications/WhatsApp + app push)
GPS (Traccar) ─► realtime svc ─► Socket.IO ─► Command Center / apps ; geofence ─► auto trip-status
Trip ─► ePCR (vitals/interventions↔Pharmacy) ─► handover ─► ED/IPD encounter (Patients/Consult)
Trip ─► AmbulanceBilling ─► Invoice/Payment ; Blood/Organ trips ↔ Blood Bank
Everything ─► AmbulanceAuditLog ; KPIs ─► Analytics
```

### Multi-tenant design
- Every model `organizationId`-scoped; per-org unique numbers (incident/trip/registration);
  **WS rooms namespaced per tenant** (no cross-tenant unit/position leakage).
- **Traccar multi-tenancy**: map each tenant's devices to its org; filter the WS stream by the
  tenant's device set in the realtime service (Traccar groups/users per tenant).
- Per-tenant tariff plans, routing-provider keys, geofences, capability profiles via
  `Organization.settings` + `modulesEnabled` (`ambulance` toggle); ship dark per tenant.
- **Scaling**: realtime service horizontally scaled with a **Redis adapter** for Socket.IO
  (sticky sessions / shared pub-sub) so multiple instances share the live board.

### Migration strategy
1. Stand up **Traccar** + **Redis** + the **realtime service** as new infra (docker-compose /
   k8s) alongside the existing API. No change to existing HMS services.
2. **Additive Prisma migration** — new models only; add reverse relations on `Organization`/
   `User`/`Patient`/`Invoice`. Safe `prisma migrate`.
3. Seed master data per org: ambulance types/capability profiles, tariff plans, geofences,
   roles/permissions, routing keys.
4. **Legacy fleet import** via `BulkImportDialog`/SheetJS (vehicles, drivers, docs).
5. Phase behind the `ambulance` toggle; pilot one base/station; driver-app-as-GPS first (no
   hardware), add hardware trackers later.

---

# Deliverable 17 — Open-source & industry research

| Project | URL | License | Stack / DB | API / Realtime | Prod-ready | Community | Integration complexity | Use here |
|---|---|---|---|---|---|---|---|---|
| **Traccar** | github.com/traccar/traccar · traccar.org | Apache-2.0 | Java, **Postgres/MySQL** | **REST + WebSocket**, 200+ device protocols | **Yes — mature, widely deployed** | Large, active | Medium (run sidecar, consume API) | ⭐ **INTEGRATE as telematics tier** |
| **Resgrid Core** | github.com/Resgrid/Core · resgrid.com | Apache-2.0 | **.NET/C#**, SQL Server | REST, realtime, CAD/AVL/shift | Yes (powers resgrid.com) | Active | High (different stack/DB; whole platform) | Reference for CAD/dispatch UX; too heavy to embed |
| **Tickets CAD (Open ISES)** | sourceforge openises | GPL | Java desktop | Limited | Dated but used | Small/niche | High | CAD feature reference only |
| **WebEMS** | webems.sourceforge.net | Open source | PHP, MySQL | Minimal | Old (2009), **NEMSIS-compliant** | Dormant | High | ePCR/NEMSIS field reference |
| **OSRM** | github.com/Project-OSRM/osrm-backend | BSD-2 | C++, OSM data | HTTP routing | **Yes — very fast** | Large | Medium (self-host) | ⭐ Routing fallback (bulk/free) |
| **Valhalla** | github.com/valhalla/valhalla | MIT | C++, OSM | HTTP, matrix/isochrone/map-match | **Yes** | Large | Medium | ⭐ Routing alt (richer features) |
| **GraphHopper** | github.com/graphhopper/graphhopper | Apache-2.0 | Java, OSM | HTTP routing | Yes | Large | Medium | Routing alt |
| **MapLibre GL** | github.com/maplibre/maplibre-gl-js | BSD-3 | JS | client map render | **Yes** | Large | Low | ⭐ Front-end map (no per-load fee) |
| **Socket.IO** | github.com/socketio/socket.io | MIT | Node | WebSocket + Redis adapter | **Yes** | Very large | Low | ⭐ Realtime fan-out (fits your Node stack) |
| **NEMSIS** | nemsis.org | Standard (US) | XML/JSON schema | data standard | n/a (spec) | National (US) | — | ePCR data-model reference |
| GitHub ambulance-booking repos | github.com/topics/ambulance-booking | mixed | PHP/MERN | minimal | **No** (student CRUD) | Small | — | UI inspiration only |

**Verdict:** **no single open-source EMS platform is a drop-in** for a multi-tenant HMS on your
stack (the serious one, Resgrid, is .NET/SQL-Server and is a whole platform, not a module).
The winning pattern is **compose best-of-breed open-source infrastructure** — Traccar
(telematics) + OSRM/Valhalla (routing) + Socket.IO/Redis (realtime) + MapLibre (maps) — and
**build the EMS domain + dispatch engine natively** in your Node/Prisma stack.

Sources: [Traccar](https://www.traccar.org/) · [Resgrid Core](https://github.com/Resgrid/Core) · [WebEMS (NEMSIS)](https://webems.sourceforge.net/) · [NEMSIS](https://nemsis.org/what-is-nemsis/) · [OSM routing engines](https://zeorouteplanner.com/openstreet-maps-api/) · [GVK EMRI 108](https://en.wikipedia.org/wiki/GVK_EMRI) · [AwesomeEMS list](https://github.com/jenkstom/AwesomeEMS)

---

# Deliverable 18 — Final recommendation

### 1. Best architecture
**Three-tier composite**: (a) **Traccar** telematics sidecar for GPS device ingestion +
geofence/behaviour events; (b) a **new Node real-time service** (Socket.IO + Redis) hosting the
dispatch board, allocation/ETA engine, and live fan-out; (c) your **existing Express/Prisma/
Postgres** as the system of record for fleet, trips, ePCR, equipment, maintenance, billing,
audit — integrated 1:1 with Patients/Billing/Pharmacy/Blood Bank/Notifications. Routing via a
`RoutingProvider` abstraction (Google for live emergency ETAs, OSRM/Valhalla self-hosted for
bulk). MapLibre on the front end.

### 2. Recommended technology approach
Reuse your stack for the transactional core; **add** Traccar, Redis, Socket.IO, a routing
engine, MapLibre, and Capacitor background-geolocation. Don't build GPS protocol decoders or a
routing engine — integrate proven OSS. Do build the dispatch engine, ePCR, fleet/maintenance,
and HMS integration natively (your differentiation + where tight coupling matters).

### 3. Build vs buy vs integrate
- **Integrate:** telematics (Traccar), routing (OSRM/Valhalla/Google), maps (MapLibre),
  realtime transport (Socket.IO) — **do not build these.**
- **Build:** EMS domain, dispatch/allocation engine, ePCR, fleet/driver/equipment/maintenance,
  tariff billing, HMS integration, dashboards — **native, your strength.**
- **Buy/reference:** study Resgrid (CAD UX) and NEMSIS (ePCR schema); don't adopt Resgrid
  wholesale (stack mismatch). A turnkey commercial CAD only if a tenant mandates it.

### 4. Team size
4–6 senior: 2 backend (1 dedicated to the **real-time/dispatch service + Traccar/routing**,
1 on the Prisma domain + HMS integration), 1–2 frontend (command-center + maps), 1 mobile
(driver/medic apps + background GPS), 0.5 QA/DevOps (Traccar/Redis infra), plus a **part-time
EMS-operations SME** (dispatch protocols, response-time targets, AIS-125/108 norms) and a PM.

### 5. Development timeline
| Phase | Scope | Effort |
|---|---|---|
| **P0 Infra + foundations** | Traccar + Redis + realtime service skeleton, schema/migration, RBAC, master data, module toggle | 3–4 wks |
| **P1 Fleet + drivers + compliance** | vehicle/driver/staff master, docs/cert expiry gates, rosters | 3 wks |
| **P2 Dispatch core (MVP)** | intake → allocation engine → trip state machine → crew notify → close | 4 wks |
| **P3 Live tracking** | Traccar↔realtime↔command-center map, geofence auto-status, ETA, route persist | 3–4 wks |
| **P4 ePCR + equipment** | vitals/interventions/handover, per-vehicle inventory (↔Pharmacy), readiness gate | 3 wks |
| **P5 Maintenance + billing** | preventive/breakdown, fuel, tariff engine → Invoice | 3 wks |
| **P6 Mobile apps** | driver (bg-GPS, nav, status) + medic (ePCR) + admin | 4 wks |
| **P7 Reports + hardening + scale** | KPIs, audits, Redis-adapter scaling, load test, dry-run | 3–4 wks |
| **Total to production** | | **~5–7 months** |
| **Dispatchable MVP (P0–P3)** | | **~10–12 weeks** |

### 6. Risks
- **Real-time reliability** (the core risk) — dropped WS, stale positions, multi-instance state.
  Mitigate: Redis-backed Socket.IO adapter, heartbeat/reconnect, last-known-position fallback,
  load testing at fleet scale.
- **Mobile background GPS** — OS battery-optimisation kills location when screen-off. Mitigate:
  proven Capacitor background-geolocation plugin, foreground service/notification, field testing.
- **Routing cost** (Google at scale) — mitigate with provider abstraction + self-hosted OSRM
  for non-critical queries; cache matrices.
- **Connectivity dead zones** — ambulances lose signal; mitigate with on-device queue + sync,
  store-and-forward GPS, graceful degraded dispatch.
- **Allocation correctness** — bad "nearest" logic costs lives/minutes; use road-ETA not
  crow-flies, test against real geography, keep operator override.
- **Traccar operational ownership** — it's another service to run/patch/secure; budget DevOps.
- **Compliance grounding edge cases** — don't ground the last available unit silently in a mass-
  casualty event; supervisor override with audit.

### 7. Production-readiness checklist
- [ ] Traccar deployed, device→ambulance mapping, per-tenant device isolation, retention set.
- [ ] Realtime service: Redis adapter, JWT-auth WS, tenant-scoped rooms, reconnect/heartbeat,
      horizontally scaled + load-tested at peak fleet size.
- [ ] Allocation engine uses **road ETA**, honours the four gates (available + compliant docs +
      crew-cert current + equipment-ready), auto-assigns P1, supports override + reassignment.
- [ ] Trip state machine enforced server-side; all transition timestamps captured (KPIs).
- [ ] Geofence auto-status (scene/hospital) wired; route persisted (down-sampled) for replay.
- [ ] ePCR: serial vitals, interventions↔Pharmacy decrement, two-party digital handover, lock+addendum.
- [ ] Compliance engine: vehicle docs + driver licence + crew cert + equipment expiry → alerts
      + **auto-ground** mandatory lapses; supervisor override audited.
- [ ] Maintenance + fuel + breakdown → vehicle status feeds dispatch pool.
- [ ] Tariff engine (distance GPS-verified) → existing Invoice/Payment; per-tenant plans.
- [ ] Driver app: background GPS screen-off, push assignment, one-tap status, SOS — field-tested.
- [ ] RoutingProvider abstraction (Google + OSRM/Valhalla) with caching + cost guardrails.
- [ ] Immutable `AmbulanceAuditLog`; no hard delete on trip/incident/ePCR/billing; legal retention.
- [ ] Multi-tenant scoping verified (no cross-tenant unit/position leakage); `ambulance` toggle.
- [ ] Dashboards: response-time p50/p90, fleet utilization, dispatch success, compliance pipeline.
- [ ] DR/runbook for Traccar + Redis + realtime service; monitoring/alerting on the live tier.

---

### Final architecture statement
An enterprise Ambulance Management System is **not Pharmacy with a map** — it is a **real-time,
stateful, life-critical dispatch platform** bolted onto your transactional HMS. The right
architecture **composes proven open-source infrastructure** (Traccar for telematics, OSRM/
Valhalla + Google for routing, Socket.IO/Redis for realtime, MapLibre for maps) and **builds
the EMS domain and dispatch engine natively** in your Node/Prisma stack, integrating 1:1 with
Patients, Billing, Pharmacy, Blood Bank, and Notifications. The product is **time-to-pickup and
auditable response** — so the design is organised around a timestamped trip state machine, a
road-ETA allocation engine honouring four readiness gates, sub-second live tracking, and an
immutable audit of every dispatch decision. Build the real-time tier deliberately as new
infrastructure (it's the one capability your current stack lacks), and you get a system that
scales to a national 108-style fleet while staying part of the same multi-tenant hospital
ecosystem.
