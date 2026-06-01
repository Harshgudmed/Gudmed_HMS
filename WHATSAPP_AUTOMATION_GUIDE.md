# WhatsApp Automation System — Complete Guide

Your GudMed HMS now has full WhatsApp automation for post-consultation workflows. This guide walks through the implementation and how to test it.

## System Overview

### What It Does
After a doctor saves a consultation, patients automatically receive:
1. **Consultation Summary** — diagnosis, vitals, follow-up via WhatsApp
2. **Prescription with Prices** — itemized medicine list → can purchase at counter or via WhatsApp bot
3. **Pharmacy Team Notification** — staff notified to prepare prescription

Patients can reply via WhatsApp to:
- Purchase medicines and pay via UPI/Cash/Card
- Receive payment receipt automatically

Lab results and radiology reports also send notifications when marked as ready/verified.

---

## Architecture

### Backend Services

#### 1. **whatsappService.js** — Abstraction Layer
- Detects if `WHATSAPP_API_KEY` is set
- **wa.me mode (default)**: Returns a `wa.me` link for staff to send manually
- **API mode**: Calls Twilio/WATI/Meta to send automatically
- No code changes needed to switch modes — just set env vars

#### 2. **messageTemplates.js** — Message Content
All WhatsApp message templates are centralized here:
- `consultationSummary()` — Visit recap
- `prescriptionWithPrices()` — Medicine list with costs
- `paymentReceipt()` — Invoice confirmation
- `labResultReady()` — Lab test results with critical flags
- `radiologyReportReady()` — Imaging report status
- `appointmentReminder()` — Appointment alerts
- `pharmacyTeamNotification()` — Internal staff messages

#### 3. **notificationController.js** — REST Endpoints
```
POST /api/notifications/consultation      — Send consultation summary
POST /api/notifications/prescription      — Send prescription + prices
POST /api/notifications/lab-result        — Send lab results  
POST /api/notifications/radiology-report  — Send radiology report
POST /api/notifications/pharmacy-team     — Notify pharmacy staff
POST /api/whatsapp/webhook                — Incoming webhook (Twilio)
```

#### 4. **whatsappBotController.js** — Pharmacy Bot
Handles 2-way conversations when patient replies to prescription via WhatsApp:
- Asks: "Would you like to purchase? YES/NO"
- If YES → Payment method selection (UPI/Cash/Card)
- UPI: Patient enters transaction reference
- Cash/Card: Patient confirms at counter
- Creates pharmacy sale + invoice automatically

#### 5. **botStateService.js** — Session Storage
In-memory conversation state (phone → session data).
Tracks: patient, items, total, current step in conversation.

### Frontend Components

#### 1. **PostConsultationWorkflow.jsx** — Post-Save Modal
Shows automatically after consultation is saved. Three cards:

**Card 1: Consultation Summary**
- Shows patient name, diagnosis, vitals, follow-up
- Button: "Send via WhatsApp"
- Calls `POST /notifications/consultation`

**Card 2: Prescription** (if items exist)
- Shows itemized medicines with quantity
- Two buttons:
  - "Send to Patient" → WhatsApp prescription message
  - "Purchase at Counter" → Opens PrescriptionPurchaseModal

**Card 3: Pharmacy Team**
- Button: "Notify Pharmacy Team"
- Sends internal staff notification with prescription details

#### 2. **PrescriptionPurchaseModal.jsx** — Counter Purchase Flow
3-step wizard:

**Step 1: Review**
- Shows medicines with prices fetched from pharmacy catalog
- Displays total amount

**Step 2: Payment Selection**
- Cash, UPI (with reference field), Card, Bank Transfer, Insurance
- Confirms payment method

**Step 3: Success**
- Prints receipt automatically
- "Send Receipt to Patient WhatsApp" button
- Calls `POST /notifications/prescription` with invoiceId

#### 3. **whatsapp.js** — Helper Functions
```js
openWhatsApp(url)                    // Opens wa.me link in new tab
buildWaLink(phone, message)          // Constructs wa.me URL
triggerNotification(endpoint, payload) // Calls backend → handles response

// Convenience wrappers
sendConsultationNotification(consultationId)
sendPrescriptionNotification(prescriptionId, {invoiceId?, consultationFee?})
sendLabResultNotification(orderId)
sendRadiologyNotification(orderId)
notifyPharmacyTeam(prescriptionId)
```

---

## Setup & Configuration

### Environment Variables

#### Backend (`.env`)
```env
# ── WhatsApp Mode: wa.me links (zero cost, works today) ─────────────────
WHATSAPP_PROVIDER=wame          # Default — no API key needed
WHATSAPP_COUNTRY_CODE=91        # For India; adjust as needed

# ── OR: Twilio API (send automatically) ───────────────────────────────
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx       # From Twilio console
TWILIO_AUTH_TOKEN=xxxx          # From Twilio console
TWILIO_WHATSAPP_FROM=+14155238886  # Twilio WhatsApp number

# ── OR: WATI API ───────────────────────────────────────────────────────
WHATSAPP_PROVIDER=wati
WHATSAPP_API_KEY=xxxx           # From WATI dashboard
WHATSAPP_API_URL=https://api.wati.io  # WATI endpoint

# ── OR: Meta Cloud API ───────────────────────────────────────────────
WHATSAPP_PROVIDER=meta
WHATSAPP_API_KEY=xxxx           # Meta business account token
META_PHONE_NUMBER_ID=1234567890 # From Meta App Dashboard

# ── Pharmacy Team Phone (optional) ─────────────────────────────────────
WHATSAPP_PHARMACY_TEAM_PHONE=9876543210  # Staff WhatsApp number
```

#### Current Local Setup
```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxx (from your Twilio console)
TWILIO_AUTH_TOKEN=xxxxxx (from your Twilio console)
TWILIO_WHATSAPP_FROM=+14155238886
WHATSAPP_COUNTRY_CODE=91
```
> **Note:** Replace the placeholder values with your actual Twilio credentials from the Twilio Console.

### Frontend (`.env.production`)
```env
VITE_API_URL=https://gudmed-api.onrender.com/api
```

---

## Testing the System (Complete Walkthrough)

### **Test 1: Consultation Creation with Prescription**

1. Login to your local/production instance
2. Go to **Consultations**
3. Click **New Consultation**
4. Select a patient (or create one: **Patients → New Patient**)
5. Select a doctor
6. Fill consultation form:
   - Chief Complaint: "Fever"
   - Diagnosis: "Common Cold"
   - Fill vitals (defaults pre-filled)
7. **Add Prescription**:
   - Add medicines:
     - Drug: "Paracetamol" | Dosage: "500mg" | Qty: 10 | Frequency: "2x daily" | Duration: "5 days"
     - Drug: "Azithromycin" | Dosage: "250mg" | Qty: 5 | Frequency: "1x daily" | Duration: "3 days"
8. Click **Save Consultation**

**Expected Result:**
- ✅ Consultation saved
- ✅ **PostConsultationWorkflow modal appears** with 3 cards

### **Test 2: Send Consultation Summary**

1. In PostConsultationWorkflow modal, Card 1 ("Consultation Summary")
2. Click **"Send via WhatsApp"**

**Expected Result (wa.me mode):**
- ✅ New WhatsApp Web tab opens
- ✅ Message pre-filled with consultation details:
  ```
  *Hospital*
  Consultation Summary — 01 Jun 2026
  ────────────────────────────────
  *Patient:* [Name] (UHID: [MRN])
  *Doctor:* Dr. [Name]
  
  *Chief Complaint:* Fever
  *Diagnosis:* Common Cold
  *Prescription:*
  1. Paracetamol 500mg — 2x daily for 5 days
  2. Azithromycin 250mg — 1x daily for 3 days
  ```
- ✅ You manually click "Send" in WhatsApp
- ✅ Toast notification: "WhatsApp opened — click Send in the chat"
- ✅ Card shows "✅ Sent" badge

**Expected Result (API mode):**
- ✅ Same message but automatically sent to patient's WhatsApp
- ✅ Toast: "Message sent automatically via WhatsApp API"

---

### **Test 3: Send Prescription with Prices**

1. In PostConsultationWorkflow modal, Card 2 ("Prescription")
2. Click **"Send to Patient"**

**Expected Result:**
- ✅ WhatsApp opens (wa.me mode) or message sent (API mode)
- ✅ Message shows:
  ```
  *Hospital — Prescription & Bill*
  ────────────────────────────────
  *Patient:* [Name]
  
  *Medicines:*
  1. Paracetamol 500mg
     Qty: 10 × ₹5.00 = *₹50.00*
  2. Azithromycin 250mg
     Qty: 5 × ₹15.00 = *₹75.00*
  
  ────────────────────────────────
  *Total Amount: ₹125.00*
  
  💊 Reply *YES* to purchase medicines at counter
     or visit our pharmacy.
  ```
- ✅ After 2 seconds, **follow-up message** automatically sent:
  ```
  💊 *Would you like to purchase these medicines from our pharmacy?*
  
  Reply *YES* to order now
  Reply *NO* to skip
  ```
- ✅ **Bot waits for patient reply** (if using Twilio API mode)

---

### **Test 4: Purchase at Counter (PrescriptionPurchaseModal)**

1. In PostConsultationWorkflow modal, Card 2, click **"Purchase at Counter"**

**Expected Result:**
- ✅ **PrescriptionPurchaseModal opens** with 3 steps

#### **Step 1: Review Medicines**
- ✅ Shows table: Medicine | Qty | Rate | Total
- ✅ Displays: Paracetamol 10×₹5 = ₹50, Azithromycin 5×₹15 = ₹75
- ✅ Grand Total: ₹125
- ✅ Button: "Proceed to Payment →"

#### **Step 2: Select Payment Method**
- ✅ Shows 5 buttons: Cash | UPI | Card | Bank Transfer | Insurance
- ✅ Amount to collect: ₹125
- Select **UPI**:
  - ✅ Input field appears: "UPI Reference / Transaction ID"
  - ✅ Shows org's UPI ID (if configured)
- ✅ Enter reference: "407623481291"
- Click **"Confirm Payment"**

#### **Step 3: Success**
- ✅ Shows green checkmark + "Payment Confirmed!"
- ✅ Shows Invoice number (e.g., "INV-1717225000000")
- ✅ Button: "Print Receipt" — **click it**
  - ✅ Receipt prints with hospital name, medicines, total, payment method
- ✅ Button: "Send Receipt to Patient WhatsApp"
  - ✅ WhatsApp opens (wa.me) or message sent (API)
  - ✅ Shows payment confirmation with invoice number

**What happened backend:**
- ✅ Pharmacy sale created (deducts stock from pharmacy inventory)
- ✅ Invoice created in billing system
- ✅ Patient marked as "paid"

---

### **Test 5: Pharmacy Team Notification**

1. Back in PostConsultationWorkflow, Card 3 ("Pharmacy Team")
2. Click **"Notify Pharmacy Team"**

**Expected Result:**
- If `WHATSAPP_PHARMACY_TEAM_PHONE` not set:
  - ✅ Prompt for phone number appears
  - ✅ Enter pharmacy staff number: "9876543210"
  - ✅ WhatsApp opens with message:
    ```
    *Hospital — New Prescription*
    ────────────────────────────
    *Patient:* [Name]
    *Prescription ID:* ABC12345
    *Time:* 01 Jun 2026, 14:30
    
    *Items to dispense:*
    1. Paracetamol 500mg — Qty: 10 (2x daily)
    2. Azithromycin 250mg — Qty: 5 (1x daily)
    
    📋 Please prepare the above medicines.
    ```

- If `WHATSAPP_PHARMACY_TEAM_PHONE=9876543210` set in `.env`:
  - ✅ Message automatically sent to pharmacy team
  - ✅ Toast: "Message sent automatically via WhatsApp API"

---

### **Test 6: Lab Result Notification**

1. Go to **Laboratory Module**
2. Create or find a lab order
3. Click **Enter Results** when test is complete
4. Fill result values, mark as **Verified**
5. Click **Save**

**Expected Result:**
- ✅ Toast with button: "Notify Patient via WhatsApp"
- Click it:
  - ✅ WhatsApp opens (wa.me) or message sent (API)
  - ✅ Message shows:
    ```
    *Hospital — Lab Results Ready*
    ────────────────────────────────
    *Patient:* [Name] (UHID: [MRN])
    *Order #:* LAB-001
    *Date:* 01 Jun 2026
    
    *Results:*
    • Complete Blood Count: *12.5 g/dL* ✅
    • White Blood Cell Count: *7.2* ⚠️ Abnormal
    • Platelet Count: *150* ✅ CRITICAL
    
    Please collect your detailed report from Hospital.
    ```

---

### **Test 7: Radiology Report Notification**

1. Go to **Radiology Module**
2. Create or find a radiology order
3. Upload report, mark as **Final**
4. Click **Verify**

**Expected Result:**
- ✅ Toast with button: "Notify Patient via WhatsApp"
- Click it:
  - ✅ WhatsApp opens or message sent
  - ✅ Message shows:
    ```
    *Hospital — Radiology Report Ready*
    ────────────────────────────────
    *Patient:* [Name]
    *Exam:* Chest X-Ray
    *Order #:* RAD-001
    *Date:* 01 Jun 2026
    
    *Status:* ✅ Report Finalised
    
    ⚠️ *Critical findings present. Please consult your doctor immediately.*
    _Significant pleural effusion on the right side. Recommend CT thorax._
    
    Please collect your report from Hospital.
    ```

---

### **Test 8: WhatsApp Bot Reply (If Using Twilio API)**

If your `.env` has:
```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxxxx (your Twilio credentials)
```

**Setup Twilio Webhook:**
1. Go to Twilio Console → WhatsApp → Messaging
2. Under "Webhook URL", set:
   ```
   https://[your-domain]/api/notifications/whatsapp-webhook
   ```
3. Choose: Incoming Messages → Webhook POST

**Test Patient Reply:**
1. Patient receives prescription message (auto-sent via Twilio)
2. Patient replies in WhatsApp: `YES`
3. **Backend receives** the webhook from Twilio
4. **Bot automatically replies:**
   ```
   ✅ *Great! Let's process your order.*
   
   *Medicines:*
   1. Paracetamol 500mg x10 — ₹50.00
   2. Azithromycin 250mg x5 — ₹75.00
   
   *Total: ₹125.00*
   
   *Choose payment method:*
   *1* — UPI (Google Pay, PhonePe, Paytm)
   *2* — Cash at counter
   *3* — Card at counter
   
   Reply with *1*, *2*, or *3*
   ```
5. Patient replies: `1`
6. **Bot asks for UPI reference:**
   ```
   *UPI Payment*
   
   Amount: *₹125.00*
   
   Pay to UPI ID:
   *hospital@upi*
   
   After payment, reply with your *UPI reference/transaction number* and we will confirm your order.
   ```
7. Patient replies: `407623481291`
8. **Bot confirms:**
   ```
   ✅ *Payment Confirmed!*
   ━━━━━━━━━━━━━━━━━━━━━━━
   *Receipt #:* INV-ABC123
   *Patient:* [Name]
   
   *Medicines Purchased:*
   1. Paracetamol 500mg x10 — ₹50.00
   2. Azithromycin 250mg x5 — ₹75.00
   
   *Total Paid: ₹125.00*
   *Payment Mode:* UPI
   *Reference:* 407623481291
   
   Thank you for choosing us! 🙏
   _Your medicines will be ready for pickup._
   ```

**Backend automatically:**
- ✅ Creates pharmacy sale
- ✅ Creates invoice
- ✅ Marks as paid
- ✅ Clears bot session

---

## Troubleshooting

### WhatsApp Link Opens But Message is Empty
- **Cause:** Patient phone number not on file
- **Fix:** Ensure patient has `phonePrimary` field filled

### "Could not send notification"
- **Cause:** API endpoint error
- **Fix:** Check backend logs for `/api/notifications/*` response

### Twilio Webhook Not Triggering
- **Cause:** Webhook URL not set in Twilio Console
- **Fix:** 
  1. Go to Twilio → Messaging → WhatsApp → Settings
  2. Set webhook URL to: `https://[your-domain]/api/notifications/whatsapp-webhook`
  3. Ensure backend is publicly accessible

### Messages Appear in Wrong Language/Currency
- **Cause:** Org settings not configured
- **Fix:** Go to **Settings → Organization** and set:
  - Currency: INR
  - Country Code: 91
  - UPI ID: hospital@upi (optional)

---

## Production Deployment

### To Enable Automatic Sending (API Mode)

#### Option 1: Twilio (Recommended — Free Tier Available)
1. Sign up at [twilio.com](https://twilio.com)
2. Go to Messaging → Try WhatsApp
3. Copy credentials to `.env`:
   ```env
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=ACxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxx
   TWILIO_WHATSAPP_FROM=+14155238886
   ```
4. Set webhook in Twilio console to: `https://gudmed-api.onrender.com/api/notifications/whatsapp-webhook`

#### Option 2: WATI (No Webhook Needed — Simpler)
1. Sign up at [wati.io](https://wati.io)
2. Get API key from dashboard
3. Set in `.env`:
   ```env
   WHATSAPP_PROVIDER=wati
   WHATSAPP_API_KEY=your_key
   WHATSAPP_API_URL=https://api.wati.io
   ```

#### Option 3: Meta Cloud API
1. Set up Meta Business Account
2. Create WhatsApp Business App
3. Set in `.env`:
   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_API_KEY=your_access_token
   META_PHONE_NUMBER_ID=your_phone_id
   ```

---

## Code References

### Key Files
- **Backend Service**: [whatsappService.js](backend/src/services/whatsappService.js)
- **Message Templates**: [messageTemplates.js](backend/src/services/messageTemplates.js)
- **Notification Controller**: [notificationController.js](backend/src/controllers/notificationController.js)
- **Bot Handler**: [whatsappBotController.js](backend/src/controllers/whatsappBotController.js)
- **Bot State**: [botStateService.js](backend/src/services/botStateService.js)

### Frontend Components
- **Workflow Modal**: [PostConsultationWorkflow.jsx](frontend/src/components/consultations/PostConsultationWorkflow.jsx)
- **Purchase Modal**: [PrescriptionPurchaseModal.jsx](frontend/src/components/pharmacy/PrescriptionPurchaseModal.jsx)
- **Helpers**: [whatsapp.js](frontend/src/lib/whatsapp.js)

---

## Summary

Your WhatsApp automation system is **fully functional**:
- ✅ Consultations trigger post-workflow modal
- ✅ Prescription messages auto-generate with prices
- ✅ Counter purchases create invoices automatically
- ✅ Lab/radiology results notify patients
- ✅ Pharmacy team gets staff notifications
- ✅ Bot handles 2-way conversations (payment via WhatsApp)
- ✅ Works in **wa.me mode** (no API cost) or **API mode** (automatic)

**Test with wa.me links today. Plug in Twilio/WATI/Meta when ready for auto-sending.**
