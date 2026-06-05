/**
 * seed-lab.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 50 Lab Orders and Results for GudMed HMS
 *
 * RULES:
 *  • Uses ONLY existing patients
 *  • 30 patients get completed reports (orders + results)
 *  • 20 patients get pending orders
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

const STANDARD_TESTS = [
  {
    testName: 'Complete Blood Count (CBC)',
    testCode: 'CBC',
    testCategory: 'hematology',
    testType: 'quantitative',
    specimenType: 'Blood',
    unit: '',
    price: 350,
    resultsTemplate: [
      { name: 'Hemoglobin', unit: 'g/dL', min: 12.0, max: 16.0, valMin: 9.0, valMax: 18.0 },
      { name: 'Total WBC', unit: 'cumm', min: 4000, max: 11000, valMin: 3000, valMax: 15000 },
      { name: 'Platelet Count', unit: 'lacs/cumm', min: 1.5, max: 4.5, valMin: 0.5, valMax: 5.5 },
    ]
  },
  {
    testName: 'Lipid Profile',
    testCode: 'LIPID',
    testCategory: 'chemistry',
    testType: 'quantitative',
    specimenType: 'Blood',
    unit: 'mg/dL',
    price: 700,
    resultsTemplate: [
      { name: 'Total Cholesterol', unit: 'mg/dL', min: 125, max: 200, valMin: 100, valMax: 300 },
      { name: 'Triglycerides', unit: 'mg/dL', min: 40, max: 150, valMin: 30, valMax: 250 },
      { name: 'HDL Cholesterol', unit: 'mg/dL', min: 40, max: 60, valMin: 20, valMax: 80 },
    ]
  },
  {
    testName: 'Liver Function Test (LFT)',
    testCode: 'LFT',
    testCategory: 'chemistry',
    testType: 'quantitative',
    specimenType: 'Blood',
    unit: '',
    price: 800,
    resultsTemplate: [
      { name: 'Total Bilirubin', unit: 'mg/dL', min: 0.1, max: 1.2, valMin: 0.1, valMax: 3.5 },
      { name: 'SGOT (AST)', unit: 'U/L', min: 5, max: 40, valMin: 10, valMax: 150 },
      { name: 'SGPT (ALT)', unit: 'U/L', min: 7, max: 56, valMin: 10, valMax: 200 },
    ]
  },
  {
    testName: 'Kidney Function Test (KFT)',
    testCode: 'KFT',
    testCategory: 'chemistry',
    testType: 'quantitative',
    specimenType: 'Blood',
    unit: 'mg/dL',
    price: 650,
    resultsTemplate: [
      { name: 'Blood Urea Nitrogen', unit: 'mg/dL', min: 7, max: 20, valMin: 5, valMax: 45 },
      { name: 'Serum Creatinine', unit: 'mg/dL', min: 0.6, max: 1.2, valMin: 0.4, valMax: 3.0 },
      { name: 'Uric Acid', unit: 'mg/dL', min: 3.5, max: 7.2, valMin: 2.0, valMax: 10.0 },
    ]
  }
]

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function rFloat(min, max, dp = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)) }

function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d
}

function generateOrderNumber(idx) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = String(idx).padStart(4, '0')
  return `LAB${date}${random}`
}

function generateAccessionNumber(idx) {
  const year = new Date().getFullYear()
  const random = String(idx).padStart(4, '0')
  return `ACC-${year}-${random}`
}

async function seedLab() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — LABORATORY SEED')
  console.log('═'.repeat(70) + '\n')

  // 1. Ensure Lab Tests exist
  console.log('🔍 Step 1: Checking/creating Lab Tests...')
  let labTests = await db.labTest.findMany({ where: { organizationId: ORG_ID } })
  if (labTests.length === 0) {
    console.log('   — No Lab Tests found, creating standard tests...')
    for (const st of STANDARD_TESTS) {
      await db.labTest.create({
        data: {
          organizationId: ORG_ID,
          testName: st.testName,
          testCode: st.testCode,
          testCategory: st.testCategory,
          testType: st.testType,
          specimenType: st.specimenType,
          unit: st.unit,
          price: st.price,
          turnaroundTime: 2,
          department: 'Core Lab',
          isActive: true
        }
      })
    }
    labTests = await db.labTest.findMany({ where: { organizationId: ORG_ID } })
  }
  console.log(`   ✅ Found ${labTests.length} Lab Tests`)

  // 2. Fetch Patients & Staff
  console.log('\n🔍 Step 2: Fetching existing patients & staff...')
  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    take: 60,
  })
  if (patients.length === 0) {
    console.error('❌ No patients found. Run patient seed first.')
    process.exit(1)
  }
  console.log(`   ✅ Found ${patients.length} patients`)

  const staff = await db.user.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    select: { id: true, fullName: true, role: true },
    take: 20,
  })
  const doctor = staff.find(u => u.role === 'doctor') || staff[0]
  const technician = staff.find(u => u.role === 'technician') || staff[0] || null
  if (!doctor) {
    console.error('❌ No staff found.')
    process.exit(1)
  }

  // 3. Create Orders
  console.log('\n📋 Step 3: Creating 50 Lab Orders (30 Completed, 20 Pending)...\n')
  
  const totalOrders = 50
  let created = 0
  let completedCount = 0
  let pendingCount = 0

  for (let i = 0; i < totalOrders; i++) {
    const patient = patients[i % patients.length]
    
    // Determine status (30 completed, 20 pending)
    let status = 'pending'
    if (i < 30) {
      status = 'completed'
      completedCount++
    } else {
      pendingCount++
    }

    // Pick 1-2 random tests
    const numTests = rInt(1, 2)
    const selectedTests = []
    const availableTests = [...labTests]
    for (let j = 0; j < numTests; j++) {
      const idx = rInt(0, availableTests.length - 1)
      selectedTests.push(availableTests.splice(idx, 1)[0])
    }

    const priority = Math.random() > 0.8 ? 'urgent' : 'routine'
    const orderDate = status === 'completed' ? hoursAgo(rInt(12, 72)) : hoursAgo(rInt(0, 4))
    
    let sampleCollectedAt = null
    let accessionNumber = null
    let resultsEnteredAt = null
    let resultsVerifiedAt = null

    if (status === 'completed') {
      sampleCollectedAt = new Date(orderDate.getTime() + rInt(10, 30) * 60000)
      accessionNumber = generateAccessionNumber(Date.now() % 10000 + i)
      resultsEnteredAt = new Date(sampleCollectedAt.getTime() + rInt(60, 180) * 60000)
      resultsVerifiedAt = new Date(resultsEnteredAt.getTime() + rInt(5, 30) * 60000)
    }

    // JSON format needed for order tests column
    const testsJson = JSON.stringify(selectedTests.map(t => ({
      testId: t.id,
      testName: t.testName,
      testCode: t.testCode,
      urgency: priority
    })))

    try {
      // Create Order
      const order = await db.labOrder.create({
        data: {
          organizationId: ORG_ID,
          patientId: patient.id,
          requestedById: doctor.id,
          orderNumber: generateOrderNumber(Date.now() % 10000 + i),
          orderDate,
          tests: testsJson,
          clinicalIndication: 'Routine Checkup',
          priority,
          status,
          sampleCollectedAt,
          sampleCollectedById: status === 'completed' ? technician?.id : null,
          accessionNumber,
          resultsEnteredAt,
          resultsEnteredById: status === 'completed' ? technician?.id : null,
          resultsVerifiedAt,
          resultsVerifiedById: status === 'completed' ? doctor.id : null,
        }
      })

      // Create Results if completed
      if (status === 'completed') {
        for (const t of selectedTests) {
          // Find standard template for ranges
          const stDef = STANDARD_TESTS.find(s => s.testCode === t.testCode)
          
          if (stDef) {
            // For complex tests with multiple parameters, create one LabResult per parameter
            // Wait, LabResult schema has one result per LabOrder+LabTest pair.
            // If the test has multiple sub-results, typically it's saved as text or JSON, 
            // but GudMed schema only supports one `resultValue` per `testId`.
            // Let's just pick the first parameter from the template to represent the main result.
            const param = stDef.resultsTemplate[0]
            const val = rFloat(param.valMin, param.valMax)
            
            const isAbnormal = val < param.min || val > param.max
            const isCritical = val < param.min * 0.7 || val > param.max * 1.3
            let flag = 'N'
            if (isAbnormal) flag = val > param.max ? 'H' : 'L'
            if (isCritical) flag = 'A'

            await db.labResult.create({
              data: {
                organizationId: ORG_ID,
                orderId: order.id,
                testId: t.id,
                resultValue: String(val),
                resultUnit: param.unit,
                isAbnormal,
                isCritical,
                flag,
                referenceRangeMin: param.min,
                referenceRangeMax: param.max,
                enteredById: technician?.id,
                enteredAt: resultsEnteredAt,
                verifiedById: doctor.id,
                verifiedAt: resultsVerifiedAt,
              }
            })
          } else {
            // Fallback for custom tests
            await db.labResult.create({
              data: {
                organizationId: ORG_ID,
                orderId: order.id,
                testId: t.id,
                resultValue: 'Normal',
                enteredById: technician?.id,
                enteredAt: resultsEnteredAt,
                verifiedById: doctor.id,
                verifiedAt: resultsVerifiedAt,
              }
            })
          }
        }
      }

      const statusIcon = status === 'completed' ? '🟢' : '🔵'
      console.log(`   ${statusIcon} [${i + 1}/${totalOrders}] ${order.orderNumber} | ${patient.firstName} ${patient.lastName} | ${status}`)
      created++
    } catch (err) {
      console.error(`   ❌ Failed for ${patient.mrn}:`, err.message)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📊  LABORATORY SEED COMPLETE — SUMMARY')
  console.log('═'.repeat(70))
  console.log(`   ✅  Records Created : ${created}`)
  console.log(`   🟢  Completed       : ${completedCount}`)
  console.log(`   🔵  Pending         : ${pendingCount}`)
  console.log('\n✅  Done!\n')
  process.exit(0)
}

seedLab().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
