/**
 * seed-pretriage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 50 Pre-Triage Screening records for GudMed HMS
 *
 * RULES:
 *  • Uses ONLY existing patients fetched by name / MRN / phone
 *  • Fills ALL schema fields: vitals, BMI, FBS/PPBS, routing, status
 *  • Status distribution: 20 screening (pending), 20 routed, 10 registered_as_patient
 *  • Uses existing doctors as screenedBy / routedBy users
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

// ── Helpers ──────────────────────────────────────────────────────────────────

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function rFloat(min, max, dp = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)) }
function daysAgo(n) { const d = new Date(); d.setDate(d.getDate() - n); return d }
function hoursAgo(h) { const d = new Date(); d.setHours(d.getHours() - h); return d }

function calcBMI(weight, height) {
  if (!weight || !height || height === 0) return null
  return parseFloat((weight / Math.pow(height / 100, 2)).toFixed(1))
}

function generateScreeningNumber(idx) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const num = String(idx + 1).padStart(3, '0')
  return `SCR${date}${num}`
}

function calcAge(dob) {
  if (!dob) return rInt(20, 70)
  return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000))
}

// ── Clinical content ──────────────────────────────────────────────────────────

const CHIEF_COMPLAINTS = [
  'Severe headache and dizziness since morning',
  'Chest pain with shortness of breath',
  'High fever with chills and body ache',
  'Abdominal pain – right side, worsening',
  'Vomiting and loose motions since yesterday',
  'Breathlessness on climbing stairs',
  'Swelling in both legs for 3 days',
  'Burning sensation while urination',
  'Severe back pain radiating to legs',
  'Uncontrolled sugar – feeling weak and confused',
  'Head injury – road accident 2 hours ago',
  'Snake bite on right foot',
  'Convulsions – 2 episodes in past hour',
  'Eye pain and redness with blurred vision',
  'Toothache and facial swelling',
  'Ear discharge with hearing loss',
  'Skin rash spreading all over body',
  'Throat pain and difficulty swallowing',
  'Palpitations and irregular heartbeat',
  'Numbness in left arm since morning',
  'Joint pain and swelling – both knees',
  'Chronic cough with blood-tinged sputum',
  'Fainting episode at home',
  'Excessive thirst and frequent urination',
  'Wound not healing for 2 weeks',
]

const BRIEF_HISTORIES = [
  'Patient complains since yesterday. No prior hospital admission. Medications: Metformin 500mg BD. Allergies: None known.',
  'Acute onset today morning. H/o hypertension on Amlodipine 5mg. No known drug allergy. Last meal 4 hours ago.',
  'Gradual onset over 3 days. Known diabetic – HbA1c 9.2 last month. On Glimepiride and Metformin.',
  'Sudden onset. No significant past medical history. No current medications. Smoker – 10 cigarettes/day.',
  'Post-RTA brought by ambulance. GCS 14/15. H/o no chronic illness. Tetanus status unknown.',
  'Recurrent complaint. Previously treated at private clinic. On Losartan 50mg and Furosemide 40mg.',
  'Patient walked in with family. Chronic kidney disease – on dialysis twice weekly. Last session 2 days ago.',
  'Known asthmatic on inhaler – Salbutamol PRN. Episode triggered by cold weather. Partial relief with nebulisation.',
  'First episode. No family history of cardiac disease. Non-smoker, non-alcoholic. BMI elevated.',
  'Patient transferred from peripheral health centre. Referral letter available. IV line in situ.',
]

const ROUTED_TO_OPTIONS = ['adult_triage', 'mch_triage', 'psychiatric_triage']

// Status distribution: 20 screening, 20 routed, 10 registered_as_patient
function getStatus(i) {
  if (i < 20) return 'screening'
  if (i < 40) return 'routed'
  return 'registered_as_patient'
}

// ── Main Seed ─────────────────────────────────────────────────────────────────

async function seedPreTriage() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — PRE-TRIAGE SEED (Existing Patients Only)')
  console.log('═'.repeat(70) + '\n')

  // ── 1. Fetch existing patients ─────────────────────────────────────────────
  console.log('🔍 Step 1: Fetching existing patients (by name / MRN / phone)...')
  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 60,
    select: {
      id: true,
      mrn: true,
      firstName: true,
      lastName: true,
      gender: true,
      dateOfBirth: true,
      phonePrimary: true,
    },
  })

  if (patients.length === 0) {
    console.error('❌ No patients found. Run patient seed first.')
    process.exit(1)
  }
  console.log(`   ✅ Found ${patients.length} patients`)
  patients.slice(0, 5).forEach(p =>
    console.log(`      • ${p.mrn} | ${p.firstName} ${p.lastName} | ${p.phonePrimary || 'no phone'}`)
  )

  // ── 2. Fetch existing users (doctors/nurses for screenedBy) ─────────────────
  console.log('\n🔍 Step 2: Fetching existing staff (screenedBy / routedBy)...')
  const staff = await db.user.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    select: { id: true, fullName: true, role: true },
    take: 20,
  })

  const doctors = staff.filter(u => u.role === 'doctor')
  const nurses  = staff.filter(u => u.role === 'nurse')
  const allStaff = staff.length > 0 ? staff : null

  if (!allStaff) {
    console.warn('   ⚠️  No staff found — screenedById will be null')
  } else {
    console.log(`   ✅ Found ${staff.length} staff (${doctors.length} doctors, ${nurses.length} nurses)`)
  }

  // ── 3. Clean up duplicate screening numbers if any ─────────────────────────
  console.log('\n🧹 Step 3: Preparing unique screening numbers...')
  const usedNumbers = new Set()

  // ── 4. Seed 50 pre-triage records ─────────────────────────────────────────
  console.log('\n📋 Step 4: Creating 50 pre-triage screening records...\n')

  const take = Math.min(50, patients.length)
  let created = 0

  for (let i = 0; i < take; i++) {
    const patient  = patients[i % patients.length]
    const age      = calcAge(patient.dateOfBirth)
    const status   = getStatus(i)
    const routedTo = status !== 'screening' ? rand(ROUTED_TO_OPTIONS) : null
    const screenedByUser = allStaff ? rand(allStaff) : null
    const routedByUser   = (status === 'routed' || status === 'registered_as_patient') && allStaff
      ? rand(doctors.length > 0 ? doctors : allStaff) : null

    // Vitals — realistic ranges
    const weight = rFloat(45, 105, 1)
    const height = rFloat(148, 185, 1)
    const bmi    = calcBMI(weight, height)
    const temp   = rFloat(36.0, 39.5, 1)
    const spo2   = rFloat(88, 100, 1)
    const pulse  = rInt(52, 118)
    const rr     = rInt(12, 26)
    const bpSys  = rInt(100, 175)
    const bpDia  = rInt(60, 105)

    // Blood sugar (for ~40% of patients)
    const hasSugar = Math.random() < 0.4
    const fbs  = hasSugar ? rFloat(70, 260, 0) : null
    const ppbs = hasSugar ? rFloat(100, 320, 0) : null

    // Timing — screenings spread over last 7 days
    const screenedAt = hoursAgo(rInt(1, 168))  // 1 hr to 7 days ago
    const routedAt   = (status !== 'screening') ? new Date(screenedAt.getTime() + rInt(5, 30) * 60000) : null

    // Unique screening number
    let scrNum
    do {
      const suffix = String(i + 1).padStart(3, '0')
      const dateStr = screenedAt.toISOString().slice(0, 10).replace(/-/g, '')
      scrNum = `SCR${dateStr}${suffix}`
      if (usedNumbers.has(scrNum)) scrNum = `SCR${dateStr}${Date.now().toString().slice(-4)}`
    } while (usedNumbers.has(scrNum))
    usedNumbers.add(scrNum)

    const chiefComplaint = CHIEF_COMPLAINTS[i % CHIEF_COMPLAINTS.length]
    const briefHistory   = BRIEF_HISTORIES[Math.floor(i / 5) % BRIEF_HISTORIES.length]

    // patientId only for 'registered_as_patient' (linked to existing patient)
    const patientId = status === 'registered_as_patient' ? patient.id : patient.id // link all for existing patient

    try {
      await db.preTriage.create({
        data: {
          organizationId: ORG_ID,
          screeningNumber: scrNum,
          // Demographics from existing patient
          firstName:  patient.firstName,
          lastName:   patient.lastName,
          age,
          gender:     patient.gender || 'male',
          phone:      patient.phonePrimary || null,
          // Clinical
          chiefComplaint,
          briefHistory,
          // Vitals
          temperature:            temp,
          bloodPressureSystolic:  bpSys,
          bloodPressureDiastolic: bpDia,
          pulseRate:              pulse,
          respiratoryRate:        rr,
          spo2,
          weight,
          height,
          bmi,
          fbs:  fbs  ? parseFloat(fbs)  : null,
          ppbs: ppbs ? parseFloat(ppbs) : null,
          // Routing
          routedTo,
          status,
          // Relations
          patientId:   patient.id,
          screenedAt,
          screenedById: screenedByUser?.id || null,
          routedAt,
          routedById:   routedByUser?.id   || null,
        },
      })

      const statusIcon = status === 'screening' ? '🔵' : status === 'routed' ? '🟠' : '🟢'
      console.log(
        `   ${statusIcon} [${i + 1}/${take}] ${scrNum} | ${patient.firstName} ${patient.lastName} | ${patient.mrn} | ${status}${routedTo ? ' → ' + routedTo.replace(/_/g, ' ') : ''}`
      )
      created++
    } catch (err) {
      console.error(`   ❌ Failed for ${patient.mrn}:`, err.message)
    }
  }

  // ── 5. Summary ─────────────────────────────────────────────────────────────
  const counts = await db.preTriage.groupBy({
    by: ['status'],
    where: { organizationId: ORG_ID },
    _count: { _all: true },
  })

  console.log('\n' + '═'.repeat(70))
  console.log('📊  PRE-TRIAGE SEED COMPLETE — FINAL SUMMARY')
  console.log('═'.repeat(70))
  console.log(`   ✅  Records Created This Run : ${created}`)
  counts.forEach(c => {
    const label = c.status === 'screening' ? '🔵 Pending (screening)'
      : c.status === 'routed' ? '🟠 Routed'
      : '🟢 Registered as Patient'
    console.log(`   ${label.padEnd(32)}: ${c._count._all}`)
  })
  console.log('═'.repeat(70))
  console.log('\n✅  Done! Open Pre-Triage page to see all records with filters.\n')

  process.exit(0)
}

seedPreTriage().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  console.error(err)
  process.exit(1)
})
