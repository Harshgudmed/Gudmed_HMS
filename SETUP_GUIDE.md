# Doctor Fee Slab & Auto-Commission System - Setup Guide

## ✅ COMPLETED

### Backend
- ✅ Database schema with DoctorFeeSlab table
- ✅ Fee slab API endpoints (`/api/fee-slabs`)
- ✅ Auto-commission generation on appointment creation
- ✅ Fee calculation logic (with 30-day reset rule)

### Frontend
- ✅ "Fee Structure" tab in Doctor Accountability module
- ✅ Add/Edit/Delete fee slabs interface
- ✅ Slab overlap validation
- ✅ Doctor selection and slab management UI

---

## 🚀 HOW TO USE

### Step 1: Set Up Fee Slabs (Admin/Doctor)

1. Go to **Doctor Accountability** → **Fee Structure** tab
2. Select a doctor from dropdown
3. Click **"Add New Slab"** button
4. Enter slab details:
   - **From Days:** 0
   - **To Days:** 3
   - **Fee Amount:** ₹0 (Free)
   - **Active:** Yes
   - **Notes:** Optional

Example slabs to create:
```
Slab 1: 0-3 days = ₹0 (Free follow-up)
Slab 2: 3-15 days = ₹500 (Discounted)
Slab 3: 15-30 days = ₹300 (Further discount)
After 30 days = Full fee (₹1000 base fee)
```

5. Set commission rate in **Commission Setup** tab (e.g., 20%)

---

### Step 2: Patient Books Appointment

1. Go to **Appointments** → Create new appointment
2. Select **Doctor** and **Patient**
3. System automatically:
   - Calculates days since last visit
   - Applies matching slab
   - Shows fee to patient
   - Creates appointment with calculated fee
   - **Auto-generates commission record** (pending status)

---

### Step 3: View Commissions (Auto-Generated)

1. Go to **Doctor Accountability** → **Commissions** tab
2. You'll see commissions auto-created from appointments
3. Example:
   - Patient booked appointment fee: ₹500
   - Doctor commission (20%): ₹100
   - Status: Pending (auto-created)

---

### Step 4: Settle Commissions

1. Go to **Doctor Accountability** → **Settlement** tab
2. Select pending commissions
3. Click **"Settle"** and provide payment reference
4. Status changes from "Pending" to "Settled"

---

## 📊 EXAMPLE WORKFLOW

### Doctor Configuration
```
Doctor: Dr. Rahul Verma
Specialization: Cardiology
Base Fee (New Patient): ₹1000
Commission Rate: 20% (Percentage)

Fee Slabs (Follow-up):
┌─────────────┬─────────────┬─────────┬────────┐
│ From Days   │ To Days     │ Fee (₹) │ Active │
├─────────────┼─────────────┼─────────┼────────┤
│ 0           │ 3           │ 0       │ ✓      │
│ 3           │ 15          │ 500     │ ✓      │
│ 15          │ 30          │ 300     │ ✓      │
│ 30+         │ (New)       │ 1000    │ Auto   │
└─────────────┴─────────────┴─────────┴────────┘
```

### Patient Bookings

**Booking 1: First visit (New Patient)**
```
Patient: Ramesh Singh
Last Visit: None
Days Since: N/A
Applied Slab: New Patient
Appointment Fee: ₹1000
Doctor Commission: ₹1000 × 20% = ₹200 (Auto-created, Pending)
Invoice Amount: ₹1000
Invoice Status: Draft
```

**Booking 2: Follow-up (5 days later)**
```
Patient: Ramesh Singh
Last Visit: 5 days ago
Days Since: 5 days
Applied Slab: 3-15 days (₹500)
Appointment Fee: ₹500
Doctor Commission: ₹500 × 20% = ₹100 (Auto-created, Pending)
Invoice Amount: ₹500
Invoice Status: Draft
```

**Booking 3: Follow-up (20 days later)**
```
Patient: Ramesh Singh
Last Visit: 20 days ago
Days Since: 20 days
Applied Slab: 15-30 days (₹300)
Appointment Fee: ₹300
Doctor Commission: ₹300 × 20% = ₹60 (Auto-created, Pending)
Invoice Amount: ₹300
Invoice Status: Draft
```

**Booking 4: Follow-up (40 days later)**
```
Patient: Ramesh Singh
Last Visit: 40 days ago
Days Since: 40 days
Applied Slab: NEW PATIENT (30-day reset)
Appointment Fee: ₹1000 (Base fee)
Doctor Commission: ₹1000 × 20% = ₹200 (Auto-created, Pending)
Invoice Amount: ₹1000
Invoice Status: Draft
```

---

## 🔄 COMMISSION FLOW

```
Patient Books Appointment
         ↓
System calculates fee from slab
(or base fee if new/beyond 30 days)
         ↓
✓ Appointment created
✓ Invoice created with fee amount
✓ DoctorCommission record auto-created:
  - invoiceId: INV-xxxxx
  - invoiceAmount: ₹500
  - commissionRate: 20%
  - commissionAmount: ₹100
  - status: "pending"
         ↓
Admin views "Doctor Accountability" → "Commissions"
Sees pending commission: ₹100
         ↓
Admin clicks "Settle"
Provides payment reference
Status changes to "settled"
         ↓
Commission appears in "Settlement" history
Reports show settled amounts
```

---

## ⚙️ API ENDPOINTS

### Fee Slabs
```bash
# Get all slabs for a doctor
GET /api/fee-slabs?doctorId=xxx

# Create new slab
POST /api/fee-slabs
Body: {
  doctorId: "xxx",
  fromDays: 0,
  toDays: 3,
  feeAmount: 500,
  isActive: true,
  notes: "Free follow-up"
}

# Update slab
PATCH /api/fee-slabs/{id}
Body: { fromDays?, toDays?, feeAmount?, isActive?, notes? }

# Delete slab
DELETE /api/fee-slabs/{id}

# Calculate fee for appointment
GET /api/fee-slabs/calculate?doctorId=xxx&patientId=yyy
Response: {
  fee: 500,
  daysSinceLastVisit: 5,
  appliedSlab: { ... },
  isNewPatient: false
}
```

---

## 🧪 TESTING CHECKLIST

- [ ] Create fee slabs for a doctor (0-3, 3-15, 15-30 days)
- [ ] Verify no overlapping slabs allowed
- [ ] Book appointment as new patient → fee = base fee
- [ ] Verify commission auto-created in pending status
- [ ] Book follow-up within 3 days → fee = slab fee (₹0)
- [ ] Book follow-up at 5 days → fee = slab fee (₹500)
- [ ] Book follow-up at 20 days → fee = slab fee (₹300)
- [ ] Book follow-up beyond 30 days → fee = base fee (new patient)
- [ ] Settle commissions in Settlement tab
- [ ] Verify commission status changes to settled
- [ ] Check Reports tab shows commission totals

---

## ❓ COMMON QUESTIONS

**Q: What if no slab matches the days since last visit?**
A: System uses doctor's base consultation fee

**Q: Can I have overlapping slabs?**
A: No, system prevents overlapping day ranges

**Q: What happens after 30 days?**
A: Patient is automatically charged the base fee (new patient rate)

**Q: Is commission calculated automatically?**
A: Yes, when appointment is created, commission record is auto-generated with status="pending"

**Q: Can I manually add commissions?**
A: Yes, the "Add Commission" button in Commissions tab still works for manual entries if needed

**Q: What if doctor doesn't have a commission config?**
A: Appointment is created, but no commission is generated. Go to "Commission Setup" tab to configure.

---

## 📌 NOTES

- Database was reset during setup (all demo data cleared)
- Fee slabs are per-doctor, per-organization
- Commission is always calculated as: Fee × CommissionRate%
- 30-day window cannot be changed (hard-coded)
- Appointment fee calculation happens at booking time (not changeable later)
- Commission status: pending → settled (via Settlement tab)

