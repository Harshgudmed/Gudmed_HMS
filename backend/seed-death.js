/**
 * seed-death.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Seeds 10 Death Certificates for GudMed HMS
 *
 * RULES:
 *  • Uses ONLY existing patients
 */

import { db } from './src/config/db.js'

const ORG_ID = 'org-demo'

function generateCertNumber(idx) {
  const year = new Date().getFullYear()
  const random = String(idx).padStart(4, '0')
  return `DC-${year}-${random}`
}

function rInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

async function seedDeathCertificates() {
  console.log('\n' + '═'.repeat(70))
  console.log('🏥  GudMed HMS — DEATH CERTIFICATE SEED')
  console.log('═'.repeat(70) + '\n')

  console.log('🔍 Fetching existing patients & staff...')
  const patients = await db.patient.findMany({
    where: { organizationId: ORG_ID, isActive: true },
    take: 10, // Just need 10
  })

  if (patients.length < 10) {
    console.error('❌ Not enough patients found. Need at least 10.')
    process.exit(1)
  }

  const staff = await db.user.findMany({
    where: { organizationId: ORG_ID, role: 'doctor', isActive: true },
    take: 1
  })
  const doctor = staff[0]
  if (!doctor) {
    console.error('❌ No doctor found for certification.')
    process.exit(1)
  }

  console.log('\n📋 Creating 10 Death Certificates...')
  
  let created = 0

  for (let i = 0; i < 10; i++) {
    const patient = patients[i]
    
    // Deceased Demographics
    const dob = new Date(patient.dateOfBirth)
    const deathDate = new Date()
    deathDate.setDate(deathDate.getDate() - rInt(1, 30))
    
    const diffTime = Math.abs(deathDate - dob)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    const ageYears = Math.floor(diffDays / 365)
    
    try {
      const cert = await db.deathCertificate.create({
        data: {
          organizationId: ORG_ID,
          patientId: patient.id,
          certificateNumber: generateCertNumber(Date.now() % 10000 + i),
          dateOfDeath: deathDate,
          timeOfDeath: `${String(rInt(0, 23)).padStart(2, '0')}:${String(rInt(0, 59)).padStart(2, '0')}`,
          placeOfDeath: 'inpatient',
          locationDetails: 'ICU Ward A',
          
          ageAtDeathYears: ageYears,
          ageAtDeathMonths: 0,
          ageAtDeathDays: 0,
          sex: patient.gender,
          maritalStatus: patient.maritalStatus || 'Married',
          occupation: patient.occupation || 'Retired',
          address: `${patient.houseNumber || ''} ${patient.kebele || ''} ${patient.woreda || ''}`,
          
          immediateCause: 'Cardiopulmonary Arrest',
          antecedentCauseB: 'Septic Shock',
          antecedentCauseC: 'Severe Pneumonia',
          mannerOfDeath: 'natural',
          
          certifiedById: doctor.id,
          certificationDate: deathDate,
          certifierQualification: 'MD, Internal Medicine',
          licenseNumber: 'ETH-MD-987654',
          
          issuedTo: patient.emergencyContactName || 'Family Member',
          issuedToRelationship: patient.emergencyContactRelationship || 'Spouse',
          issuedAt: new Date()
        }
      })
      
      console.log(`   ✅ [${i+1}/10] DC: ${cert.certificateNumber} | Patient: ${patient.firstName} ${patient.lastName} (Age: ${ageYears})`)
      created++
    } catch (err) {
      console.error(`   ❌ Failed for ${patient.mrn}:`, err.message)
    }
  }

  console.log('\n' + '═'.repeat(70))
  console.log('📊  DEATH CERTIFICATE SEED COMPLETE')
  console.log('═'.repeat(70))
  console.log(`   ✅  Records Created : ${created}`)
  console.log('\n✅  Done!\n')
  process.exit(0)
}

seedDeathCertificates().catch(err => {
  console.error('\n❌ Fatal error:', err.message)
  process.exit(1)
})
