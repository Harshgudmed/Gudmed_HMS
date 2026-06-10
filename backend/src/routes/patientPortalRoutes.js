import { Router } from 'express'
import { getMyDashboard } from '../controllers/patientPortalController.js'

const router = Router()

// Mounted behind authenticate + requirePatient in routes/index.js.
router.get('/me', getMyDashboard)

export default router
