import { Router } from 'express'
import { authenticate } from '../middleware/auth.js'
import authRoutes from './authRoutes.js'
import dashboardRoutes from './dashboardRoutes.js'
import preTriageRoutes from './preTriageRoutes.js'
import triageRoutes from './triageRoutes.js'
import appointmentRoutes from './appointmentRoutes.js'
import patientRoutes from './patientRoutes.js'
import consultationRoutes from './consultationRoutes.js'
import settingsRoutes from './settingsRoutes.js'
import pharmacyRoutes from './pharmacyRoutes.js'
import laboratoryRoutes from './laboratoryRoutes.js'
import radiologyRoutes from './radiologyRoutes.js'
import inpatientRoutes from './inpatientRoutes.js'
import billingRoutes from './billingRoutes.js'
import { router as deathCertificateRoutes } from './deathCertificateRoutes.js'
import { router as doctorAccountabilityRoutes } from './doctorAccountabilityRoutes.js'
import notificationRoutes from './notificationRoutes.js'
import paymentRoutes from './paymentRoutes.js'
import importRoutes from './importRoutes.js'

export const router = Router()

// Auth routes (no authenticate middleware needed — these issue the token)
router.use('/auth', authRoutes)

// Apply authenticate middleware to all routes below — sets req.organizationId from JWT or env fallback
router.use(authenticate)

router.get('/', (_req, res) => res.json({ message: 'Hospital Management API', version: '1.0.0' }))

router.use('/dashboard', dashboardRoutes)
router.use('/pre-triage', preTriageRoutes)
router.use('/triage', triageRoutes)
router.use('/appointments', appointmentRoutes)
router.use('/patients', patientRoutes)
router.use('/consultations', consultationRoutes)
router.use('/settings', settingsRoutes)
router.use('/pharmacy', pharmacyRoutes)
router.use('/laboratory', laboratoryRoutes)
router.use('/radiology', radiologyRoutes)
router.use('/inpatient', inpatientRoutes)
router.use('/billing', billingRoutes)
router.use('/death-certificates', deathCertificateRoutes)
router.use('/doctor-accountability', doctorAccountabilityRoutes)
router.use('/notifications', notificationRoutes)
router.use('/payments',      paymentRoutes)
router.use('/import',        importRoutes)
