import { db } from './src/config/db.js'

const wardTemplates = [
  {
    name: 'Private Ward',
    type: 'private',
    capacity: 10,
    floor: '1st Floor',
    chargeNurse: 'Sister Priya',
    phone: '9876543210',
    beds: 10,
  },
  {
    name: 'Pediatric Ward',
    type: 'pediatric',
    capacity: 10,
    floor: '2nd Floor',
    chargeNurse: 'Sister Anjali',
    phone: '9876543211',
    beds: 10,
  },
  {
    name: 'Maternity Ward',
    type: 'maternity',
    capacity: 16,
    floor: '2nd Floor',
    chargeNurse: 'Sister Deepa',
    phone: '9876543212',
    beds: 16,
  },
  {
    name: 'ICU',
    type: 'icu',
    capacity: 5,
    floor: '3rd Floor',
    chargeNurse: 'Sister Neha',
    phone: '9876543213',
    beds: 5,
  },
  {
    name: 'General Ward',
    type: 'general',
    capacity: 20,
    floor: '1st Floor',
    chargeNurse: 'Sister Kavya',
    phone: '9876543214',
    beds: 20,
  },
  {
    name: 'General Ward 1',
    type: 'general',
    capacity: 30,
    floor: '2nd Floor',
    chargeNurse: 'Sister Meera',
    phone: '9876543215',
    beds: 30,
  },
  {
    name: 'General Ward 2',
    type: 'general',
    capacity: 30,
    floor: '3rd Floor',
    chargeNurse: 'Sister Riya',
    phone: '9876543216',
    beds: 30,
  },
  {
    name: 'NICU',
    type: 'nicu',
    capacity: 8,
    floor: '3rd Floor',
    chargeNurse: 'Sister Pooja',
    phone: '9876543217',
    beds: 8,
  },
  {
    name: 'Semi-Private Ward',
    type: 'private',
    capacity: 20,
    floor: '1st Floor',
    chargeNurse: 'Sister Isha',
    phone: '9876543218',
    beds: 20,
  },
]

async function seedWardsAndBeds() {
  try {
    console.log('🏥 SEEDING WARDS AND BEDS\n')

    const orgId = 'org-demo'
    let wardCount = 0
    let bedCount = 0

    // Delete existing wards and beds
    console.log('🧹 Cleaning up existing wards and beds...')
    await db.bed.deleteMany({ where: { organizationId: orgId } })
    await db.ward.deleteMany({ where: { organizationId: orgId } })
    console.log('✅ Cleaned up existing data\n')

    // Create wards and beds
    for (const wardTemplate of wardTemplates) {
      try {
        // Create ward
        const ward = await db.ward.create({
          data: {
            organizationId: orgId,
            name: wardTemplate.name,
            code: wardTemplate.name.toUpperCase().replace(/\s+/g, '-'),
            type: wardTemplate.type,
            capacity: wardTemplate.capacity,
            floor: wardTemplate.floor,
            chargeNurse: wardTemplate.chargeNurse,
            phone: wardTemplate.phone,
            isActive: true,
          },
        })

        wardCount++
        console.log(`✅ Ward created: ${ward.name} (${ward.capacity} beds)`)

        // Create beds for the ward
        for (let i = 1; i <= wardTemplate.beds; i++) {
          await db.bed.create({
            data: {
              organizationId: orgId,
              wardId: ward.id,
              bedNumber: `${wardTemplate.name.substring(0, 3).toUpperCase()}-${String(i).padStart(3, '0')}`,
              type: wardTemplate.type === 'private' ? 'standard' : wardTemplate.type === 'icu' ? 'icu' : 'standard',
              status: Math.random() > 0.9 ? 'occupied' : 'available',
              currentPatientId: null,
            },
          })
          bedCount++
        }
      } catch (err) {
        console.log(`⚠️  Error creating ward "${wardTemplate.name}": ${err.message.substring(0, 100)}`)
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('🏥 WARDS & BEDS SEEDING COMPLETE')
    console.log('='.repeat(70))
    console.log(`✅ Wards Created: ${wardCount}`)
    console.log(`✅ Beds Created: ${bedCount}`)
    console.log(`✅ Total Capacity: ${wardTemplates.reduce((sum, w) => sum + w.capacity, 0)} beds`)

    const summary = wardTemplates.map(w => `${w.name}: ${w.capacity} beds`)
    console.log(`\n📊 Ward Summary:`)
    summary.forEach(s => console.log(`   - ${s}`))

    console.log(`\n🎉 Hospital ward structure created successfully!`)
    process.exit(0)
  } catch (err) {
    console.error('❌ Critical error:', err.message)
    process.exit(1)
  }
}

seedWardsAndBeds()
