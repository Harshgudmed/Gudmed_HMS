import { PrismaClient } from '@prisma/client'
import axios from 'axios'

const PROD_API = 'https://gudmed-api.onrender.com/api'

async function check() {
  try {
    // Check production backend for death certificates
    console.log('Checking production for death certificates...\n')

    const res = await axios.get(`${PROD_API}/death-certificates`, {
      headers: { Authorization: 'Bearer dummy-token' },
      timeout: 10000
    }).catch(e => e.response)

    if (res?.status === 401 || res?.status === 403) {
      console.log('❌ Need valid token to check production')
      console.log('Note: Death Certificates route requires authentication')
      return
    }

    if (res?.data?.data) {
      console.log(`✅ Found ${res.data.data.length} death certificates in production`)
      res.data.data.slice(0, 3).forEach(dc => {
        console.log(`  - ID: ${dc.id}, Patient: ${dc.patientId}, Status: ${dc.status}`)
      })
    } else {
      console.log('⚠️  No death certificates in production API response')
    }
  } catch (err) {
    console.error('Error checking production:', err.message)
  }
}

check()
