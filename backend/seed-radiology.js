/**
 * seed-radiology.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 100 Radiology Orders and Reports for GudMed HMS
 *
 * RULES:
 *  • Uses ONLY existing patients
 *  • 50 patients get completed reports (orders + reports)
 *  • 20 patients get in_progress orders
 *  • 30 patients get pending orders
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

const STANDARD_EXAMS = [
  {
    examName: 'X-Ray Chest PA View',
    examCode: 'XR-CHEST',
    examCategory: 'x-ray',
    bodyPart: 'Chest',
    modality: 'DR',
    price: 450,
    estimatedDuration: 15,
    preparationInstructions: 'None',
    contrastRequired: false,
    findings: 'The lungs are clear bilaterally. No focal consolidation, pleural effusion, or pneumothorax. Heart size is within normal limits. Mediastinal contours are unremarkable. Bony thorax appears intact.',
    impression: 'Normal chest radiograph.'
  },
  {
    examName: 'CT Brain Plain',
    examCode: 'CT-BRAIN',
    examCategory: 'ct',
    bodyPart: 'Brain',
    modality: 'CT',
    price: 3500,
    estimatedDuration: 20,
    preparationInstructions: 'Remove any metallic objects from the head/neck area.',
    contrastRequired: false,
    findings: 'There is no evidence of acute intracranial hemorrhage or mass effect. Ventricular system is normal in size and configuration. Normal gray-white matter differentiation. Basal cisterns are patent. No skull vault fracture seen.',
    impression: 'Normal non-contrast CT of the brain.'
  },
  {
    examName: 'USG Whole Abdomen',
    examCode: 'USG-ABD',
    examCategory: 'ultrasound',
    bodyPart: 'Abdomen',
    modality: 'US',
    price: 1200,
    estimatedDuration: 30,
    preparationInstructions: 'Fasting for 6 hours prior to the scan. Full bladder required for pelvic evaluation.',
    contrastRequired: false,
    findings: 'Liver is normal in size and echotexture. Gallbladder is well-distended, no calculi seen. Pancreas and spleen are normal. Both kidneys are normal in size and shape with preserved corticomedullary differentiation. No free fluid in the abdomen or pelvis.',
    impression: 'Normal study of the whole abdomen.'
  },
  {
    examName: 'MRI Lumbar Spine',
    examCode: 'MRI-LSPINE',
    examCategory: 'mri',
    bodyPart: 'Spine',
    modality: 'MRI',
    price: 6500,
    estimatedDuration: 45,
    preparationInstructions: 'Remove all metallic objects. Pacemaker contraindicated.',
    contrastRequired: false,
    findings: 'Normal lumbar lordosis is maintained. Vertebral body heights are preserved. Intervertebral discs show normal hydration. No significant disc bulge or herniation. Spinal canal and neural foramina are capacious. Conus medullaris terminates at L1.',
    impression: 'Unremarkable MRI of the lumbar spine.'
  }
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d
}

function generateOrderNumber(idx) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = String(idx).padStart(4, '0')
  return `RAD${date}${random}`
}

async function seedRadiology() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — RADIOLOGY SEED')
  console.log('═'.repeat(70) + '\n')

  // 1. Ensure Radiology Exams exist
  console.log('🔍 Step 1: Checking/creating Radiology Exams...')
  let exams = await db.radiologyExam.findMany({ where: { organizationId: ORG_ID } })
  if (exams.length === 0) {
    console.log('   — No Exams found, creating standard exams...')
    for (const st of STANDARD_EXAMS) {
      await db.radiologyExam.create({
        data: {
          organizationId: ORG_ID,
          examName: st.examName,
          examCode: st.examCode,
          examCategory: st.examCategory,
          bodyPart: st.bodyPart,
          modality: st.modality,
          price: st.price,
          estimatedDuration: st.estimatedDuration,
          preparationInstructions: st.preparationInstructions,
          contrastRequired: st.contrastRequired,
          isActive: true
        }
      })
    }
    exams = await db.radiologyExam.findMany({ where: { organizationId: ORG_ID } })
  }
  console.log(`   ✅ Found ${exams.length} Radiology Exams`)

  // 2. Fetch Patients & Staff
  console.log('\n🔍 Step 2: Fetching existing patients & staff...')
  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    take: 100, // Fetch up to 100
  })
  if (patients.length === 0) {
    console.error('❌ No patients found. Run patient seed first.')
    process.exit(1)
  }
  console.log(`   ✅ Found ${patients.length} patients`)

  const staff = await db.user.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    select: { id: true, fullName: true, role: true },
    take: 50,
  })
  const doctor = staff.find(u => u.role === 'doctor') || staff[0]
  const radiologist = staff.find(u => u.role === 'doctor') || staff[0]
  const technician = staff.find(u => u.role === 'technician') || staff[0] || null
  if (!doctor) {
    console.error('❌ No staff found.')
    process.exit(1)
  }

  // 3. Create Orders
  console.log('\n📋 Step 3: Creating 100 Radiology Orders (50 Completed, 20 In Progress, 30 Pending)...\n')
  
  const totalOrders = 100
  let created = 0
  let counts = { completed: 0, in_progress: 0, pending: 0 }

  for (let i = 0; i < totalOrders; i++) {
    const patient = patients[i % patients.length]
    
    // Determine status (50 completed, 20 in_progress, 30 pending)
    let status = 'pending'
    if (i < 50) {
      status = 'completed'
    } else if (i < 70) {
      status = 'in_progress'
    } else {
      status = 'pending'
    }
    counts[status]++

    // Pick 1 random exam
    const exam = rand(exams)
    // Find standard definition for reporting if it exists
    const stDef = STANDARD_EXAMS.find(s => s.examCode === exam.examCode) || STANDARD_EXAMS[0]

    const urgency = Math.random() > 0.8 ? 'urgent' : 'routine'
    const orderDate = status === 'completed' ? hoursAgo(rInt(24, 96)) : hoursAgo(rInt(0, 10))
    
    let examPerformedAt = null
    let reportCreatedAt = null
    let reportVerifiedAt = null

    if (status === 'completed') {
      examPerformedAt = new Date(orderDate.getTime() + rInt(30, 120) * 60000)
      reportCreatedAt = new Date(examPerformedAt.getTime() + rInt(60, 240) * 60000)
      reportVerifiedAt = new Date(reportCreatedAt.getTime() + rInt(10, 60) * 60000)
    } else if (status === 'in_progress') {
      examPerformedAt = new Date(orderDate.getTime() + rInt(10, 60) * 60000)
    }

    try {
      // Create Order
      const order = await db.radiologyOrder.create({
        data: {
          organizationId: ORG_ID,
          patientId: patient.id,
          requestedById: doctor.id,
          examId: exam.id,
          orderNumber: generateOrderNumber(Date.now() % 10000 + i),
          orderDate,
          clinicalIndication: 'Routine Checkup / Diagnostic',
          urgency,
          status: status === 'completed' ? 'reported' : status, // the UI uses "reported" or "completed" interchangeably sometimes, actually schema has "completed" and "reported". Let's use "reported" for finalized. Wait, UI uses "reported" when a report exists.
          examPerformedAt,
          performedById: (status === 'completed' || status === 'in_progress') ? technician?.id : null,
          reportCreatedAt,
          reportedById: status === 'completed' ? radiologist.id : null,
          reportVerifiedAt,
          verifiedById: status === 'completed' ? radiologist.id : null,
        }
      })

      // Create Report if completed
      if (status === 'completed') {
        const isAbnormal = Math.random() > 0.8
        const hasCriticalFindings = isAbnormal && Math.random() > 0.5
        
        let findings = stDef.findings
        let impression = stDef.impression

        if (isAbnormal) {
          findings += ' INCIDENTAL NOTE: Mild abnormality detected requiring further clinical correlation.'
          impression = 'Mild abnormal findings. Suggest follow-up.'
        }
        if (hasCriticalFindings) {
          findings += ' CRITICAL: Suspicious finding requiring immediate attention.'
          impression = 'CRITICAL: High-grade suspicious lesion/abnormality.'
        }

        await db.radiologyReport.create({
          data: {
            organizationId: ORG_ID,
            orderId: order.id,
            technique: `Standard protocols for ${stDef.modality} were followed.`,
            findings,
            impression,
            hasCriticalFindings,
            criticalFindings: hasCriticalFindings ? 'Immediate attention required' : null,
            reportedById: radiologist.id,
            reportedAt: reportCreatedAt,
            verifiedById: radiologist.id,
            verifiedAt: reportVerifiedAt,
            status: 'final'
          }
        })
      }

      const statusIcon = status === 'completed' ? '🟢' : status === 'in_progress' ? '🟠' : '🔵'
      console.log(`   ${statusIcon} [${i + 1}/${totalOrders}] ${order.orderNumber} | ${patient.firstName} ${patient.lastName} | ${status}`)
      created++
    } catch (err) {
      console.error(`   ❌ Failed for ${patient.mrn}:`, err.message)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📊  RADIOLOGY SEED COMPLETE — SUMMARY')
  console.log('═'.repeat(70))
  console.log(`   ✅  Records Created : ${created}`)
  console.log(`   🟢  Completed       : ${counts.completed}`)
  console.log(`   🟠  In Progress     : ${counts.in_progress}`)
  console.log(`   🔵  Pending         : ${counts.pending}`)
  console.log('\n✅  Done!\n')
  process.exit(0)
}

seedRadiology().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
