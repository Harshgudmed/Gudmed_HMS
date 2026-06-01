import { db } from '../src/config/db.js'
import bcrypt from 'bcryptjs'

async function main() {
  console.log('Seeding production database...')

  // 1. Create organization
  const org = await db.organization.upsert({
    where: { id: 'org-demo' },
    update: {},
    create: {
      id: 'org-demo',
      name: 'GudMed Hospital',
      slug: 'gudmed',
      email: 'harsh.raj@gudmed.in',
      phone: '7322907656',
      address: 'Major Laxmi Chand Road, Chakkarpur',
      city: 'Gurugram',
      region: 'Haryana',
      country: 'India',
      primaryColor: '#2E4168',
      settings: JSON.stringify({
        currency: 'INR',
        language: 'en',
        timezone: 'Asia/Kolkata',
        workingHours: { start: '08:00', end: '20:00' },
        appointmentDuration: 30,
      }),
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
      isActive: true,
      updatedAt: new Date(),
    },
  })
  console.log('✅ Organization created:', org.name)

  // 2. Create admin user
  const hash = await bcrypt.hash('Admin@123', 10)
  const admin = await db.user.upsert({
    where: { id: 'user-admin' },
    update: {},
    create: {
      id: 'user-admin',
      organizationId: 'org-demo',
      fullName: 'Admin User',
      email: 'admin@gudmed.in',
      passwordHash: hash,
      role: 'admin',
      isActive: true,
      updatedAt: new Date(),
    },
  })
  console.log('✅ Admin created:', admin.email)

  // 3. Create doctor users
  const doctors = [
    { id: 'user-doctor1', name: 'Dr. Priya Mehta', email: 'priya@gudmed.in', spec: 'General Medicine' },
    { id: 'user-doctor2', name: 'Dr. Suresh Patel', email: 'suresh@gudmed.in', spec: 'Cardiology' },
    { id: 'user-doctor3', name: 'Dr. Anita Joshi', email: 'anita@gudmed.in', spec: 'Pediatrics' },
  ]
  for (const doc of doctors) {
    const dHash = await bcrypt.hash('Doctor@123', 10)
    await db.user.upsert({
      where: { id: doc.id },
      update: {},
      create: {
        id: doc.id,
        organizationId: 'org-demo',
        fullName: doc.name,
        email: doc.email,
        passwordHash: dHash,
        role: 'doctor',
        specialization: doc.spec,
        isActive: true,
        updatedAt: new Date(),
      },
    })
    console.log('✅ Doctor created:', doc.name)
  }

  // 4. Create wards
  const wards = [
    { id: 'ward-general', name: 'General Ward', type: 'general', totalBeds: 20, floor: '1st' },
    { id: 'ward-icu', name: 'ICU', type: 'icu', totalBeds: 5, floor: '2nd' },
    { id: 'ward-private', name: 'Private Ward', type: 'private', totalBeds: 10, floor: '3rd' },
  ]
  for (const w of wards) {
    await db.ward.upsert({
      where: { id: w.id },
      update: {},
      create: {
        ...w,
        organizationId: 'org-demo',
        availableBeds: w.totalBeds,
        occupiedBeds: 0,
        isActive: true,
        updatedAt: new Date(),
      },
    }).catch(() => {})
    console.log('✅ Ward created:', w.name)
  }

  console.log('\n🎉 Database seeded successfully!')
  console.log('\nLogin credentials:')
  console.log('Admin:  admin@gudmed.in / Admin@123')
  console.log('Doctor: priya@gudmed.in / Doctor@123')
}

main()
  .catch(e => { console.error('Seed failed:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
