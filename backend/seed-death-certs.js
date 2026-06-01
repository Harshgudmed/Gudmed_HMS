import { PrismaClient } from '@prisma/client'

const localDb = new PrismaClient({
  datasources: { db: { url: 'postgresql://postgres:password@localhost:5432/hospital_db' } }
})

const prodDb = new PrismaClient()

async function main() {
  try {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('Seeding Death Certificates to Production')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

    // Get patients from production
    const prodPatients = await prodDb.patient.findMany({
      where: { organizationId: 'org-demo' },
      take: 8,
    })

    console.log(`✅ Found ${prodPatients.length} patients in production`)

    if (prodPatients.length === 0) {
      console.error('❌ No patients in production! Run migration first.')
      process.exit(1)
    }

    // Get death certificates from local
    const localDCs = await localDb.deathCertificate.findMany({
      where: { organizationId: 'org-demo' },
    })

    console.log(`✅ Found ${localDCs.length} death certificates in local database\n`)

    let created = 0
    let errors = 0

    for (let i = 0; i < localDCs.length && i < prodPatients.length; i++) {
      const localDC = localDCs[i]
      const patient = prodPatients[i]

      try {
        const dc = await prodDb.deathCertificate.create({
          data: {
            organizationId: 'org-demo',
            patientId: patient.id, // Use actual production patient ID
            certificateNumber: `DC-PROD-${String(i + 1).padStart(5, '0')}`,
            dateOfDeath: localDC.dateOfDeath || new Date(),
            timeOfDeath: localDC.timeOfDeath || null,
            placeOfDeath: localDC.placeOfDeath || 'inpatient',
            locationDetails: localDC.locationDetails || null,
            ageAtDeathYears: localDC.ageAtDeathYears,
            ageAtDeathMonths: localDC.ageAtDeathMonths,
            ageAtDeathDays: localDC.ageAtDeathDays,
            sex: patient.sex || 'Male', // Use patient's sex
            maritalStatus: localDC.maritalStatus || null,
            occupation: localDC.occupation || null,
            address: patient.address || null,
            immediateCause: localDC.immediateCause || 'Natural causes',
            antecedentCauseB: localDC.antecedentCauseB || null,
            antecedentCauseC: localDC.antecedentCauseC || null,
            antecedentCauseD: localDC.antecedentCauseD || null,
            otherConditions: localDC.otherConditions || null,
            mannerOfDeath: localDC.mannerOfDeath || 'natural',
            autopsyFindings: localDC.autopsyFindings || null,
            pregnancyRelated: localDC.pregnancyRelated || null,
            certifiedById: null, // Don't set certifiedById - no doctors imported yet
            certifierQualification: null,
            licenseNumber: null,
            signatureUrl: null,
            issuedTo: null,
            issuedToRelationship: null,
          },
        })

        console.log(`✅ Created DC-${i + 1}: Patient ${patient.firstName} ${patient.lastName}`)
        created++
      } catch (err) {
        console.error(`❌ Failed for patient ${patient.id}:`)
        console.error(`   ${err.message}`)
        if (err.meta) console.error(`   Meta:`, err.meta)
        errors++
      }
    }

    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
    console.log(`✅ Seeding Complete!`)
    console.log(`   Created: ${created}`)
    console.log(`   Errors: ${errors}`)
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)

    console.log('\n📝 Verify at: https://gudmed.vercel.app/death-certificates')
    console.log('   Login and check the death certificates list\n')

  } catch (err) {
    console.error('Fatal error:', err.message)
    process.exit(1)
  } finally {
    await localDb.$disconnect()
    await prodDb.$disconnect()
  }
}

main()
