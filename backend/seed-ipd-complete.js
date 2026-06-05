/**
 * seed-ipd-complete.js
 *
 * Comprehensive IPD seed script for GudMed HMS
 * ─────────────────────────────────────────────
 * RULES:
 *   • Only uses EXISTING patients (fetched by name / MRN / phone)
 *   • Only uses EXISTING wards & beds (fetched from DB)
 *   • Only uses EXISTING doctors (fetched from DB)
 *   • Admits 50 patients
 *   • Transfers 20 patients between wards mid-stay
 *   • Discharges 15 patients with full discharge summary
 *   • Adds doctor + nursing clinical notes with vitals for every admission
 *   • Generates IPD bills & records payments for all admissions
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d
}

function rand(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function uniqueInvoiceNum() {
  return `IPD-INV-${Date.now()}-${Math.floor(Math.random() * 9999)}`
}

function uniqueReceiptNum() {
  return `IPD-RCP-${Date.now()}-${Math.floor(Math.random() * 9999)}`
}

// ──────────────────────────────────────────────────────────────────────────────
// Clinical content banks
// ──────────────────────────────────────────────────────────────────────────────

const CHIEF_COMPLAINTS = [
  'Severe chest pain radiating to left arm',
  'High-grade fever with chills and rigors',
  'Breathlessness on exertion and at rest',
  'Uncontrolled hypertension with headache',
  'Acute abdominal pain – right iliac fossa',
  'Altered sensorium and confusion',
  'Diabetic ketoacidosis – polyuria and vomiting',
  'Road traffic accident – polytrauma',
  'Post-operative care – elective surgery',
  'Stroke – left-sided hemiplegia',
  'Severe dehydration – watery diarrhoea',
  'Acute exacerbation of COPD',
  'Renal failure – oliguria and swelling',
  'Sepsis – fever, hypotension, tachycardia',
  'Deep vein thrombosis – right leg swelling',
  'Pulmonary embolism – sudden breathlessness',
  'Ectopic pregnancy – sudden lower abdominal pain',
  'Pre-eclampsia – high BP in pregnancy',
  'Dengue haemorrhagic fever – thrombocytopaenia',
  'Acute MI – ECG changes and troponin elevation',
]

const DIAGNOSES = [
  'Acute Myocardial Infarction (STEMI)',
  'Community-Acquired Pneumonia',
  'Congestive Heart Failure',
  'Hypertensive Emergency',
  'Acute Appendicitis',
  'Hypertensive Encephalopathy',
  'Diabetic Ketoacidosis',
  'Polytrauma – RTA',
  'Post-operative Wound Care',
  'Ischaemic Stroke',
  'Acute Gastroenteritis with Dehydration',
  'Acute Exacerbation of COPD',
  'Chronic Kidney Disease Stage IV',
  'Septicaemia',
  'Deep Vein Thrombosis',
  'Pulmonary Embolism',
  'Ectopic Pregnancy',
  'Pre-eclampsia with Severe Features',
  'Dengue Haemorrhagic Fever',
  'Acute NSTEMI',
]

const DISCHARGE_DIAGNOSES = [
  'Resolved Pneumonia – Clinically stable',
  'Stabilised Heart Failure – Euvolaemic',
  'Controlled Hypertensive Emergency',
  'Post-appendicectomy – Wound healing well',
  'Recovered Diabetic Ketoacidosis – Euglycaemic',
  'Improving Stroke – Physiotherapy initiated',
  'Rehydrated Gastroenteritis',
  'Resolved COPD Exacerbation',
  'Dengue Fever – Platelet recovery complete',
  'Post-PTCA – Stable Angina managed',
  'DVT – Anticoagulation initiated',
  'Ectopic Pregnancy – Post-surgical recovery',
  'Pre-eclampsia managed – Delivered safely',
  'Sepsis – Source controlled and antibiotics completed',
  'Polytrauma – Orthopaedic fixation done, mobilising',
]

const DOCTOR_NOTE_TEMPLATES = [
  (vitals, day) => `Day ${day} - Consultant Review:\nPatient reviewed. Hemodynamically stable. BP ${vitals.bp}, Pulse ${vitals.pulse}/min, SpO2 ${vitals.spo2}%, Temp ${vitals.temp}°F. Chest: clear bilaterally. Abdomen: soft, non-tender. Current management plan continued. IV fluids running at maintenance. Will review LFT/RFT reports tomorrow.`,
  (vitals, day) => `Day ${day} - Senior Physician Review:\nPatient showing improvement. Vitals: BP ${vitals.bp} mmHg, HR ${vitals.pulse} bpm, RR ${vitals.rr}/min, SpO2 ${vitals.spo2}%, Temperature ${vitals.temp}°F. Decreased oxygen requirement noted. Diet tolerance improving. Continue current medications. ECG unchanged. Echo scheduled.`,
  (vitals, day) => `Day ${day} - Consultant Ward Round:\nGeneral condition improving. Patient alert and oriented. BP ${vitals.bp}, Pulse ${vitals.pulse}/min, Temperature ${vitals.temp}°F, SpO2 ${vitals.spo2}%. Wound site clean, no signs of infection. Bowel sounds present. Urine output adequate at 40–50 ml/hr. IV antibiotics to continue for 48 hours.`,
  (vitals, day) => `Day ${day} - Medical Review:\nPatient reviewed post-procedure. Stable vitals: BP ${vitals.bp}, HR ${vitals.pulse}/min, SpO2 ${vitals.spo2}%. Lab values improving – WBC trending down, CRP reducing. Patient ambulatory with support. Physiotherapy initiated. Plan to step down from IV to oral medications by tomorrow if condition maintained.`,
  (vitals, day) => `Day ${day} - Evening Round:\nNight was uneventful. No new complaints. BP ${vitals.bp}, Pulse ${vitals.pulse}, Temp ${vitals.temp}°F. Accepting orals well. Catheter output satisfactory. Ultrasound report reviewed – improving. If stable tomorrow, consider discharge planning.`,
]

const NURSING_NOTE_TEMPLATES = [
  (vitals, shift) => `${shift} Shift Nursing Note:\nPatient conscious, cooperative. Vitals recorded: BP ${vitals.bp} mmHg, Pulse ${vitals.pulse}/min, RR ${vitals.rr}/min, SpO2 ${vitals.spo2}%, Temp ${vitals.temp}°F, Weight ${vitals.weight} kg. IV line patent, infusing well at right forearm. Medications administered as per chart – all on time. Patient repositioned to prevent bed sores. Oral hygiene done. Input-output chart maintained.`,
  (vitals, shift) => `${shift} Shift Assessment:\nAll vitals within acceptable range. BP ${vitals.bp}, HR ${vitals.pulse}, SpO2 ${vitals.spo2}%, Temp ${vitals.temp}°F. Patient complained of mild pain (3/10) – PRN analgesic given with relief. Wound dressing changed aseptically. Catheter care done. IV site inspected – no phlebitis. Patient and family educated on activity restrictions and diet.`,
  (vitals, shift) => `${shift} Nursing Entry:\nPatient resting comfortably. VS stable: BP ${vitals.bp}, P ${vitals.pulse}/min, R ${vitals.rr}/min, SpO2 ${vitals.spo2}%, T ${vitals.temp}°F. Breakfast/lunch/dinner served – patient consumed approximately 70% of meal. IV medications given on schedule. Ambulation assisted twice. No falls. Call bell within reach. Relatives instructed not to bring outside food.`,
  (vitals, shift) => `${shift} Shift Report:\nHandover received from previous shift. Patient status unchanged, haemodynamically stable. BP ${vitals.bp} mmHg, Pulse ${vitals.pulse}/min, Temp ${vitals.temp}°F, SpO2 ${vitals.spo2}%. Prescribed medications given. Blood samples collected for morning labs. Patient hydration adequate. Foley catheter draining clear urine. Night sedation given as prescribed. Patient sleeping.`,
]

const TREATMENT_SUMMARIES = [
  'Patient was admitted and treated with IV antibiotics (Cefoperazone-Sulbactam 1.5g BD), IV fluids, bronchodilators, and supportive care. Condition improved progressively.',
  'Patient managed with anticoagulation therapy (Heparin infusion followed by Warfarin), diuretics, and cardiac monitoring. Serial ECGs and troponin levels monitored.',
  'Surgical intervention performed successfully. Post-operative care included wound management, deep breathing exercises, early ambulation, and IV analgesics.',
  'Patient resuscitated with IV fluids, insulin infusion, electrolyte correction, and close glucose monitoring every 2 hours. Ketosis resolved by day 3.',
  'Conservative management with IV fluids, anti-emetics, antacids, and dietary modifications. Oral intake resumed gradually.',
]

const MEDICATIONS_ON_DISCHARGE = [
  'Tab. Metoprolol 25mg OD, Tab. Atorvastatin 40mg HS, Tab. Aspirin 75mg OD, Tab. Clopidogrel 75mg OD, Tab. Ramipril 5mg OD – continue for 3 months',
  'Cap. Amoxicillin-Clavulanate 625mg BD × 7 days, Tab. Pantoprazole 40mg OD × 14 days, Syrup Benadryl 10ml TDS × 5 days',
  'Tab. Amlodipine 5mg OD, Tab. Losartan 50mg OD, Tab. Furosemide 40mg OD (morning), Tab. Spironolactone 25mg OD',
  'Inj. Insulin Glargine 10 units subcutaneous at bedtime, Tab. Metformin 500mg BD with meals, Tab. Glimepiride 1mg OD',
  'Tab. Rivaroxaban 20mg OD with evening meal × 3 months, Tab. Pantoprazole 40mg OD, Tab. Calcium + Vit D3 OD',
]

const FOLLOW_UP_INSTRUCTIONS = [
  'Review in OPD after 1 week with complete blood count, renal function tests. Avoid strenuous activities for 4 weeks.',
  'Cardiology OPD review after 2 weeks. Repeat echo after 1 month. Strict salt restriction (<2g/day).',
  'Wound review after 5 days. Suture removal at 10 days. Avoid heavy lifting for 6 weeks.',
  'Diabetes clinic review in 2 weeks with HbA1c and fasting glucose. Blood sugar monitoring twice daily at home.',
  'Chest physiotherapy to continue at home. Spirometry after 6 weeks. Pulmonology review if symptoms recur.',
]

const ADDITIONAL_CHARGES_TEMPLATES = [
  [
    { name: 'ECG', type: 'Investigation', amount: 300, quantity: 3 },
    { name: 'Echo-Cardiography', type: 'Investigation', amount: 2500, quantity: 1 },
    { name: 'Nursing Procedure Charges', type: 'Nursing', amount: 500, quantity: 5 },
    { name: 'Doctor Visit Charges', type: 'Consultation', amount: 800, quantity: 5 },
    { name: 'IV Cannula & Consumables', type: 'Consumables', amount: 150, quantity: 3 },
  ],
  [
    { name: 'X-Ray Chest PA', type: 'Radiology', amount: 400, quantity: 2 },
    { name: 'CBC with Differential', type: 'Laboratory', amount: 250, quantity: 4 },
    { name: 'Nebulisation Charges', type: 'Nursing', amount: 200, quantity: 6 },
    { name: 'Doctor Visit Charges', type: 'Consultation', amount: 800, quantity: 4 },
    { name: 'Oxygen Therapy Charges', type: 'Therapy', amount: 400, quantity: 3 },
  ],
  [
    { name: 'USG Abdomen', type: 'Radiology', amount: 1200, quantity: 1 },
    { name: 'Liver Function Tests', type: 'Laboratory', amount: 600, quantity: 2 },
    { name: 'IV Antibiotic Administration', type: 'Nursing', amount: 300, quantity: 6 },
    { name: 'Doctor Visit Charges', type: 'Consultation', amount: 800, quantity: 5 },
    { name: 'Foley Catheter & Urobag', type: 'Consumables', amount: 450, quantity: 1 },
  ],
]

const PAYMENT_METHODS = ['cash', 'credit_card', 'debit_card', 'mobile_money', 'bank_transfer']

// ──────────────────────────────────────────────────────────────────────────────
// Vitals generator
// ──────────────────────────────────────────────────────────────────────────────

function generateVitals() {
  const systolic = 110 + Math.floor(Math.random() * 60)  // 110–170
  const diastolic = 70 + Math.floor(Math.random() * 30)  // 70–100
  return {
    bp: `${systolic}/${diastolic}`,
    pulse: 60 + Math.floor(Math.random() * 50),           // 60–110
    rr: 14 + Math.floor(Math.random() * 8),               // 14–22
    spo2: 92 + Math.floor(Math.random() * 8),             // 92–100
    temp: (97.5 + Math.random() * 3.5).toFixed(1),        // 97.5–101
    weight: 50 + Math.floor(Math.random() * 50),          // 50–100 kg
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Clinical notes builder — creates 4–6 notes per admission (doctor + nursing)
// ──────────────────────────────────────────────────────────────────────────────

function buildClinicalNotes(admissionDaysAgo, doctorName, nurseName) {
  const notes = []

  const totalDays = admissionDaysAgo
  const noteDays = Math.min(totalDays, 5)

  for (let day = 1; day <= noteDays; day++) {
    const dateOfNote = daysAgo(totalDays - day)

    // Doctor morning round
    const vitals = generateVitals()
    const docTmpl = DOCTOR_NOTE_TEMPLATES[day % DOCTOR_NOTE_TEMPLATES.length]
    notes.push({
      id: `note-doc-${Date.now()}-${day}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date(dateOfNote.setHours(9, 0, 0, 0)).toISOString(),
      noteType: 'Doctor',
      note: docTmpl(vitals, day),
      authorName: doctorName,
      vitals: {
        bloodPressure: vitals.bp,
        pulseRate: vitals.pulse,
        respiratoryRate: vitals.rr,
        oxygenSaturation: vitals.spo2,
        temperature: vitals.temp,
        weight: vitals.weight,
      },
    })

    // Nursing morning shift
    const vitalsMorning = generateVitals()
    const nursTmpl = NURSING_NOTE_TEMPLATES[day % NURSING_NOTE_TEMPLATES.length]
    notes.push({
      id: `note-nur-am-${Date.now()}-${day}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date(new Date(dateOfNote).setHours(8, 30, 0, 0)).toISOString(),
      noteType: 'Nursing',
      note: nursTmpl(vitalsMorning, 'Morning'),
      authorName: nurseName,
      vitals: {
        bloodPressure: vitalsMorning.bp,
        pulseRate: vitalsMorning.pulse,
        respiratoryRate: vitalsMorning.rr,
        oxygenSaturation: vitalsMorning.spo2,
        temperature: vitalsMorning.temp,
        weight: vitalsMorning.weight,
      },
    })

    // Nursing evening shift
    const vitalsEvening = generateVitals()
    notes.push({
      id: `note-nur-pm-${Date.now()}-${day}-${Math.random().toString(36).slice(2, 7)}`,
      date: new Date(new Date(dateOfNote).setHours(20, 0, 0, 0)).toISOString(),
      noteType: 'Nursing',
      note: NURSING_NOTE_TEMPLATES[(day + 2) % NURSING_NOTE_TEMPLATES.length](vitalsEvening, 'Evening'),
      authorName: nurseName,
      vitals: {
        bloodPressure: vitalsEvening.bp,
        pulseRate: vitalsEvening.pulse,
        respiratoryRate: vitalsEvening.rr,
        oxygenSaturation: vitalsEvening.spo2,
        temperature: vitalsEvening.temp,
        weight: vitalsEvening.weight,
      },
    })
  }

  return notes
}

// ──────────────────────────────────────────────────────────────────────────────
// MAIN
// ──────────────────────────────────────────────────────────────────────────────

async function seedIPD() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — IPD COMPLETE SEED (Existing Patients Only)')
  console.log('═'.repeat(70) + '\n')

  try {
    // ── 1. Fetch existing patients ──────────────────────────────────────────
    console.log('🔍 Step 1: Fetching existing patients from DB (by name / MRN / phone)...')

    // We fetch patients that exist — ordered by createdAt so the newest are first
    const existingPatients = await db.patient.findMany({
      where: {
        organizationId: ORG_ID,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // take up to 100 so we have buffer to pick 50
      select: {
        id: true,
        mrn: true,
        firstName: true,
        lastName: true,
        phonePrimary: true,
        gender: true,
        dateOfBirth: true,
      },
    })

    if (existingPatients.length === 0) {
      console.error('❌ No existing patients found in DB.')
      console.error('   Please run your patient seed script first.')
      process.exit(1)
    }

    console.log(`   ✅ Found ${existingPatients.length} existing patients`)
    existingPatients.slice(0, 5).forEach(p =>
      console.log(`      • ${p.mrn} | ${p.firstName} ${p.lastName} | ${p.phonePrimary || 'no phone'}`)
    )
    if (existingPatients.length > 5) console.log(`      • … and ${existingPatients.length - 5} more`)

    // Pick at most 50 patients
    const patients = existingPatients.slice(0, 50)
    console.log(`\n   📋 Will admit ${patients.length} patients\n`)

    // ── 2. Fetch existing doctors ───────────────────────────────────────────
    console.log('🔍 Step 2: Fetching existing doctors...')
    const doctors = await db.user.findMany({
      where: { organizationId: ORG_ID, role: 'doctor', isActive: true },
      select: { id: true, fullName: true, specialization: true },
    })

    if (doctors.length === 0) {
      console.error('❌ No doctors found. Please seed doctors first.')
      process.exit(1)
    }
    console.log(`   ✅ Found ${doctors.length} doctors\n`)

    // ── 3. Fetch existing wards & available beds ────────────────────────────
    console.log('🔍 Step 3: Fetching existing wards and available beds...')
    const wards = await db.ward.findMany({
      where: { organizationId: ORG_ID, isActive: true },
      include: {
        beds: {
          where: { status: 'available' },
        },
      },
    })

    if (wards.length === 0) {
      console.error('❌ No wards found. Please run seed-wards-and-beds.js first.')
      process.exit(1)
    }

    // Build a flat pool of available beds with ward context
    const availableBedPool = []
    for (const ward of wards) {
      for (const bed of ward.beds) {
        availableBedPool.push({ bed, ward })
      }
    }

    console.log(`   ✅ Found ${wards.length} wards with ${availableBedPool.length} available beds\n`)

    if (availableBedPool.length < patients.length) {
      console.warn(`   ⚠️  Only ${availableBedPool.length} beds available — will admit ${availableBedPool.length} patients instead of ${patients.length}`)
    }

    const admitCount = Math.min(patients.length, availableBedPool.length)

    // ── 4. Shuffle bed pool so different wards are used ────────────────────
    availableBedPool.sort(() => Math.random() - 0.5)

    // ── 5. Create nurse names pool ──────────────────────────────────────────
    const NURSE_NAMES = [
      'Sr. Priya Sharma', 'Sr. Anjali Singh', 'Sr. Divya Patel', 'Sr. Neha Gupta',
      'Sr. Pooja Iyer', 'Sr. Kavya Reddy', 'Sr. Meera Bhat', 'Sr. Sunita Verma',
    ]

    // ── 6. Admit 50 patients ────────────────────────────────────────────────
    console.log(`\n🛏️  Step 4: Admitting ${admitCount} patients to wards...\n`)

    const admissions = []
    const usedBedIds = new Set()
    let admitIdx = 0

    for (let i = 0; i < admitCount; i++) {
      const patient = patients[i]
      const { bed, ward } = availableBedPool[admitIdx++]

      if (usedBedIds.has(bed.id)) {
        console.log(`   ⏭️  Skipping bed ${bed.bedNumber} (already used)`)
        i--
        if (admitIdx >= availableBedPool.length) break
        continue
      }
      usedBedIds.add(bed.id)

      const doctor = doctors[i % doctors.length]
      const admissionDaysAgo = 3 + Math.floor(Math.random() * 14) // admitted 3–17 days ago
      const admissionDate = daysAgo(admissionDaysAgo)
      const chiefComplaint = CHIEF_COMPLAINTS[i % CHIEF_COMPLAINTS.length]
      const admissionDiagnosis = DIAGNOSES[i % DIAGNOSES.length]
      const dailyRate = ward.type === 'icu' ? 5000 : ward.type === 'private' ? 3000 : 1500
      const days = admissionDaysAgo
      const additionalCharges = rand(ADDITIONAL_CHARGES_TEMPLATES)
      const extraTotal = additionalCharges.reduce((s, c) => s + c.amount * c.quantity, 0)
      const roomTotal = dailyRate * days
      const totalBill = roomTotal + extraTotal
      const nurseName = NURSE_NAMES[i % NURSE_NAMES.length]

      // Build clinical notes
      const clinicalNotes = buildClinicalNotes(admissionDaysAgo, doctor.fullName, nurseName)

      // Create admission
      const admission = await db.admission.create({
        data: {
          organizationId: ORG_ID,
          patientId: patient.id,
          bedId: bed.id,
          admissionDate,
          admissionType: i % 5 === 0 ? 'emergency' : i % 3 === 0 ? 'transfer' : 'elective',
          admissionReason: chiefComplaint,
          admissionDiagnosis,
          chiefComplaint,
          expectedLengthOfStay: 5 + Math.floor(Math.random() * 10),
          depositAmount: Math.floor(dailyRate * 2),
          admissionNotes: `Patient admitted via ${i % 5 === 0 ? 'Emergency' : 'OPD'} on ${admissionDate.toDateString()}. Stable on admission. IV access secured.`,
          isCritical: ward.type === 'icu',
          admittingDoctorId: doctor.id,
          attendingDoctorId: doctor.id,
          status: 'admitted',
          clinicalNotes: JSON.stringify(clinicalNotes),
          dailyRoomRate: dailyRate,
          totalBillAmount: totalBill,
          billGenerated: true,
          additionalCharges: JSON.stringify(additionalCharges.map((c, ci) => ({
            id: `charge-${Date.now()}-${ci}`,
            name: c.name,
            type: c.type,
            amount: c.amount,
            quantity: c.quantity,
            date: hoursAgo(Math.floor(Math.random() * 48)).toISOString(),
          }))),
        },
      })

      // Mark bed as occupied
      await db.bed.update({
        where: { id: bed.id },
        data: { status: 'occupied' },
      })

      admissions.push({
        admission,
        patient,
        doctor,
        nurseName,
        ward,
        bed,
        admissionDaysAgo,
        dailyRate,
        totalBill,
        chiefComplaint,
        admissionDiagnosis,
      })

      console.log(`   ✅ [${i + 1}/${admitCount}] ${patient.mrn} | ${patient.firstName} ${patient.lastName} → ${ward.name} / Bed ${bed.bedNumber}`)
    }

    console.log(`\n   🎉 Admitted ${admissions.length} patients successfully\n`)

    // ── 7. Transfer 20 patients between wards ──────────────────────────────
    console.log('🔄 Step 5: Transferring 20 patients between wards...\n')

    const toTransfer = admissions.slice(0, 20)
    let transferCount = 0

    // Re-fetch available beds after admissions (exclude occupied ones)
    const freshBeds = await db.bed.findMany({
      where: { organizationId: ORG_ID, status: 'available' },
      include: { ward: true },
    })

    let freshBedIdx = 0
    for (const adm of toTransfer) {
      if (freshBedIdx >= freshBeds.length) {
        console.log('   ⚠️  No more available beds for transfer, stopping transfers.')
        break
      }

      // Find a bed in a DIFFERENT ward
      let targetBedEntry = null
      for (let fi = freshBedIdx; fi < freshBeds.length; fi++) {
        if (freshBeds[fi].wardId !== adm.bed.wardId && !usedBedIds.has(freshBeds[fi].id)) {
          targetBedEntry = freshBeds[fi]
          freshBedIdx = fi + 1
          break
        }
      }

      if (!targetBedEntry) {
        // fallback: any available bed
        for (let fi = 0; fi < freshBeds.length; fi++) {
          if (!usedBedIds.has(freshBeds[fi].id)) {
            targetBedEntry = freshBeds[fi]
            freshBedIdx = fi + 1
            break
          }
        }
      }

      if (!targetBedEntry) {
        console.log(`   ⚠️  No available bed found for transfer of ${adm.patient.firstName} ${adm.patient.lastName}`)
        continue
      }

      usedBedIds.add(targetBedEntry.id)

      // Free old bed
      await db.bed.update({ where: { id: adm.bed.id }, data: { status: 'available' } })

      // Occupy new bed
      await db.bed.update({ where: { id: targetBedEntry.id }, data: { status: 'occupied' } })

      // Add transfer note to clinical notes
      const existingAdm = await db.admission.findUnique({
        where: { id: adm.admission.id },
        select: { clinicalNotes: true },
      })
      let existingNotes = []
      try { existingNotes = JSON.parse(existingAdm.clinicalNotes || '[]') } catch { existingNotes = [] }

      const transferNote = {
        id: `note-transfer-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date().toISOString(),
        noteType: 'Doctor',
        note: `WARD TRANSFER NOTE:\nPatient transferred from ${adm.ward.name} (Bed ${adm.bed.bedNumber}) to ${targetBedEntry.ward.name} (Bed ${targetBedEntry.bedNumber}) as per clinical requirements. Patient's condition reviewed — stable for transfer. IV line intact. Relevant documents handed over to receiving nurse. Nursing staff informed. Doctor ${adm.doctor.fullName} approved transfer.`,
        authorName: adm.doctor.fullName,
        vitals: null,
      }
      existingNotes.push(transferNote)

      // Update admission with new bed and transfer note
      await db.admission.update({
        where: { id: adm.admission.id },
        data: {
          bedId: targetBedEntry.id,
          clinicalNotes: JSON.stringify(existingNotes),
        },
      })

      console.log(`   🔄 [${transferCount + 1}/20] ${adm.patient.firstName} ${adm.patient.lastName} | ${adm.ward.name} → ${targetBedEntry.ward.name}`)
      transferCount++
      adm.bed = targetBedEntry  // update reference for discharge
      adm.ward = targetBedEntry.ward
    }

    console.log(`\n   ✅ Transferred ${transferCount} patients\n`)

    // ── 8. Discharge 15 patients ────────────────────────────────────────────
    console.log('🏠 Step 6: Discharging 15 patients with full discharge summaries...\n')

    const toDischarge = admissions.slice(0, 15)
    let dischargeCount = 0

    for (let i = 0; i < toDischarge.length; i++) {
      const adm = toDischarge[i]
      const dischargeDate = daysAgo(Math.floor(Math.random() * 2)) // discharged today or yesterday
      const dischargeDiagnosis = DISCHARGE_DIAGNOSES[i % DISCHARGE_DIAGNOSES.length]
      const conditions = ['stable', 'improved', 'good', 'satisfactory']
      const dischargeCondition = rand(conditions)

      // Add discharge clinical note (doctor)
      const existingAdm = await db.admission.findUnique({
        where: { id: adm.admission.id },
        select: { clinicalNotes: true },
      })
      let existingNotes = []
      try { existingNotes = JSON.parse(existingAdm.clinicalNotes || '[]') } catch { existingNotes = [] }

      const dischargeVitals = generateVitals()
      const dischargeDocNote = {
        id: `note-dc-doc-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date(dischargeDate).toISOString(),
        noteType: 'Doctor',
        note: `DISCHARGE NOTE — Day ${adm.admissionDaysAgo}:\nPatient ready for discharge. Condition: ${dischargeCondition}. Final vitals: BP ${dischargeVitals.bp} mmHg, HR ${dischargeVitals.pulse}/min, SpO2 ${dischargeVitals.spo2}%, Temp ${dischargeVitals.temp}°F. Final diagnosis: ${dischargeDiagnosis}. Patient and family counselled regarding discharge medications, follow-up schedule, warning signs, and when to return to hospital. Discharge summary given to patient.`,
        authorName: adm.doctor.fullName,
        vitals: {
          bloodPressure: dischargeVitals.bp,
          pulseRate: dischargeVitals.pulse,
          oxygenSaturation: dischargeVitals.spo2,
          temperature: dischargeVitals.temp,
        },
      }

      const dischargeNurseNote = {
        id: `note-dc-nur-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
        date: new Date(dischargeDate).toISOString(),
        noteType: 'Nursing',
        note: `DISCHARGE NURSING NOTE:\nDischarge orders received from Dr. ${adm.doctor.fullName}. Patient and family educated on:\n• Medication schedule and dosage\n• Wound/dressing care at home\n• Dietary restrictions\n• Activity limitations\n• Follow-up appointment details\nDischarged medications verified and handed over. Discharge summary printed. Valuables returned. IV cannula removed. Patient left ward in ${dischargeCondition} condition with family escort. Bed sanitised and prepared for next patient.`,
        authorName: adm.nurseName,
        vitals: null,
      }

      existingNotes.push(dischargeDocNote)
      existingNotes.push(dischargeNurseNote)

      // Update admission to discharged
      await db.admission.update({
        where: { id: adm.admission.id },
        data: {
          status: 'discharged',
          dischargeDate,
          dischargeDiagnosis,
          dischargeSummary: `Patient admitted on ${daysAgo(adm.admissionDaysAgo).toDateString()} with ${adm.chiefComplaint}. Diagnosed as ${adm.admissionDiagnosis}. ${TREATMENT_SUMMARIES[i % TREATMENT_SUMMARIES.length]}`,
          treatmentSummary: TREATMENT_SUMMARIES[i % TREATMENT_SUMMARIES.length],
          dischargeCondition,
          medicationsOnDischarge: MEDICATIONS_ON_DISCHARGE[i % MEDICATIONS_ON_DISCHARGE.length],
          dischargeNotes: `Discharge against signed discharge form. Patient counselled. No complications at discharge.`,
          followUpInstructions: FOLLOW_UP_INSTRUCTIONS[i % FOLLOW_UP_INSTRUCTIONS.length],
          dischargeDoctorId: adm.doctor.id,
          clinicalNotes: JSON.stringify(existingNotes),
        },
      })

      // Free the bed
      await db.bed.update({
        where: { id: adm.bed.id },
        data: { status: 'available' },
      })

      console.log(`   🏠 [${i + 1}/15] ${adm.patient.firstName} ${adm.patient.lastName} | ${adm.ward.name} → DISCHARGED (${dischargeCondition})`)
      dischargeCount++
    }

    console.log(`\n   ✅ Discharged ${dischargeCount} patients\n`)

    // ── 9. Generate invoices & payments for all admissions ──────────────────
    console.log('💰 Step 7: Generating IPD bills and recording payments...\n')

    let invoiceCount = 0
    let paymentCount = 0
    const invoiceNumbers = new Set()
    const receiptNumbers = new Set()

    function safeInvoiceNum() {
      let n
      do { n = uniqueInvoiceNum() } while (invoiceNumbers.has(n))
      invoiceNumbers.add(n)
      return n
    }

    function safeReceiptNum() {
      let n
      do { n = uniqueReceiptNum() } while (receiptNumbers.has(n))
      receiptNumbers.add(n)
      return n
    }

    for (let i = 0; i < admissions.length; i++) {
      const adm = admissions[i]
      const days = adm.admissionDaysAgo

      // Parse stored additional charges
      let additionalCharges = []
      try {
        const storedAdm = await db.admission.findUnique({
          where: { id: adm.admission.id },
          select: { additionalCharges: true, dailyRoomRate: true, totalBillAmount: true },
        })
        additionalCharges = JSON.parse(storedAdm.additionalCharges || '[]')
      } catch { additionalCharges = [] }

      const roomCharge = adm.dailyRate * days
      const extraTotal = additionalCharges.reduce((s, c) => s + (c.amount || 0) * (c.quantity || 1), 0)
      const subtotal = roomCharge + extraTotal
      const totalAmount = subtotal

      // Build invoice items
      const items = [
        {
          serviceName: `Room Charges — ${adm.ward.name} (${days} days × ₹${adm.dailyRate})`,
          quantity: days,
          unitPrice: adm.dailyRate,
          total: roomCharge,
          tax: 0,
        },
        ...additionalCharges.map(c => ({
          serviceName: c.name,
          quantity: c.quantity,
          unitPrice: c.amount,
          total: c.amount * c.quantity,
          tax: 0,
        })),
      ]

      // Determine payment status
      const isDischarge = i < 15  // first 15 are discharged → fully paid
      const partialPay = i < 35   // 35 patients have at least partial payment

      let amountPaid = 0
      let paymentStatus = 'unpaid'

      if (isDischarge) {
        amountPaid = totalAmount
        paymentStatus = 'paid'
      } else if (partialPay) {
        // pay deposit amount (about 30–60%)
        amountPaid = Math.floor(totalAmount * (0.3 + Math.random() * 0.3))
        paymentStatus = 'partially_paid'
      }

      const balanceDue = totalAmount - amountPaid

      const invoiceNumber = safeInvoiceNum()
      const invoice = await db.invoice.create({
        data: {
          organizationId: ORG_ID,
          invoiceNumber,
          patientId: adm.patient.id,
          items: JSON.stringify(items),
          subtotal,
          taxAmount: 0,
          discountAmount: 0,
          discountPercentage: 0,
          totalAmount,
          amountPaid,
          balanceDue,
          paymentStatus,
          status: paymentStatus === 'paid' ? 'paid' : 'sent',
          invoiceDate: daysAgo(adm.admissionDaysAgo),
          notes: `IPD Invoice — Admission ID: ${adm.admission.id}`,
        },
      })

      invoiceCount++

      // Record payment(s)
      if (amountPaid > 0) {
        const method = rand(PAYMENT_METHODS)

        if (isDischarge && totalAmount > 5000) {
          // Discharged patients: 2 payments (deposit + final)
          const depositAmt = Math.floor(totalAmount * 0.4)
          const finalAmt = totalAmount - depositAmt

          await db.payment.create({
            data: {
              organizationId: ORG_ID,
              invoiceId: invoice.id,
              patientId: adm.patient.id,
              amount: depositAmt,
              paymentMethod: 'cash',
              receiptNumber: safeReceiptNum(),
              paymentDate: daysAgo(adm.admissionDaysAgo),
              paymentReference: `DEPOSIT-${adm.patient.mrn}`,
              notes: 'Admission deposit collected at time of admission',
              isRefund: false,
            },
          })

          await db.payment.create({
            data: {
              organizationId: ORG_ID,
              invoiceId: invoice.id,
              patientId: adm.patient.id,
              amount: finalAmt,
              paymentMethod: method,
              receiptNumber: safeReceiptNum(),
              paymentDate: new Date(),
              paymentReference: `FINAL-${adm.patient.mrn}-${Date.now()}`,
              notes: 'Final settlement at discharge',
              isRefund: false,
            },
          })

          paymentCount += 2
        } else {
          // Single payment
          await db.payment.create({
            data: {
              organizationId: ORG_ID,
              invoiceId: invoice.id,
              patientId: adm.patient.id,
              amount: amountPaid,
              paymentMethod: method,
              receiptNumber: safeReceiptNum(),
              paymentDate: daysAgo(Math.floor(adm.admissionDaysAgo / 2)),
              paymentReference: `PAY-${adm.patient.mrn}-${Date.now()}`,
              notes: paymentStatus === 'partially_paid' ? 'Partial advance payment received' : 'Full payment received',
              isRefund: false,
            },
          })

          paymentCount++
        }
      }

      process.stdout.write(`   💳 [${i + 1}/${admissions.length}] INV: ${invoiceNumber} | ₹${totalAmount.toLocaleString()} | ${paymentStatus}\n`)
    }

    console.log(`\n   ✅ Generated ${invoiceCount} invoices, ${paymentCount} payment records\n`)

    // ── 10. Final Summary ────────────────────────────────────────────────────
    const stats = await db.$transaction(async tx => {
      const totalAdmissions = await tx.admission.count({ where: { organizationId: ORG_ID } })
      const currentlyAdmitted = await tx.admission.count({ where: { organizationId: ORG_ID, status: 'admitted' } })
      const discharged = await tx.admission.count({ where: { organizationId: ORG_ID, status: 'discharged' } })
      const occupiedBeds = await tx.bed.count({ where: { organizationId: ORG_ID, status: 'occupied' } })
      const availableBeds = await tx.bed.count({ where: { organizationId: ORG_ID, status: 'available' } })
      const totalInvoices = await tx.invoice.count({ where: { organizationId: ORG_ID } })
      const revenueResult = await tx.payment.aggregate({
        where: { organizationId: ORG_ID, isRefund: false },
        _sum: { amount: true },
      })
      return { totalAdmissions, currentlyAdmitted, discharged, occupiedBeds, availableBeds, totalInvoices, revenue: revenueResult._sum.amount || 0 }
    })

    console.log('\n' + '═'.repeat(70))
    console.log('📊  IPD SEED COMPLETE — FINAL SUMMARY')
    console.log('═'.repeat(70))
    console.log(`  🏥  Total Admissions (all time)   : ${stats.totalAdmissions}`)
    console.log(`  🛏️   Currently Admitted            : ${stats.currentlyAdmitted}`)
    console.log(`  🏠  Discharged                     : ${stats.discharged}`)
    console.log(`  🛏️   Occupied Beds                  : ${stats.occupiedBeds}`)
    console.log(`  ✅  Available Beds                  : ${stats.availableBeds}`)
    console.log(`  📄  Total IPD Invoices              : ${stats.totalInvoices}`)
    console.log(`  💰  Total Revenue Collected         : ₹${stats.revenue.toLocaleString()}`)
    console.log('═'.repeat(70))
    console.log('\n✅  All done! Open the HMS frontend to see the IPD module.\n')

    process.exit(0)
  } catch (err) {
    console.error('\n❌  Fatal error:', err.message)
    console.error(err)
    process.exit(1)
  }
}

seedIPD()
