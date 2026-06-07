# 📱 GudMed Mobile App — Build Progress

Separate app in `mobile-frontend/` (React + Vite + Capacitor). Premium redesign, real data.
Dev preview: `npm run dev -- --host` → http://localhost:5173 (phone: LAN IP).

## ✅ Completed (premium UI + real data)
- [x] **Design system** — shadows (elev-1..4), glass, animations, stagger
- [x] **App shell** — splash, bottom tab bar, "More" sheet, per-screen headers
- [x] **Splash screen**
- [x] **Home / Dashboard** — stats, services grid, quick actions
- [x] **Patients** — list, search, status filter, call
- [x] **Patient Detail** — info, lab/radiology/admissions records, call/WhatsApp/email
- [x] **Doctors** — search, speciality filter, call
- [x] **Doctor Profile** — contact, details, book button
- [x] **Appointments (view)** — date-grouped, status filter
- [x] **Reports / Analytics** — KPIs, occupancy donut, admissions chart, ward bars
- [x] **Pharmacy (FULL functions)** — Inventory CRUD + adjust stock, Prescriptions + dispense, POS Sell, Sales history
- [x] **Backend fix** — dashboard analytics `expectedDischargeDate` crash

## 🚧 Doing / next — add actions to view-only screens
- [x] **Appointments — status actions** ✅ check-in / start / complete / cancel (live)
- [x] **Appointments — book new** ✅ patient search + doctor + date/time/type (`POST /appointments`)
- [x] **Patients — register + edit** ✅ FAB register + ✏️ edit in detail (`POST` / `PATCH /patients`)
- [x] **Doctor Profile — booking** ✅ pre-locked doctor (shared `BookAppointmentSheet`)

### ✅ All redesigned modules are now FULLY functional (real API + actions)

## ⬜ Not yet redesigned (still desktop layout, reachable via "More")
- [x] **Consultations** — list + detail (vitals, diagnosis, Rx, orders) ✅ · create/edit/print pending
- [x] **Laboratory** — view (orders + 1.9k catalog) + collect/process/complete ✅ · result-entry / verify / create-order / catalog-CRUD pending
- [x] **Radiology** — view (orders + 972 catalog) + start/complete ✅ · report / verify / create-order / exam-CRUD pending
- [x] **Inpatient** — Admitted list + Wards bed-map + **admit / discharge / transfer** ✅ · clinical notes & billing pending
- [x] **Doctor Accountability** — commissions + summary + **settle** ✅
- [x] **Death Certificates** — list + search + delete + **issue** ✅
- [x] **Settings** — org edit (live brand/name) + module toggles + user add/edit/status ✅
- [x] **Queue** — list + Call / Complete ✅
- [x] **Pre-Triage** — screenings list + new-screening (vitals + route) ✅
- [x] **Triage** — uses the Queue workflow ✅

### 🎉 ALL modules mobilified. Deep create/result forms:
- [x] **Consultation create** ✅ — vitals + Dx + prescriptions + lab/radiology orders (`POST /consultations`)
- [x] **Lab result-entry** ✅ (per-test values + abnormal/critical → complete)
- [x] **Radiology report** ✅ (technique + findings + impression → reported)
- [x] **Inpatient clinical notes** ✅ (note + vitals)
- [x] **Lab add-test** + **Radiology add-exam** ✅ (catalog management)
- [ ] (optional) Inpatient billing line-items — only remaining minor back-office item

### ✅✅ MOBILE APP IS FEATURE-COMPLETE — every module + every key function. Next: `cap add android` → APK.

## 📦 Packaging
- [ ] `cap add android` → build APK in Android Studio
- [ ] App icon + splash assets
- [ ] Play Store listing

---
_Last updated: 2026-06-06_
