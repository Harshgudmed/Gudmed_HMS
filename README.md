# Hospital Management System — Migration

Express MVC + React 19 + Vite (Plain JavaScript, no TypeScript)

## First-time setup

```bash
cd migrations
npm install          # installs concurrently
cd backend && npm install
cd ../frontend && npm install
```

Copy `.env.example` to `.env` in the backend folder and set your database URL:
```
DATABASE_URL="postgresql://user:password@localhost:5432/hospital_db"
```

Generate the Prisma client:
```bash
cd backend
npx prisma generate
npx prisma migrate dev   # or: npx prisma db push
```

## Run everything with ONE command

```bash
cd migrations
npm run dev
```

This starts:
- **Backend** → http://localhost:5000  (Express)
- **Frontend** → http://localhost:5173 (Vite)

The frontend Vite proxy forwards all `/api/*` calls to the backend automatically — no CORS issues.

## Modules migrated so far

| # | Module       | Backend route       | Frontend page      |
|---|--------------|---------------------|--------------------|
| 1 | Pre-Triage   | /api/pre-triage     | /pre-triage        |
| 2 | Triage       | /api/triage         | /triage            |
| 3 | Appointments | /api/appointments   | /appointments      |

## Module migration order (remaining)

4. Consultations
5. Patients
6. Pharmacy
7. Laboratory
8. Radiology
9. Inpatient
10. Billing
11. Reports
12. Settings
13. Death Certificates
14. Doctor Accountability
