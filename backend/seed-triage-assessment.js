/**
 * seed-triage-assessment.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds Triage Assessment records for Multi-type triage:
 * Emergency, Pediatric (ETAT), MCH, Psychiatric
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

function rand(arr) { return arr[Math.floor(Math.random() * arr.length)] }
function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }
function rFloat(min, max, dp = 1) { return parseFloat((Math.random() * (max - min) + min).toFixed(dp)) }

const CHIEF_COMPLAINTS = {
  emergency: ['Chest pain', 'Severe abdominal pain', 'Head injury', 'Breathlessness'],
  pediatric: ['High fever', 'Vomiting and diarrhea', 'Convulsions', 'Difficulty breathing'],
  mch: ['Labour pains', 'Bleeding per vaginum', 'Decreased fetal movement', 'Severe headache'],
  psychiatric: ['Agitation and aggression', 'Suicidal ideation', 'Severe depression', 'Visual hallucinations']
}

async function seedTriageAssessment() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — MULTI-TYPE TRIAGE ASSESSMENT SEED')
  console.log('═'.repeat(70) + '\n')

  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    take: 40,
  })

  if (patients.length === 0) {
    console.error('❌ No patients found. Run patient seed first.')
    process.exit(1)
  }

  const doctors = await db.user.findMany({ where: { organizationId: ORG_ID, role: 'doctor' } })
  const doctorIds = doctors.map(d => d.id)

  const types = ['emergency', 'pediatric', 'mch', 'psychiatric']
  let created = 0

  for (let i = 0; i < patients.length; i++) {
    const patient = patients[i]
    const type = types[i % types.length]
    const docId = doctorIds.length > 0 ? rand(doctorIds) : null

    const data = {
      organizationId: ORG_ID,
      patientId: patient.id,
      triageType: type,
      chiefComplaint: rand(CHIEF_COMPLAINTS[type]),
      temperature: rFloat(36.5, 39.5, 1),
      bloodPressureSystolic: rInt(90, 160),
      bloodPressureDiastolic: rInt(60, 100),
      pulseRate: rInt(60, 120),
      respiratoryRate: rInt(12, 28),
      oxygenSaturation: rInt(88, 100),
      weight: rFloat(50, 90, 1),
      height: rFloat(150, 180, 1),
      triagedById: docId,
      triageCategory: rand(['Category 1 - Resuscitation', 'Category 2 - Emergency', 'Category 3 - Urgent', 'Category 4 - Semi-urgent', 'Category 5 - Non-urgent'])
    }

    if (type === 'emergency') {
      data.urgencyLevel = rand(['red', 'yellow', 'green', 'black'])
    } else if (type === 'pediatric') {
      data.etatPriority = rand(['emergency', 'priority', 'queue'])
      data.etatCategory = rand(['respiratory', 'diarrhea', 'fever', 'malnutrition'])
      data.ageMonths = rInt(1, 120)
      data.weight = rFloat(3, 30, 1) // Pediatric weight
      data.height = rFloat(50, 120, 1)
      data.lethargicUnconscious = Math.random() > 0.8
    } else if (type === 'mch') {
      data.pregnancyWeeks = rInt(4, 40)
      data.gravida = rInt(1, 4)
      data.para = rInt(0, 3)
    } else if (type === 'psychiatric') {
      data.mentalStatus = rand(['Alert and oriented', 'Confused', 'Agitated', 'Lethargic'])
      data.suicidalIdeation = Math.random() > 0.8
      data.violentBehavior = Math.random() > 0.8
      data.substanceUse = Math.random() > 0.7
    }

    try {
      await db.triageAssessment.create({ data })
      console.log(`✅ Created ${type} triage for ${patient.firstName} ${patient.lastName}`)
      created++
    } catch (e) {
      console.error(`❌ Failed to create triage for ${patient.firstName}:`, e.message)
    }
  }

  console.log(`\n🎉 Successfully created ${created} Triage Assessments!`)
}

seedTriageAssessment().catch(console.error).finally(() => db.$disconnect())
