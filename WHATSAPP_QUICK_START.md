# WhatsApp Automation — Quick Start (5 Minutes)

## What Just Launched

Your GudMed HMS now has **complete WhatsApp automation** for the entire patient journey:

✅ **Auto-send consultations** — Diagnosis, vitals, follow-up to patient WhatsApp  
✅ **Prescription with prices** — "Purchase at counter?" with itemized medicines  
✅ **Counter purchase flow** — Patient pays via UPI/Cash/Card, invoice auto-generated  
✅ **Lab result notifications** — Patients notified when tests are ready  
✅ **Radiology report notifications** — Reports shared automatically  
✅ **Pharmacy team alerts** — Staff get prep notifications  
✅ **2-way bot conversations** — Patient replies YES → bot guides payment (Twilio only)

---

## Try It Now (2-Minute Test)

### Step 1: Start Your Servers
```bash
# Terminal 1 — Backend
cd backend
npm start

# Terminal 2 — Frontend (in another terminal/VS Code)
cd frontend
npm run dev
```

### Step 2: Create a Test Consultation

1. Open browser: `http://localhost:5173`
2. Login with demo credentials (check `.env` for admin/doctor creds)
3. Go to **Consultations** → **New Consultation**
4. Fill form:
   - Patient: Select any patient (or create one)
   - Doctor: Select any doctor
   - Chief Complaint: "Fever"
   - Diagnosis: "Cold"
   - **Add Prescription**:
     - Drug: "Paracetamol", Qty: 10
     - Drug: "Cough Syrup", Qty: 1
5. Click **Save Consultation**

### Step 3: See the Magic

**A modal pops up automatically** with 3 cards:

| Card | Action | Result |
|------|--------|--------|
| **Consultation Summary** | Click "Send via WhatsApp" | WhatsApp Web opens with pre-filled message |
| **Prescription** | Click "Send to Patient" | WhatsApp shows: Drug list with prices + total |
| **Prescription** | Click "Purchase at Counter" | Modal opens: Select payment → Print receipt → Send to WhatsApp |
| **Pharmacy Team** | Click "Notify Team" | Staff gets message to prepare medicines |

**WhatsApp opens with full consultation details — you click Send!**

---

## How It Works (Architecture)

### Current Mode: **wa.me Links** (No Cost, Works Today)

```
1. Doctor saves consultation
   ↓
2. Backend generates WhatsApp message with consultation details
   ↓
3. Frontend receives wa.me link: https://wa.me/919876543210?text=Consultation%20Summary...
   ↓
4. Link opens WhatsApp Web → message pre-filled → Staff/Patient clicks Send
```

**No API cost. Just WhatsApp Web. Works with sandboxes.**

---

### Future Mode: **Automatic Sending** (Twilio/WATI/Meta)

Just change `.env`:

```env
WHATSAPP_PROVIDER=twilio
TWILIO_ACCOUNT_SID=ACxxxx
TWILIO_AUTH_TOKEN=xxxx
```

Now messages send **automatically** — no manual click needed.

---

## Code Layout

### Backend
```
backend/src/
├── services/
│   ├── whatsappService.js       ← Core abstraction (wa.me OR API)
│   ├── messageTemplates.js      ← All WhatsApp message text
│   └── botStateService.js       ← Bot conversation storage
├── controllers/
│   ├── notificationController.js ← API endpoints
│   └── whatsappBotController.js  ← Bot reply handler
└── routes/
    └── notificationRoutes.js     ← Endpoint routes
```

### Frontend
```
frontend/src/
├── components/
│   ├── consultations/
│   │   └── PostConsultationWorkflow.jsx  ← Modal after save
│   └── pharmacy/
│       └── PrescriptionPurchaseModal.jsx ← Counter purchase 3-step
└── lib/
    └── whatsapp.js               ← Helper functions
```

---

## Testing Each Feature

### 1. **Consultation Summary** (5 seconds)
1. Save consultation
2. Click "Send via WhatsApp"
3. ✅ WhatsApp opens with consultation details

### 2. **Prescription with Prices** (5 seconds)
1. Save consultation with prescription items
2. Click "Send to Patient"
3. ✅ WhatsApp shows itemized medicines + total amount
4. **After 2 seconds**, automatic follow-up: "Would you like to purchase? YES/NO"

### 3. **Counter Purchase** (10 seconds)
1. Click "Purchase at Counter" button
2. Step 1: Review medicines with prices fetched from pharmacy
3. Step 2: Select payment method (Cash/UPI/Card)
4. Step 3: Print receipt → Send receipt to patient via WhatsApp
5. ✅ Pharmacy sale + invoice auto-created

### 4. **Lab Results** (after entering results)
1. Go to Laboratory → Complete a test
2. Enter results, mark as "Verified"
3. ✅ Toast appears: "Notify Patient via WhatsApp"
4. Click it → WhatsApp opens with test results + abnormal flags

### 5. **Radiology Reports** (after uploading report)
1. Go to Radiology → Upload report
2. Mark as "Final"
3. ✅ Toast: "Notify Patient via WhatsApp"
4. Results in WhatsApp with critical findings alert

---

## Configuration

### For Local Testing (wa.me mode — current setup)

No configuration needed! Works out of the box.

```env
WHATSAPP_PROVIDER=wame
WHATSAPP_COUNTRY_CODE=91
```

Just click "Send" in WhatsApp Web.

---

### For Production (Automatic Sending)

#### Option A: Twilio (Recommended)

1. Sign up: [twilio.com](https://twilio.com) (free tier available)
2. Go to: Messaging → Try WhatsApp
3. Copy credentials to `.env`:
   ```env
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=ACf7527f1...
   TWILIO_AUTH_TOKEN=e738...
   TWILIO_WHATSAPP_FROM=+14155238886
   ```
4. Set webhook in Twilio console:
   ```
   https://gudmed-api.onrender.com/api/notifications/whatsapp-webhook
   ```
5. Redeploy backend
6. Done! Messages now send automatically

#### Option B: WATI (Simpler — No Webhook)

1. Sign up: [wati.io](https://wati.io)
2. Get API key from dashboard
3. Add to `.env`:
   ```env
   WHATSAPP_PROVIDER=wati
   WHATSAPP_API_KEY=your_api_key
   WHATSAPP_API_URL=https://api.wati.io
   ```
4. Redeploy
5. Done!

#### Option C: Meta Cloud API

1. Set up Meta Business Account
2. Create WhatsApp Business App
3. Add to `.env`:
   ```env
   WHATSAPP_PROVIDER=meta
   WHATSAPP_API_KEY=your_access_token
   META_PHONE_NUMBER_ID=your_phone_id
   ```

---

## Test Script

Run the API health check:

```powershell
# Windows
.\TEST_WHATSAPP_API.ps1

# Or: Linux/Mac
bash TEST_WHATSAPP_API.sh
```

This verifies all notification endpoints are responding correctly.

---

## Troubleshooting

### Problem: WhatsApp Link Opens But Message is Empty

**Cause:** Patient missing phone number  
**Fix:** Add phone number to patient profile

### Problem: PostConsultationWorkflow Modal Doesn't Appear

**Cause:** Prescription items not properly saved  
**Fix:** Ensure prescription items are added before clicking "Save Consultation"

### Problem: "Could not send notification"

**Cause:** Backend API error  
**Fix:** 
1. Check backend is running
2. Check patient has `phonePrimary` field
3. Check console logs for error details

### Problem: Twilio Webhook Not Triggering

**Cause:** Webhook URL not configured in Twilio Console  
**Fix:**
1. Go to Twilio → WhatsApp → Settings
2. Find "Webhook URL"
3. Set it to: `https://[your-domain]/api/notifications/whatsapp-webhook`
4. Ensure backend is publicly accessible

---

## What's Included

### ✅ Built In
- WhatsApp message generation (all scenarios)
- wa.me link opening (no cost, works today)
- Twilio/WATI/Meta integration ready (just set env vars)
- Consultation summaries with vitals
- Prescription pricing from pharmacy catalog
- Lab results with critical flags
- Radiology report alerts
- Counter purchase flow with payment
- 2-way pharmacy bot (Twilio only)
- Automatic invoice creation after purchase
- Receipt printing
- Receipt sending to patient

### 🔜 Optional (Not Needed Initially)
- WhatsApp Business API (Twilio/WATI/Meta) — for automatic sending
- Webhook handling for patient replies (Twilio only)
- Advanced bot flows (insurance, follow-ups, etc.)

---

## Next Steps

1. **Test locally** (follow "Try It Now" section)
2. **Check webhook script** runs without errors:
   ```powershell
   .\TEST_WHATSAPP_API.ps1
   ```
3. **Deploy to production**:
   - Frontend redeploy happens automatically when you push to GitHub
   - Backend redeploy happens automatically when you push to GitHub
4. **Enable Twilio** (optional):
   - Sign up for Twilio free tier
   - Get credentials
   - Update `.env` on production
   - Redeploy backend
5. **Set pharmacy team phone** (optional):
   ```env
   WHATSAPP_PHARMACY_TEAM_PHONE=9876543210
   ```

---

## Key Files Reference

**Full Documentation**: [WHATSAPP_AUTOMATION_GUIDE.md](WHATSAPP_AUTOMATION_GUIDE.md)

**Backend Services**:
- [whatsappService.js](backend/src/services/whatsappService.js) — Core logic
- [messageTemplates.js](backend/src/services/messageTemplates.js) — Messages
- [notificationController.js](backend/src/controllers/notificationController.js) — API
- [whatsappBotController.js](backend/src/controllers/whatsappBotController.js) — Bot

**Frontend Components**:
- [PostConsultationWorkflow.jsx](frontend/src/components/consultations/PostConsultationWorkflow.jsx) — Modal
- [PrescriptionPurchaseModal.jsx](frontend/src/components/pharmacy/PrescriptionPurchaseModal.jsx) — Purchase
- [whatsapp.js](frontend/src/lib/whatsapp.js) — Helpers

---

## Support

**Testing locally?** Follow the "Try It Now" section.

**Deploy to production?** See the Configuration section.

**Need help?** Check the full guide: [WHATSAPP_AUTOMATION_GUIDE.md](WHATSAPP_AUTOMATION_GUIDE.md)

---

**You're all set! Go test it.** 🚀
