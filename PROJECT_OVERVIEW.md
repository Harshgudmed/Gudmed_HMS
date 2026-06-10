# Project Overview — Hospital Management System (HMS)

> Living document describing **what this project is, what every module does, and the
> work we are doing** (Role-Based Access Control with per-role URLs + multi-hospital).
> Last updated: 2026-06-08.

---

## 1. What this system is

A multi-module **Hospital / Clinic Management System (HMS)** that runs the full
outpatient + inpatient workflow of a hospital: from a patient walking in, through
screening, queueing, doctor consultation, pharmacy/lab/radiology orders, inpatient
admission, billing/payments, and reporting — plus doctor commission accounting,
death certificates, and WhatsApp patient notifications.

It is **multi-tenant by design**: every record belongs to an `Organization`
(= one hospital). Today it effectively runs as a single demo hospital (`org-demo`)
because auth is not yet enforced (see §7).

---

## 2. Tech stack & deployment

| Layer | Tech |
|-------|------|
| Backend | Node.js + Express (MVC), Prisma ORM, PostgreSQL |
| Web frontend | React 19 + Vite, React Router, Tailwind, shadcn/ui, sonner |
| Mobile frontend | Separate React + Vite + Capacitor app (`mobile-frontend/`) |
| Auth | JWT in an httpOnly cookie (+ Bearer fallback) |
| Payments | Razorpay |
| Messaging | WhatsApp (Twilio) two-way bot |
| Hosting | Frontend → Vercel · Backend → Render · DB → managed Postgres |

Run locally: `npm run dev` at repo root → backend on `:5000`, web on `:5173`.
The Vite dev server proxies `/api/*` to the backend.

---

## 3. Repository layout

```
migrations/
├── backend/
│   ├── prisma/schema.prisma     # ~50 models — the full data model
│   ├── prisma/seed.js           # demo users (bcrypt-hashed) + sample data
│   └── src/
│       ├── routes/              # one router per module (index.js wires them)
│       ├── controllers/         # business logic per module
│       ├── pharmacy/            # pharmacy is its own sub-module (controllers + validations)
│       ├── middleware/          # auth.js, validate.js, errorHandler.js
│       ├── services/            # razorpay, whatsapp, gudmed, message templates, bot state
│       ├── validations/         # zod schemas (appointment, consultation, pre-triage)
│       ├── config/              # db.js (Prisma client), cookie.js (auth cookie opts)
│       └── utils/               # dates.js (Ethiopian/Gregorian calendar)
├── frontend/        # web SPA (admin/staff console)
│   └── src/{pages,components,api,lib}
└── mobile-frontend/ # Capacitor mobile app (doctor-focused, premium redesign WIP)
```

---

## 4. Modules — what each one does

Backend is mounted under `/api` ([routes/index.js](backend/src/routes/index.js)).
Each module = a route file + controller + a frontend page/module component.

| Module | API base | What it does |
|--------|----------|--------------|
| **Auth** | `/api/auth` | `login`, `logout`, `me`. Issues a JWT (with `role` + `organizationId`) in an httpOnly cookie. |
| **Dashboard** | `/api/dashboard` | Aggregated KPIs/stats for the home screen. |
| **Analytics** | `/api/analytics` | Deeper reporting metrics (charts, trends). |
| **Pre-Triage** | `/api/pre-triage` | First-contact screening of a walk-in **before** they are a registered patient; can `convert` a pre-triage record into a real Patient. |
| **Queue** | `/api/triage` (queue) | Patient waiting queue: add to queue, call, in-progress, completed. Central hub linking appointments + billing tabs. |
| **Triage** | `/api/triage` | Clinical triage assessment (vitals, priority) before consultation. |
| **Appointments** | `/api/appointments` | Book/list/update/cancel appointments; fee calculation; check-in. |
| **Patients** | `/api/patients` | Patient registration + records (CRUD); `/:id/records` returns the full clinical history. |
| **Consultations** | `/api/consultations` | Doctor's consultation notes, diagnosis, and the post-consultation workflow (orders, prescriptions). |
| **Pharmacy** | `/api/pharmacy` | Full pharmacy sub-system: **drugs**, **batches** (stock/expiry), **sales** (POS), **prescriptions** (dispense), **purchase-orders** (receive stock), **stats**. |
| **Laboratory** | `/api/laboratory` | Lab test catalog, lab orders, and result entry/verification. Has a `/health` check for its tables. |
| **Radiology** | `/api/radiology` | Radiology exams, orders, and report writing. |
| **Inpatient** | `/api/inpatient` | Wards, beds, and admissions (admit/transfer/discharge). |
| **Billing** | `/api/billing` | Invoices and billing services/line items. |
| **Payments** | `/api/payments` | Razorpay: create order, verify, payment links, webhook, payments-by-invoice. |
| **Doctor Accountability** | `/api/doctor-accountability` | Tracks doctor performance/commissions and settlements. |
| **Fee Slabs** | `/api/fee-slabs` | Per-doctor fee slabs + `calculate` the fee for an appointment. |
| **Death Certificates** | `/api/death-certificates` | Issue/manage death certificates (certified-by / issued-by). |
| **Notifications** | `/api/notifications` | Sends WhatsApp messages (consultation, prescription, lab result, radiology, pharmacy team) + two-way WhatsApp bot webhook. |
| **Settings** | `/api/settings` | Organization profile + branding, **user management** (create/edit users & assign roles, toggle active), departments, billing services, module on/off toggles. |
| **Import** | `/api/import` | Bulk data import, guarded by an `x-import-secret` header (not cookie auth). |

### Frontend specifics
- [App.jsx](frontend/src/App.jsx) renders a fixed sidebar (`NAV_ITEMS`) + routed pages.
  Sidebar items are hidden when their module is disabled via **Settings → Modules**
  (`MODULE_BY_PATH` ↔ `modulesEnabled`).
- Branding (colors, hospital name) is read from `/settings` and applied as CSS vars.

---

## 5. Core clinical workflow (how modules connect)

```
Walk-in ─► Pre-Triage ─► (convert) ─► Patient registered
                                          │
                  Appointment ◄───────────┘
                       │
                     Queue ─► Triage (vitals/priority)
                                   │
                              Consultation (doctor)
                          ┌────────┼─────────┐
                       Pharmacy   Lab      Radiology   ─► results/notifications (WhatsApp)
                          │        │          │
                          └────────┴──────────┴─► Billing ─► Payment (Razorpay)
                                          │
                            (if admitted) Inpatient: ward/bed/admission
                                          │
                                   Reports / Analytics / Doctor Accountability
```

---

## 6. Data model (high level)

~50 Prisma models, all scoped to `Organization` (`organizationId` foreign key).
Key groups:

- **Tenancy & people:** `Organization`, `User` (staff, has `role`), `Department`, `Patient`.
- **Front-desk flow:** `PreTriage`, `QueueManagement`, `TriageAssessment`, `Appointment`, `Consultation`.
- **Inpatient:** `Ward`, `Bed`, `Admission`, `DeathCertificate`.
- **Pharmacy:** `PharmacyDrug`, `PharmacyBatch`, `Prescription`, `PharmacySale`, `PharmacyPurchaseOrder`.
- **Diagnostics:** `LabTest`, `LabOrder`, `LabResult`, `RadiologyExam`, `RadiologyOrder`, `RadiologyReport`.
- **Money:** `BillingService`, `Invoice`, `Payment`, `DoctorFeeSlab`, `DoctorCommissionConfig`, `DoctorCommission`.
- **RBAC scaffold (currently unused):** `Permission`, `RolePermission`, `UserInvitation`, `UserActivity`, `AuditLog`.
- **Integrations:** `MachineIntegration`, `MachineResultsQueue`, `IntegrationLog`, `Eapts*` (Ethiopian pharma system), `Notification`.

**Roles** (on `User.role`): `super_admin, admin, doctor, nurse, receptionist,
pharmacist, lab_tech, lab_supervisor, radiologist, radiology_tech, billing_clerk,
inventory_manager` (labels in [SettingsModule.jsx](frontend/src/components/settings/SettingsModule.jsx#L30)).

---

## 7. Current auth & access state — the gap we are closing

> ⚠️ **Right now there is effectively no access control.**

1. **Frontend has no login.** [App.jsx](frontend/src/App.jsx) boots straight into the
   dashboard; every route is open to anyone with the URL. No `LoginPage` exists.
2. **Backend login is a skeleton.** [authController.js](backend/src/controllers/authController.js)
   accepts *any non-empty password* (a `TODO` to add `bcrypt.compare` — even though the
   seed already stores bcrypt hashes).
3. **The auth middleware never blocks.** [auth.js](backend/src/middleware/auth.js):
   if the token is missing/invalid it silently falls back to `org-demo` and continues.
   So **no endpoint is protected** and there is **no `authorize(role)`** middleware.
4. **Multi-tenancy collapses to one hospital.** Controllers scope every query by
   `req.organizationId`, but that defaults to the hardcoded **`'org-demo'`** in **27 files**.
   With no enforced login, all data lands in the single demo org.

**Good news / foundations already in place:** roles are defined, the DB is fully
multi-tenant, `Organization` has `slug` + branding + `modulesEnabled`, `Permission`/
`RolePermission` tables exist, and `/auth/login|logout|me` already issue a role-bearing JWT.

---

## 8. The work we are doing

### Goal A — Real authentication
- `bcrypt.compare` on login; reject inactive users; record `lastLoginAt`.
- Make `authenticate` return **401** when the token is missing/invalid (no silent fallback).
- Add an **`authorize(...roles)`** middleware → **403** for disallowed roles (admin/super_admin bypass).
- Roll out behind an `AUTH_ENFORCED` flag so the live demo never breaks during the build.

### Goal B — Role-Based Access Control with per-role URLs
- Dedicated URL space per role: `/:role/login` → `/:role/*` (e.g. `/doctor/login`,
  `/receptionist/login`). Logged-out hits redirect to that role's login; cross-role
  access is blocked.
- Frontend: `AuthContext` (restores session via `/auth/me`), `RoleLogin` page,
  `ProtectedRoute` wrapper, and a `roleConfig` mapping **role → allowed modules + home**.
- First roles: **admin, doctor, receptionist** (pattern proven, then extend to all 12).

### Goal C — Multi-hospital (multi-tenancy made real)
- **Hospital URL scheme: org inferred from login** (decided). URLs carry no hospital
  segment — just `/:role/login` and `/:role/*`. The hospital is resolved from the
  authenticated user's `organizationId`. Implication: a staff email is unique across
  the whole system (one email = one hospital).
- Stop defaulting to `org-demo`: derive `organizationId` strictly from the authenticated
  user, and reject the request when it's absent (once `AUTH_ENFORCED` is on).
- `super_admin` provisioning to create/manage hospitals (Organizations) and seed each
  hospital's first admin user.
- Per-hospital branding + `modulesEnabled` already supported — load them from the
  logged-in user's org so each hospital sees its own colors, name, and enabled modules.

### Role → module matrix (initial)

| Role | Modules | Home |
|------|---------|------|
| **admin** | everything (current full nav) + Settings/User-management | dashboard |
| **doctor** | dashboard, queue, consultations, patients, lab/radiology (read), doctor-accountability | consultations |
| **receptionist** | dashboard, appointments, queue, patients, pre-triage, billing | appointments |
| *(later)* nurse, pharmacist, lab_tech, lab_supervisor, radiologist, radiology_tech, billing_clerk, inventory_manager | scoped to their module(s) | their module |

---

## 9. Decisions & open questions
**Decided:**
- URL scheme per role: **`/:role/*` dedicated space** (e.g. `/doctor/login` → `/doctor/*`).
- First roles: **admin, doctor, receptionist**; extend to all 12 after.
- Backend enforcement: **yes** — bcrypt + blocking auth + `authorize(...roles)`, behind `AUTH_ENFORCED`.
- Hospital addressing: **org inferred from the logged-in user** (no hospital in the URL).

**Decided (continued):**
- **Data scoping depth:** module-level **plus row-level for doctors** — a doctor sees
  only *their own* patients (those they have an appointment/consultation with), not
  other doctors' patients. Other roles are module-level for now.
- **Platform order:** **desktop/web first**, then port to the mobile app.
