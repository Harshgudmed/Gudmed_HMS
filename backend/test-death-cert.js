import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const PROD_API = 'https://gudmed-api.onrender.com/api'

async function test() {
  try {
    console.log('Testing Death Certificate Creation...\n')

    // Get a valid JWT token from production
    const loginRes = await axios.post(`${PROD_API}/auth/login`, {
      email: 'admin@gudmed.in',
      password: 'Admin@123'
    }).catch(e => {
      console.error('❌ Login failed:', e.response?.data?.error || e.message)
      process.exit(1)
    })

    const token = loginRes.data?.token
    if (!token) {
      console.error('❌ No token received from login')
      process.exit(1)
    }

    console.log('✅ Logged in successfully')
    console.log(`   Token: ${token.slice(0, 20)}...`)

    // Get list of patients
    const patientsRes = await axios.get(`${PROD_API}/patients`, {
      headers: { Authorization: `Bearer ${token}` }
    })

    const patients = patientsRes.data?.data || []
    console.log(`\n✅ Found ${patients.length} patients in production`)

    if (patients.length === 0) {
      console.error('❌ No patients found! Cannot create death certificate without a patient.')
      console.log('\n💡 Fix: Go to Patients → New Patient, create at least one patient first.')
      process.exit(1)
    }

    const patient = patients[0]
    console.log(`   Using patient: ${patient.id} - ${patient.firstName} ${patient.lastName}`)

    // Try to create a death certificate with the valid patient ID
    console.log('\n📝 Creating death certificate...')

    const dcRes = await axios.post(`${PROD_API}/death-certificates`, {
      patientId: patient.id,
      certificateNumber: `DC-2026-${Math.random().toString(36).substr(2, 5).toUpperCase()}`,
      dateOfDeath: new Date().toISOString(),
      placeOfDeath: 'inpatient',
      sex: patient.sex || 'Male',
      immediateCause: 'Natural causes',
      mannerOfDeath: 'natural',
      certifiedById: null,
    }, {
      headers: { Authorization: `Bearer ${token}` }
    }).catch(e => {
      console.error('❌ Failed to create:', e.response?.data?.error || e.message)
      throw e
    })

    console.log('✅ Death Certificate Created!')
    console.log(`   ID: ${dcRes.data?.data?.id || dcRes.data?.id}`)
    console.log(`   Certificate #: ${dcRes.data?.data?.certificateNumber || dcRes.data?.certificateNumber}`)

  } catch (err) {
    console.error('\n❌ Error:', err.message)
    process.exit(1)
  }
}

test()
