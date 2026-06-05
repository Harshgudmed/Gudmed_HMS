/**
 * seed-triage.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 50 Triage (QueueManagement) records for GudMed HMS
 *
 * RULES:
 *  • Uses ONLY existing patients fetched by name / MRN / phone
 *  • Service Areas: Emergency, Pediatric, MCH, OPD
 *  • Priority: urgent, normal
 *  • Status: waiting, in_progress, completed
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

// ── Helpers ──────────────────────────────────────────────────────────────────
function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function generateQueueNumber(serviceArea) {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  const prefix = serviceArea.substring(0, 3).toUpperCase()
  return `${prefix}${date}${random}`
}

function hoursAgo(h) {
  const d = new Date()
  d.setHours(d.getHours() - h)
  return d
}

// ── Status & Priority configuration ─────────────────────────────────────────

const SERVICE_AREAS = ['Emergency', 'Pediatric', 'MCH', 'OPD']
const PRIORITIES = ['urgent', 'normal']
const STATUSES = ['waiting', 'in_progress', 'completed']

async function seedTriage() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — TRIAGE SEED (QueueManagement)')
  console.log('═'.repeat(70) + '\n')

  console.log('🔍 Step 1: Fetching existing patients...')
  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    take: 60,
  })

  if (patients.length === 0) {
    console.error('❌ No patients found. Run patient seed first.')
    process.exit(1)
  }
  console.log(`   ✅ Found ${patients.length} patients`)

  console.log('\n🧹 Step 2: Preparing queue numbers...')
  const usedNumbers = new Set()

  console.log('\n📋 Step 3: Creating 50 triage queue records...\n')
  const take = Math.min(50, patients.length)
  let created = 0

  for (let i = 0; i < take; i++) {
    const patient = patients[i % patients.length]
    const serviceArea = rand(SERVICE_AREAS)
    
    let qNum
    do {
      qNum = generateQueueNumber(serviceArea)
    } while (usedNumbers.has(qNum))
    usedNumbers.add(qNum)

    // Distribution
    let status = 'completed'
    if (i < 15) status = 'waiting'        // first 15 waiting
    else if (i < 25) status = 'in_progress' // next 10 in progress

    // Urgent vs Normal
    const priority = (Math.random() < 0.3) ? 'urgent' : 'normal' // 30% urgent

    // Timing (today mostly for waiting, earlier for completed)
    const joinedAt = (status === 'waiting') 
      ? hoursAgo(rInt(0, 4)) 
      : (status === 'in_progress') 
        ? hoursAgo(rInt(0, 2)) 
        : hoursAgo(rInt(5, 48))

    let calledAt = null
    let serviceStartedAt = null
    let serviceCompletedAt = null

    if (status === 'in_progress') {
      calledAt = new Date(joinedAt.getTime() + rInt(10, 30) * 60000)
      serviceStartedAt = calledAt
    } else if (status === 'completed') {
      calledAt = new Date(joinedAt.getTime() + rInt(10, 45) * 60000)
      serviceStartedAt = calledAt
      serviceCompletedAt = new Date(serviceStartedAt.getTime() + rInt(15, 60) * 60000)
    }

    try {
      await db.queueManagement.create({
        data: {
          organizationId: ORG_ID,
          patientId: patient.id,
          serviceArea,
          serviceType: 'Triage Assessment',
          queueNumber: qNum,
          priority,
          status,
          joinedQueueAt: joinedAt,
          calledAt,
          serviceStartedAt,
          serviceCompletedAt,
          estimatedWaitMinutes: status === 'waiting' ? rInt(5, 45) : null,
        }
      })

      const statusIcon = status === 'waiting' ? '🔵' : status === 'in_progress' ? '🟠' : '🟢'
      const prioMark = priority === 'urgent' ? '🚨' : '  '
      console.log(`   ${statusIcon} ${prioMark} [${i + 1}/${take}] ${qNum} | ${patient.firstName} ${patient.lastName} | ${serviceArea} | ${status}`)
      created++
    } catch (err) {
      console.error(`   ❌ Failed for ${patient.mrn}:`, err.message)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📊  TRIAGE SEED COMPLETE — SUMMARY')
  console.log('═'.repeat(70))
  console.log(`   ✅  Records Created : ${created}`)
  console.log('\n✅  Done!\n')
  process.exit(0)
}

seedTriage().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
