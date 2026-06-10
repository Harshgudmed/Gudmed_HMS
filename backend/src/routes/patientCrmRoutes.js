import { Router } from 'express'
import { getCrmUsers, assignPatient, routePatient } from '../controllers/patientCrmController.js'

const router = Router()

router.get('/users',  getCrmUsers)   // CRM users for the assign dropdown
router.post('/assign', assignPatient) // assign a patient to a CRM user
router.post('/route',  routePatient)  // send a patient to Lab / Radiology / IPD / Pharmacy

export default router
