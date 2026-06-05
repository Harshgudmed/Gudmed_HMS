# Doctor Fee Structure & Commission System - Requirements Comparison

## Current State vs. Client Requirements

---

## 1. SLAB CREATION & DOCTOR SELECTION

### ✅ WHAT YOU HAVE NOW
- **Single consultation fee per doctor** stored in `User.consultationFee` (fixed amount)
- **Free follow-up window** stored in `User.followUpDays` (simple time-based, not slab-based)
- Doctor selection is straightforward when creating appointments
- System automatically flags free follow-ups within the window

### ❌ WHAT CLIENT WANTS (NOT YET IMPLEMENTED)
- **"Add New Slab"** feature - allows creation of multiple fee slabs per doctor
- **Day-based slab conditions** - different fees based on specific day ranges
- **Dynamic pricing** - ability to set different fees for different visit scenarios
- **Slabs are tied to visit type** (new patient vs. follow-up), not just a global window
- Example:
  - Slab 1: 0-3 days = ₹0 (free)
  - Slab 2: 3-15 days = ₹500 (discounted)
  - Slab 3: 15-30 days = ₹300
  - After 30 days = treated as new patient (full fee)

### 🔴 GAPS
- Need new DB table: `DoctorFeeSlab` to store multiple slabs per doctor
- Need to track slab conditions (from_days, to_days, fee_amount)
- Need slab status (Active/Inactive)
- Need to update appointment creation logic to match against slabs instead of simple window

---

## 2. PATIENT VISIT LOGIC (NEW vs. FOLLOW-UP)

### ✅ WHAT YOU HAVE NOW
- **appointmentType** field exists: can be "new_patient" or "follow_up"
- **Free follow-up logic** implemented:
  - Checks if patient visited same doctor within `followUpDays`
  - Auto-sets consultationFee to 0 if within window
  - Does NOT charge for repeat visits within window

### ❌ WHAT CLIENT WANTS (NOT YET IMPLEMENTED)
- **System prompting** on booking:
  - When patient books with same doctor, prompt: "Is this a New Patient or Follow-up?"
  - Currently NOT prompting - just accepts appointmentType
- **Day calculation display**:
  - Show "X days since last visit" to user
  - Currently hidden from UI/frontend
- **Dynamic fee application**:
  - Show applicable fee BASED ON slabs
  - Currently shows flat consultationFee only
- **Automatic "New Patient" after 30+ days**:
  - If 30+ days since last visit, treat as new patient (full fee)
  - Currently uses doctor's followUpDays only (could be any number)

### 🔴 GAPS
- Frontend doesn't prompt for new vs. follow-up choice
- Frontend doesn't display "days since last visit" info
- Appointment creation doesn't enforce 30-day auto-reset rule
- No UI to show applicable slab/fee to user before booking

---

## 3. FEE STRUCTURE SETUP ("Add Fee Structure")

### ✅ WHAT YOU HAVE NOW
- **Doctor commission config** exists: stores commission type (percentage/fixed) + rate
- **Consultation fee** stored on User record
- **Follow-up window** stored on User record
- Simple 2-part setup: consultation fee + commission percentage

### ❌ WHAT CLIENT WANTS (NOT YET IMPLEMENTED)
- **"Add Fee Structure"** button with sub-menu:
  - Option 1: "New Patient" - set base fee
  - Option 2: "Follow-up" - open day-based slab conditions
- **Slab management UI**:
  - "Add New Slab" button
  - Multiple slab entries (day ranges)
  - Save/Continue buttons
- **Status toggles**:
  - Active/Inactive for each slab
  - Active/Inactive for fee structure
- **Notes section** below Active toggle
- **Visual structure** showing:
  ```
  Doctor: [Select Doctor]
  Base Fee (New Patient): ₹[amount]
  
  Follow-up Slabs:
  [From Days] - [To Days] = ₹[amount] [Active/Inactive] [Notes]
  [From Days] - [To Days] = ₹[amount] [Active/Inactive] [Notes]
  ```

### 🔴 GAPS
- No dedicated "Fee Structure" module/UI
- No slab management interface
- Doctor accountability module focuses on COMMISSION, not fee slabs
- No way to define day-based fee conditions
- No visual UI showing slab conditions

---

## 4. COMMISSION & SETTLEMENTS

### ✅ WHAT YOU HAVE NOW
- **Commission calculation** implemented:
  - Percentage-based (e.g., 20% of invoice amount)
  - NOT flat amount - correctly uses percentage
- **Commission config** per doctor:
  - `DoctorCommissionConfig` table with commissionRate
  - Can set type (percentage or fixed_per_consultation)
- **Settlement workflow**:
  - Track commission status (pending, approved, paid)
  - Settle commissions via batch action
  - Keep settlement record (date, ref, notes)
- **Separate module** exists: "Doctor Accountability" tab

### ❌ WHAT CLIENT WANTS (PARTIALLY MET)
- **Separate "Add Commission" tab** - seems to already exist but may need UI refinement
- **Commission triggered after fee settlement** - currently manual
- **Example shown**: ₹1500 invoice with 20% commission = ₹300 to doctor
- **Better visibility** of commission vs. fee in UI

### 🟡 PARTIALLY IMPLEMENTED
- Logic is correct, but UI/workflow might need improvement
- Commission calculation happens at invoice creation, not post-settlement
- Need to ensure commission is visible + settable per slab (not just per doctor)

---

## 5. UI/UX ELEMENTS

### ✅ WHAT YOU HAVE NOW
- Doctor selection dropdown
- Appointment type selection (but not prompted)
- Status toggles elsewhere in system
- Notes fields elsewhere in system

### ❌ WHAT CLIENT WANTS (UI WORK NEEDED)
Buttons needed:
- [ ] "Add New Slab" button (in fee structure)
- [ ] "Add Fee Structure" button (main entry)
- [ ] "Add" sub-button (for adding conditions/slabs)
- [ ] "Save" button (to persist slabs)
- [ ] "Continue" button (multi-step flow)

Status toggles:
- [ ] Active/Inactive toggle for slabs
- [ ] Active/Inactive toggle for fee structure

Notes sections:
- [ ] Notes field below each Active toggle

Flow:
- [ ] "Choose new vs. follow-up" prompt when booking
- [ ] Display "days since last visit" in appointment modal
- [ ] Show applicable fee before confirming booking

---

## 6. DATABASE SCHEMA CHANGES NEEDED

### New Table: `DoctorFeeSlab`
```prisma
model DoctorFeeSlab {
  id             String @id @default(cuid())
  organizationId String
  doctorId       String
  
  // Slab definition
  fromDays       Int        // Start of day range
  toDays         Int        // End of day range
  feeAmount      Float      // Fee for this range
  
  // Status
  isActive       Boolean @default(true)
  notes          String?
  
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt
  
  organization   Organization @relation(...)
  doctor         User @relation(...)
  
  @@unique([doctorId, fromDays, toDays])
  @@index([doctorId])
  @@index([organizationId])
}
```

### Changes to existing `User` model:
- Keep `consultationFee` (base fee for new patients)
- Keep `followUpDays` for backward compatibility
- Consider deprecating in favor of slab system

### Changes to `Appointment` model:
- Already has `appointmentType` and `consultationFee`
- Consider adding `appliedSlabId` to track which slab was used

---

## 7. IMPLEMENTATION SUMMARY

### Priority 1: DATABASE
- [ ] Create `DoctorFeeSlab` table
- [ ] Update Prisma schema
- [ ] Run migrations

### Priority 2: BACKEND LOGIC
- [ ] Create fee slab CRUD endpoints
- [ ] Update appointment creation to:
  - Check against slabs instead of simple window
  - Auto-apply 30-day reset rule
  - Calculate correct fee based on days since last visit
- [ ] Prompt logic for new vs. follow-up (or move to frontend)

### Priority 3: COMMISSION
- [ ] Verify commission calc uses selected slab fee (not flat rate)
- [ ] Ensure settlement workflow works with new slabs

### Priority 4: FRONTEND UI
- [ ] "Add Fee Structure" page/modal
- [ ] Slab management interface
- [ ] Appointment booking: show fee calculation based on slabs
- [ ] Show "days since last visit" warning/info
- [ ] Doctor accountability: display slab fees alongside commissions

### Priority 5: TESTING
- [ ] Test slab matching logic (correct day range)
- [ ] Test 30-day auto-reset
- [ ] Test commission calculation with dynamic fees
- [ ] Test UI prompts and fee display

---

## 8. KEY DIFFERENCES AT A GLANCE

| Feature | Current | Client Wants |
|---------|---------|--------------|
| **Fee model** | Single fixed fee per doctor | Multiple slabs per doctor (by days) |
| **Follow-up logic** | Simple time window | Day-based slabs with ranges |
| **Auto-reset** | Doctor's `followUpDays` | Fixed 30-day rule |
| **UI prompts** | No prompt on booking | "New patient or follow-up?" prompt |
| **Fee display** | Hidden | Show before booking |
| **Slabs** | Not supported | Full slab management needed |
| **Status management** | Not per-slab | Active/Inactive per slab |
| **Commission** | Separate from fee | Tied to slab fee |

