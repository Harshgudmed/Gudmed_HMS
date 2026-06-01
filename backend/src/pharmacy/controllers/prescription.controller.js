import { db } from '../../config/db.js'
import { createPrescriptionSchema, updatePrescriptionSchema } from '../validations/prescription.validation.js'
import { getPagination, paginationMeta, handleServiceError, makeError } from '../utils.js'

const SORTABLE_FIELDS = ['prescriptionDate', 'status', 'createdAt']

const PATIENT_SELECT = { id: true, mrn: true, firstName: true, lastName: true, phonePrimary: true }
const DOCTOR_SELECT  = { id: true, fullName: true }

export async function list(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { status, patientId, doctorId, sortBy, sortOrder } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const where = { organizationId: ORGANIZATION_ID }
    if (status) where.status = status
    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId

    const orderBy = SORTABLE_FIELDS.includes(sortBy)
      ? { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' }
      : { createdAt: 'desc' }

    const [data, total] = await Promise.all([
      db.prescription.findMany({
        where,
        include: {
          patient: { select: PATIENT_SELECT },
          doctor: { select: DOCTOR_SELECT },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.prescription.count({ where }),
    ])

    res.json({ success: true, data, pagination: paginationMeta(page, limit, total) })
  } catch (err) {
    next(err)
  }
}

export async function getById(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const prescription = await db.prescription.findFirst({
      where: { id: req.params.id, organizationId: ORGANIZATION_ID },
      include: {
        patient: { select: PATIENT_SELECT },
        doctor: { select: DOCTOR_SELECT },
      },
    })
    if (!prescription) throw makeError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND')
    res.json({ success: true, data: prescription })
  } catch (err) {
    if (handleServiceError(res, err)) return
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const parsed = createPrescriptionSchema.parse(req.body)

    const data = await db.prescription.create({
      data: {
        organizationId: ORGANIZATION_ID,
        patientId: parsed.patientId,
        doctorId: parsed.doctorId,
        consultationId: parsed.consultationId ?? undefined,
        items: JSON.stringify(parsed.items),
        notes: parsed.notes ?? undefined,
        status: 'pending',
      },
    })

    res.status(201).json({ success: true, data, message: 'Prescription created successfully' })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const parsed = updatePrescriptionSchema.parse(req.body)

    const existing = await db.prescription.findFirst({
      where: { id: req.params.id, organizationId: ORGANIZATION_ID },
    })
    if (!existing) throw makeError('Prescription not found', 404, 'PRESCRIPTION_NOT_FOUND')

    const updateData = { ...parsed }
    if (updateData.dispensedAt) updateData.dispensedAt = new Date(updateData.dispensedAt)
    if (updateData.items && Array.isArray(updateData.items)) {
      updateData.items = JSON.stringify(updateData.items)
    }

    const data = await db.prescription.update({ where: { id: req.params.id }, data: updateData })
    res.json({ success: true, data, message: 'Prescription updated successfully' })
  } catch (err) {
    if (handleServiceError(res, err)) return
    next(err)
  }
}
