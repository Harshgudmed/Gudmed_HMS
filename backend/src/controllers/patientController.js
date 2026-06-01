import { db } from '../config/db.js'
import { z } from 'zod'

function generateUHID() {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0')
  return `UHID${date}${random}`
}

const patientSchema = z.object({
  firstName: z.string().min(2),
  middleName: z.string().optional(),
  lastName: z.string().min(2),
  dateOfBirth: z.string(),
  gender: z.enum(['male', 'female', 'other']),
  phonePrimary: z.string().optional(),
  phoneSecondary: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  region: z.string().optional(),
  zone: z.string().optional(),
  woreda: z.string().optional(),
  kebele: z.string().optional(),
  houseNumber: z.string().optional(),
  addressDescription: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
  bloodGroup: z.string().optional(),
  allergies: z.array(z.string()).optional(),
  chronicConditions: z.array(z.string()).optional(),
  currentMedications: z.array(z.string()).optional(),
  hasInsurance: z.boolean().default(false),
  insuranceProvider: z.string().optional(),
  insuranceId: z.string().optional(),
  insuranceExpiryDate: z.string().optional(),
  maritalStatus: z.string().optional(),
  occupation: z.string().optional(),
  isVip: z.boolean().default(false),
  notes: z.string().optional(),
})

export async function getAll(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const search = req.query.search || ''
    const status = req.query.status || 'all'
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')

    const where = { organizationId }
    if (status === 'active') where.isActive = true
    else if (status === 'inactive') where.isActive = false

    if (search) {
      where.OR = [
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { mrn: { contains: search, mode: 'insensitive' } },
        { phonePrimary: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [patients, total] = await Promise.all([
      db.patient.findMany({ where, take: limit, skip: offset, orderBy: { createdAt: 'desc' } }),
      db.patient.count({ where }),
    ])

    res.json({ success: true, data: patients, meta: { total, limit, offset, hasMore: offset + limit < total } })
  } catch (err) {
    next(err)
  }
}

export async function getOne(req, res, next) {
  try {
    const patient = await db.patient.findUnique({ where: { id: req.params.id } })
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const validatedData = patientSchema.parse(req.body)

    const patient = await db.patient.create({
      data: {
        organizationId,
        mrn: generateUHID(),
        firstName: validatedData.firstName,
        middleName: validatedData.middleName,
        lastName: validatedData.lastName,
        dateOfBirth: new Date(validatedData.dateOfBirth),
        gender: validatedData.gender,
        phonePrimary: validatedData.phonePrimary,
        phoneSecondary: validatedData.phoneSecondary,
        email: validatedData.email || null,
        region: validatedData.region,
        zone: validatedData.zone,
        woreda: validatedData.woreda,
        kebele: validatedData.kebele,
        houseNumber: validatedData.houseNumber,
        addressDescription: validatedData.addressDescription,
        emergencyContactName: validatedData.emergencyContactName,
        emergencyContactPhone: validatedData.emergencyContactPhone,
        emergencyContactRelationship: validatedData.emergencyContactRelationship,
        bloodGroup: validatedData.bloodGroup,
        allergies: validatedData.allergies ? JSON.stringify(validatedData.allergies) : null,
        chronicConditions: validatedData.chronicConditions ? JSON.stringify(validatedData.chronicConditions) : null,
        currentMedications: validatedData.currentMedications ? JSON.stringify(validatedData.currentMedications) : null,
        hasInsurance: validatedData.hasInsurance,
        insuranceProvider: validatedData.insuranceProvider,
        insuranceId: validatedData.insuranceId,
        insuranceExpiryDate: validatedData.insuranceExpiryDate ? new Date(validatedData.insuranceExpiryDate) : null,
        maritalStatus: validatedData.maritalStatus,
        occupation: validatedData.occupation,
        isVip: validatedData.isVip,
        notes: validatedData.notes,
      },
    })

    await db.auditLog.create({
      data: {
        organizationId,
        action: 'create',
        entityType: 'patient',
        entityId: patient.id,
        description: `Patient ${patient.mrn} registered`,
      },
    }).catch(() => {})

    res.status(201).json({
      success: true,
      data: patient,
      message: `Patient registered successfully. UHID: ${patient.mrn}`,
    })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params
    const body = req.body

    const updateData = { ...body }
    if (updateData.dateOfBirth) updateData.dateOfBirth = new Date(updateData.dateOfBirth)
    if (updateData.insuranceExpiryDate) updateData.insuranceExpiryDate = new Date(updateData.insuranceExpiryDate)
    if (Array.isArray(updateData.allergies)) updateData.allergies = JSON.stringify(updateData.allergies)
    if (Array.isArray(updateData.chronicConditions)) updateData.chronicConditions = JSON.stringify(updateData.chronicConditions)
    if (Array.isArray(updateData.currentMedications)) updateData.currentMedications = JSON.stringify(updateData.currentMedications)

    const patient = await db.patient.update({ where: { id }, data: updateData })
    res.json({ success: true, data: patient })
  } catch (err) {
    next(err)
  }
}

export async function remove(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { id } = req.params
    await db.patient.delete({ where: { id, organizationId } })
    res.json({ success: true, message: "Patient deleted successfully" })
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ success: false, error: "Patient not found" })
    }
    next(err)
  }
}
