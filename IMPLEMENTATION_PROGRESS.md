# Doctor Fee Slab & Auto-Commission Implementation Progress

## ✅ BACKEND COMPLETED

### 1. Database Schema
- ✅ Added `DoctorFeeSlab` table with:
  - `fromDays` - start of day range
  - `toDays` - end of day range
  - `feeAmount` - fee for this range
  - `isActive` - toggle slab on/off
  - `notes` - optional notes

### 2. API Endpoints Created
**Base URL:** `/api/fee-slabs`

#### GET /api/fee-slabs
- Get all fee slabs (optionally filtered by doctorId)
- Query params: `?doctorId=xxx`
- Returns: Array of slabs

#### POST /api/fee-slabs
- Create new slab for a doctor
- Body: `{ doctorId, fromDays, toDays, feeAmount, isActive, notes }`
- Validates: no overlapping slabs, fromDays < toDays

#### PATCH /api/fee-slabs/:id
- Update existing slab
- Body: `{ fromDays?, toDays?, feeAmount?, isActive?, notes? }`

#### DELETE /api/fee-slabs/:id
- Delete slab

#### GET /api/fee-slabs/calculate?doctorId=xxx&patientId=yyy
- Calculate applicable fee for patient's next appointment
- Returns: `{ fee, daysSinceLastVisit, appliedSlab, isNewPatient }`

### 3. Appointment Creation Logic Updated
- ✅ Calculates fee based on fee slabs instead of fixed rate
- ✅ Implements 30-day auto-reset rule (patient treated as new after 30 days)
- ✅ **AUTO-GENERATES COMMISSION** when appointment is created:
  - Uses doctor's commission config (percentage-based)
  - Creates `DoctorCommission` record with status="pending"
  - Commission = Fee × CommissionRate%
  - Example: ₹500 fee × 20% = ₹100 commission

### 4. Commission Workflow
**Old way:** Manual "Add Commission Entry" button
**New way:** Automatic on appointment creation

Timeline:
```
Patient Books Appointment
        ↓
Fee calculated from slab (e.g., ₹500)
        ↓
Appointment created + Invoice generated
        ↓
✨ AUTOMATICALLY create DoctorCommission record
        ↓
Commission visible in Doctor Accountability module
```

---

## 🔲 FRONTEND - IN PROGRESS

### Need to Build:

#### 1. Fee Structure Management Tab in Doctor Accountability
Location: `frontend/src/components/doctor-accountability/DoctorAccountabilityModule.jsx`

New tab: "Fee Structure" (alongside Commission Setup, Commissions, Settlement, Reports)

Features:
- [ ] Select doctor dropdown
- [ ] "Add New Slab" button
- [ ] Table showing existing slabs:
  - From Days | To Days | Fee Amount | Active | Notes | Actions
- [ ] Edit slab modal
- [ ] Delete slab confirmation
- [ ] Validation: no overlapping day ranges

#### 2. Update Appointment Booking UI
Location: `frontend/src/components/appointments/AppointmentsModule.jsx`

Show calculated fee BEFORE booking:
- [ ] When doctor selected, call `/api/fee-slabs/calculate?doctorId=xxx&patientId=yyy`
- [ ] Display fee: "Follow-up Fee: ₹500" or "New Patient Fee: ₹1000"
- [ ] Show "Days since last visit: 5 days"
- [ ] Show "Commission to doctor: ₹100"
- [ ] Confirm before booking

#### 3. Update Doctor Accountability Commissions Tab
Location: Same component

Enhancements:
- [ ] Show "auto-generated" badge for commissions from appointments
- [ ] Show appointment link (which appointment generated this commission)
- [ ] Filter commissions by type (auto vs manual if we keep manual option)

---

## 🧪 TESTING CHECKLIST

### Backend API Tests
- [ ] Create slab: POST /api/fee-slabs
- [ ] Get slabs: GET /api/fee-slabs?doctorId=xxx
- [ ] Calculate fee - new patient: GET /api/fee-slabs/calculate
- [ ] Calculate fee - follow-up within slab: GET /api/fee-slabs/calculate
- [ ] Calculate fee - beyond 30 days: GET /api/fee-slabs/calculate
- [ ] Create appointment: POST /api/appointments (verify commission auto-created)
- [ ] Update slab: PATCH /api/fee-slabs/:id
- [ ] Delete slab: DELETE /api/fee-slabs/:id

### Frontend Tests
- [ ] Add fee slab form submits correctly
- [ ] Overlapping slabs rejected with error message
- [ ] Appointment booking shows correct fee
- [ ] Days since last visit calculated correctly
- [ ] Commission displayed in Doctor Accountability
- [ ] Edit slab works
- [ ] Delete slab works

---

## 📋 EXAMPLE WORKFLOW

### Setup (Doctor/Admin)
```
Doctor Accountability → Fee Structure Tab → Select Dr. Rahul Verma

Add Slab:
0 days - 3 days: ₹0 (Free)        [Active] ✓
3 days - 15 days: ₹500              [Active] ✓
15 days - 30 days: ₹300             [Active] ✓

Base Fee (New Patient): ₹1000
Commission Rate: 20%
```

### Patient Booking
```
Patient Ramesh Singh books with Dr. Rahul Verma

System checks: Last visit was 5 days ago
Applies slab: 3-15 days = ₹500
Shows to patient:
  "Follow-up Appointment - 5 days since last visit"
  "Fee: ₹500 (Follow-up rate)"
  
Patient confirms booking

Behind the scenes:
✓ Appointment created (fee: ₹500)
✓ Invoice created (amount: ₹500)
✓ Commission auto-created (₹500 × 20% = ₹100, status: pending)
```

### Doctor Accountability
```
Doctor: Dr. Rahul Verma
Commission Rate: 20%

Recent Commissions:
Date       | Invoice  | Amount  | Commission | Status
05 Jun     | INV-1001 | ₹500    | ₹100       | Pending ✓
05 Jun     | INV-1002 | ₹1000   | ₹200       | Pending ✓
04 Jun     | INV-1003 | ₹500    | ₹100       | Settled ✓
```

---

## 📊 DATABASE CHANGES

### New Table: DoctorFeeSlab
```
id            | String (CUID)
organizationId| String (FK)
doctorId      | String (FK)
fromDays      | Int
toDays        | Int
feeAmount     | Float
isActive      | Boolean (default: true)
notes         | String (nullable)
createdAt     | DateTime
updatedAt     | DateTime

Indexes:
- (doctorId)
- (organizationId)
Unique: (doctorId, fromDays, toDays)
```

### Modified: DoctorCommission
- Now includes `appointmentId` (implicit via invoice)
- Auto-created on appointment creation
- No changes needed to table schema

---

## 🚀 NEXT STEPS

1. **Frontend:** Create Fee Structure management UI in Doctor Accountability
2. **Frontend:** Update Appointment booking to show calculated fees
3. **Frontend:** Show commission in Commissions tab
4. **Testing:** Test full workflow end-to-end
5. **Polish:** Add validation, error messages, loading states

