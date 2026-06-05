import { db } from '../config/db.js'
import { z } from 'zod'

const MS_PER_DAY = 1000 * 60 * 60 * 24

// ─── Validation Schemas ───────────────────────────────────────────────────────

const wardSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().optional(),
  type: z.string().optional(),
  capacity: z.number().int().optional(),
  floor: z.string().optional(),
  chargeNurse: z.string().optional(),
  phone: z.string().optional(),
  departmentId: z.string().optional(),
})

const bedSchema = z.object({
  wardId: z.string().min(1, 'Ward ID is required'),
  bedNumber: z.string().min(1, 'Bed number is required'),
  type: z.string().optional(),
  status: z.string().default('available'),
})

const admissionSchema = z.object({
  patientId: z.string().min(1, 'Patient ID is required'),
  bedId: z.string().optional(),
  wardId: z.string().optional(),
  admissionType: z.string().optional(),
  admissionReason: z.string().optional(),
  admissionDiagnosis: z.string().optional(),
  chiefComplaint: z.string().optional(),
  expectedLengthOfStay: z.number().int().optional(),
  depositAmount: z.number().optional(),
  admissionNotes: z.string().optional(),
  isCritical: z.boolean().optional(),
  criticalLevel: z.string().optional(),
  admittingDoctorId: z.string().optional(),
  attendingDoctorId: z.string().optional(),
})

const clinicalNoteSchema = z.object({
  admissionId: z.string().min(1, 'Admission ID is required'),
  note: z.string().min(1, 'Note is required'),
  noteType: z.string().optional(),
  authorName: z.string().optional(),
  vitals: z.any().optional(),
})

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function getAll(req, res) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { resource, wardId, status } = req.query

    // Parse and validate pagination parameters
    let limit = parseInt(req.query.limit) || 10
    let offset = parseInt(req.query.offset) || 0
    limit = Math.max(1, Math.min(limit, 1000))
    offset = Math.max(0, offset)

    if (resource === 'wards') {
      const wards = await db.ward.findMany({
        where: { organizationId: ORGANIZATION_ID, isActive: true },
        include: { beds: true },
      })

      const result = wards.map((ward) => {
        const occupiedBeds = ward.beds.filter((b) => b.status === 'occupied').length
        return {
          ...ward,
          occupiedBeds,
          availableBeds: (ward.capacity ?? ward.beds.length) - occupiedBeds,
          occupancyRate:
            ward.capacity && ward.capacity > 0
              ? Math.round((occupiedBeds / ward.capacity) * 100)
              : 0,
        }
      })

      return res.json({ success: true, data: result })
    }

    if (resource === 'beds') {
      const where = { organizationId: ORGANIZATION_ID }
      if (wardId) where.wardId = wardId
      if (status) where.status = status

      const beds = await db.bed.findMany({
        where,
        include: { ward: true },
      })

      return res.json({ success: true, data: beds })
    }

    if (resource === 'admissions') {
      const where = { organizationId: ORGANIZATION_ID }
      if (status) where.status = status

      const [admissions, total] = await Promise.all([
        db.admission.findMany({
          where,
          include: {
            patient: {
              select: {
                id: true,
                mrn: true,
                firstName: true,
                lastName: true,
                gender: true,
                dateOfBirth: true,
                phonePrimary: true,
              },
            },
            bed: { include: { ward: true } },
          },
          orderBy: { admissionDate: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.admission.count({ where }),
      ])

      const hasMore = (offset + limit) < total
      const page = Math.floor(offset / limit) + 1
      const totalPages = Math.ceil(total / limit)

      return res.json({
        success: true,
        data: admissions,
        meta: { total, limit, offset, page, totalPages, hasMore }
      })
    }

    if (resource === 'notes') {
      const { admissionId } = req.query
      if (!admissionId) return res.status(400).json({ success: false, error: 'admissionId required' })
      const admission = await db.admission.findUnique({ where: { id: admissionId }, select: { clinicalNotes: true } })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      let notes = []
      try { notes = admission.clinicalNotes ? JSON.parse(admission.clinicalNotes) : [] } catch { notes = [] }
      const mapped = notes.map(n => ({
        id: n.id, type: n.noteType || 'Note', text: n.note, createdAt: n.date,
        vitals: n.vitals || null,
      }))
      return res.json({ success: true, data: mapped })
    }

    if (resource === 'billing') {
      const { admissionId } = req.query
      if (!admissionId) return res.status(400).json({ success: false, error: 'admissionId required' })
      const admission = await db.admission.findUnique({
        where: { id: admissionId },
        select: { dailyRoomRate: true, totalBillAmount: true, billGenerated: true, additionalCharges: true },
      })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      if (!admission.billGenerated) return res.json({ success: true, data: null })
      let charges = []
      try { charges = admission.additionalCharges ? JSON.parse(admission.additionalCharges) : [] } catch { charges = [] }
      return res.json({ success: true, data: { id: admissionId, dailyRate: admission.dailyRoomRate, totalBillAmount: admission.totalBillAmount, billGenerated: admission.billGenerated, charges } })
    }

    if (resource === 'stats') {
      const todayStart = new Date()
      todayStart.setHours(0, 0, 0, 0)
      const todayEnd = new Date()
      todayEnd.setHours(23, 59, 59, 999)

      const [totalBeds, occupiedBeds, todayAdmissions, todayDischarges] = await Promise.all([
        db.bed.count({ where: { organizationId: ORGANIZATION_ID } }),
        db.bed.count({ where: { organizationId: ORGANIZATION_ID, status: 'occupied' } }),
        db.admission.count({
          where: {
            organizationId: ORGANIZATION_ID,
            status: 'admitted',
            admissionDate: { gte: todayStart, lte: todayEnd },
          },
        }),
        db.admission.count({
          where: {
            organizationId: ORGANIZATION_ID,
            status: 'discharged',
            dischargeDate: { gte: todayStart, lte: todayEnd },
          },
        }),
      ])

      const availableBeds = totalBeds - occupiedBeds
      const occupancyRate =
        totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

      return res.json({
        success: true,
        data: {
          totalBeds,
          occupiedBeds,
          availableBeds,
          todayAdmissions,
          todayDischarges,
          occupancyRate,
        },
      })
    }

    return res.status(400).json({ error: 'Invalid resource. Use: wards, beds, admissions, notes, billing, stats' })
  } catch (err) {
    console.error('inpatient getAll error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function create(req, res) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { resource, ...body } = req.body

    if (resource === 'ward') {
      const parsed = wardSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const capacity = Math.max(1, parseInt(parsed.data.capacity) || 10)
      const ward = await db.ward.create({
        data: {
          ...parsed.data,
          capacity,
          organizationId: ORGANIZATION_ID,
          isActive: true,
        },
      })

      await db.bed.createMany({
        data: Array.from({ length: capacity }, (_, i) => ({
          organizationId: ORGANIZATION_ID,
          wardId: ward.id,
          bedNumber: String(i + 1),
          type: 'Standard',
          status: 'available',
        })),
      })

      const wardWithBeds = await db.ward.findUnique({
        where: { id: ward.id },
        include: { beds: true },
      })

      return res.status(201).json({ success: true, data: wardWithBeds })
    }

    if (resource === 'bed') {
      const parsed = bedSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const bed = await db.bed.create({
        data: {
          ...parsed.data,
          organizationId: ORGANIZATION_ID,
        },
        include: { ward: true },
      })

      return res.status(201).json({ success: true, data: bed })
    }

    if (resource === 'admission') {
      const parsed = admissionSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const { bedId, wardId: _wardId, ...admissionData } = parsed.data

      const admission = await db.admission.create({
        data: {
          ...admissionData,
          ...(bedId ? { bedId } : {}),
          organizationId: ORGANIZATION_ID,
          status: 'admitted',
          admissionDate: new Date(),
        },
        include: {
          patient: {
            select: {
              id: true,
              mrn: true,
              firstName: true,
              lastName: true,
              gender: true,
              dateOfBirth: true,
              phonePrimary: true,
            },
          },
          bed: { include: { ward: true } },
        },
      })

      if (bedId) {
        await db.bed.update({
          where: { id: bedId },
          data: { status: 'occupied' },
        })
      }

      return res.status(201).json({ success: true, data: admission })
    }

    if (resource === 'transfer') {
      const { admissionId, toWardId, toBedId, transferReason } = body
      if (!admissionId || !toBedId) {
        return res.status(400).json({ success: false, error: 'admissionId and toBedId required' })
      }
      const admission = await db.admission.findUnique({ where: { id: admissionId } })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      // Free old bed
      if (admission.bedId) await db.bed.update({ where: { id: admission.bedId }, data: { status: 'available' } })
      // Occupy new bed
      await db.bed.update({ where: { id: toBedId }, data: { status: 'occupied' } })
      const updated = await db.admission.update({
        where: { id: admissionId },
        data: { bedId: toBedId, status: 'admitted' },
        include: {
          patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
          bed: { include: { ward: true } },
        },
      })
      return res.json({ success: true, data: updated })
    }

    if (resource === 'sync-beds') {
      const { wardId } = body
      if (!wardId) return res.status(400).json({ success: false, error: 'wardId required' })

      const ward = await db.ward.findUnique({ where: { id: wardId }, include: { beds: true } })
      if (!ward) return res.status(404).json({ success: false, error: 'Ward not found' })

      const capacity = Math.max(ward.beds.length, ward.capacity || 10)
      const existingNumbers = new Set(ward.beds.map((b) => b.bedNumber))
      const toCreate = []
      for (let i = 1; i <= capacity; i++) {
        const num = String(i)
        if (!existingNumbers.has(num)) {
          toCreate.push({
            organizationId: ORGANIZATION_ID,
            wardId,
            bedNumber: num,
            type: 'Standard',
            status: 'available',
          })
        }
      }
      if (toCreate.length > 0) await db.bed.createMany({ data: toCreate })

      const wardWithBeds = await db.ward.findUnique({
        where: { id: wardId },
        include: { beds: { orderBy: { bedNumber: 'asc' } } },
      })
      return res.json({ success: true, data: wardWithBeds })
    }

    if (resource === 'note') {
      // Frontend-friendly alias: accepts { admissionId, type, text, vitals: {bp,temp,pulse,spo2,weight} }
      const { admissionId, type, text, vitals } = body
      if (!admissionId || !text) return res.status(400).json({ success: false, error: 'admissionId and text required' })
      const admission = await db.admission.findUnique({ where: { id: admissionId }, select: { clinicalNotes: true } })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      let existing = []
      try { existing = admission.clinicalNotes ? JSON.parse(admission.clinicalNotes) : [] } catch { existing = [] }
      const newNote = { id: `note-${Date.now()}`, date: new Date().toISOString(), noteType: type || 'Nursing', note: text, vitals: vitals || null }
      await db.admission.update({ where: { id: admissionId }, data: { clinicalNotes: JSON.stringify([...existing, newNote]) } })
      return res.status(201).json({ success: true, data: { ...newNote, type: newNote.noteType, text: newNote.note, createdAt: newNote.date } })
    }

    if (resource === 'billing') {
      const { admissionId, dailyRate } = body
      if (!admissionId) return res.status(400).json({ success: false, error: 'admissionId required' })
      const admission = await db.admission.findUnique({ where: { id: admissionId }, select: { admissionDate: true, additionalCharges: true } })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      const days = Math.max(1, Math.round((Date.now() - new Date(admission.admissionDate).getTime()) / (1000 * 60 * 60 * 24)))
      const rate = parseFloat(dailyRate) || 0
      let charges = []
      try { charges = admission.additionalCharges ? JSON.parse(admission.additionalCharges) : [] } catch { charges = [] }
      const extraTotal = charges.reduce((s, c) => s + (c.amount || 0) * (c.quantity || 1), 0)
      const total = rate * days + extraTotal
      await db.admission.update({ where: { id: admissionId }, data: { dailyRoomRate: rate, totalBillAmount: total, billGenerated: true } })
      return res.status(201).json({ success: true, data: { id: admissionId, dailyRate: rate, totalBillAmount: total, billGenerated: true, charges } })
    }

    if (resource === 'charge') {
      // billingId is the admissionId (billing is stored on admission)
      const { billingId, name, type, amount, quantity } = body
      if (!billingId || !name || amount === undefined) return res.status(400).json({ success: false, error: 'billingId, name, and amount required' })
      const admission = await db.admission.findUnique({ where: { id: billingId }, select: { additionalCharges: true, admissionDate: true, dailyRoomRate: true } })
      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })
      let charges = []
      try { charges = admission.additionalCharges ? JSON.parse(admission.additionalCharges) : [] } catch { charges = [] }
      const newCharge = { id: `charge-${Date.now()}`, name, type: type || 'Other', amount: parseFloat(amount) || 0, quantity: parseInt(quantity) || 1, date: new Date().toISOString() }
      charges.push(newCharge)
      const days = Math.max(1, Math.round((Date.now() - new Date(admission.admissionDate).getTime()) / (1000 * 60 * 60 * 24)))
      const extraTotal = charges.reduce((s, c) => s + (c.amount || 0) * (c.quantity || 1), 0)
      const total = (admission.dailyRoomRate || 0) * days + extraTotal
      await db.admission.update({ where: { id: billingId }, data: { additionalCharges: JSON.stringify(charges), totalBillAmount: total } })
      return res.status(201).json({ success: true, data: newCharge })
    }

    if (resource === 'clinical-note') {
      const parsed = clinicalNoteSchema.safeParse(body)
      if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.flatten() })
      }

      const { admissionId, note, noteType, authorName, vitals } = parsed.data

      const admission = await db.admission.findUnique({
        where: { id: admissionId },
        select: { clinicalNotes: true },
      })

      if (!admission) {
        return res.status(404).json({ error: 'Admission not found' })
      }

      const existingNotes = Array.isArray(admission.clinicalNotes)
        ? admission.clinicalNotes
        : []

      const newNote = {
        id: `note-${Date.now()}`,
        date: new Date().toISOString(),
        noteType: noteType ?? null,
        note,
        authorName: authorName ?? null,
        ...(vitals !== undefined ? { vitals } : {}),
      }

      const updatedNotes = [...existingNotes, newNote]

      await db.admission.update({
        where: { id: admissionId },
        data: { clinicalNotes: updatedNotes },
      })

      return res.status(201).json(newNote)
    }

    return res.status(400).json({ error: 'Invalid resource. Use: ward, bed, admission, note, billing, charge, clinical-note, sync-beds, transfer' })
  } catch (err) {
    console.error('inpatient create error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function update(req, res) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const resource = req.body.resource || req.query.resource
    const id = req.body.id || req.query.id

    // Support both nested updates object and flat body fields
    const { resource: _r, id: _i, updates: nestedUpdates, dailyRoomRate, ...flatBody } = req.body
    const updates = nestedUpdates || flatBody

    if (resource === 'discharge') {
      const admission = await db.admission.findUnique({
        where: { id },
        select: { bedId: true },
      })

      if (!admission) return res.status(404).json({ success: false, error: 'Admission not found' })

      if (admission.bedId) {
        await db.bed.update({
          where: { id: admission.bedId },
          data: { status: 'available' },
        })
      }

      const updated = await db.admission.update({
        where: { id },
        data: {
          status: 'discharged',
          dischargeDate: new Date(),
          dischargeDiagnosis: updates.dischargeDiagnosis,
          treatmentSummary: updates.treatmentSummary,
          medicationsOnDischarge: updates.medicationsOnDischarge,
          followUpInstructions: updates.followUpInstructions,
          dischargeCondition: updates.dischargeCondition,
          followUpDate: updates.followUpDate ? new Date(updates.followUpDate) : null,
          dischargeNotes: updates.dischargeNotes,
        },
      })

      return res.json({ success: true, data: updated })
    }

    if (resource === 'admission') {
      const admissionUpdates = { ...updates }

      if (admissionUpdates.status === 'discharged') {
        const admission = await db.admission.findUnique({
          where: { id },
          select: { bedId: true },
        })

        if (admission?.bedId) {
          await db.bed.update({
            where: { id: admission.bedId },
            data: { status: 'available' },
          })
        }

        admissionUpdates.dischargeDate = new Date()
      }

      const updated = await db.admission.update({
        where: { id },
        data: admissionUpdates,
      })

      return res.json({ success: true, data: updated })
    }

    if (resource === 'bed') {
      const updated = await db.bed.update({
        where: { id },
        data: updates,
      })

      return res.json({ success: true, data: updated })
    }

    if (resource === 'ward') {
      const { name, code, type, capacity, floor, chargeNurse, phone } = updates
      const wardData = {}
      if (name !== undefined) wardData.name = name
      if (code !== undefined) wardData.code = code
      if (type !== undefined) wardData.type = type
      if (capacity !== undefined) wardData.capacity = parseInt(capacity) || 0
      if (floor !== undefined) wardData.floor = floor
      if (chargeNurse !== undefined) wardData.chargeNurse = chargeNurse
      if (phone !== undefined) wardData.phone = phone

      const updated = await db.ward.update({
        where: { id },
        data: wardData,
        include: { beds: true },
      })

      if (wardData.capacity !== undefined) {
        const target = parseInt(wardData.capacity) || 0
        const existing = updated.beds || []
        if (target > existing.length) {
          const start = existing.length + 1
          await db.bed.createMany({
            data: Array.from({ length: target - existing.length }, (_, i) => ({
              organizationId: ORGANIZATION_ID,
              wardId: id,
              bedNumber: String(start + i),
              type: 'Standard',
              status: 'available',
            })),
          })
        }
      }

      const wardWithBeds = await db.ward.findUnique({
        where: { id },
        include: { beds: { orderBy: { bedNumber: 'asc' } } },
      })

      return res.json({ success: true, data: wardWithBeds })
    }

    if (resource === 'generate-bill') {
      const admission = await db.admission.findUnique({
        where: { id },
        select: { admissionDate: true },
      })

      if (!admission) {
        return res.status(404).json({ error: 'Admission not found' })
      }

      const rate = dailyRoomRate ?? 0
      const days = Math.max(1, Math.round((Date.now() - new Date(admission.admissionDate).getTime()) / MS_PER_DAY))
      const totalBillAmount = days * rate

      await db.admission.update({
        where: { id },
        data: {
          dailyRoomRate: rate,
          totalBillAmount,
          billGenerated: true,
        },
      })

      return res.json({ success: true, days, dailyRoomRate: rate, totalBillAmount })
    }

    return res.status(400).json({ error: 'Invalid resource. Use: admission, discharge, bed, ward, generate-bill' })
  } catch (err) {
    console.error('inpatient update error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function remove(req, res) {
  try {
    const resource = req.body.resource || req.query.resource
    const id = req.body.id || req.query.id

    if (resource === 'ward') {
      const activeAdmissions = await db.admission.count({
        where: {
          status: 'admitted',
          bed: { wardId: id },
        },
      })

      if (activeAdmissions > 0) {
        return res.status(400).json({
          error: 'Cannot delete ward with active admissions',
        })
      }

      await db.bed.deleteMany({ where: { wardId: id } })
      await db.ward.delete({ where: { id } })

      return res.json({ success: true })
    }

    if (resource === 'bed') {
      await db.bed.delete({ where: { id } })

      return res.json({ success: true })
    }

    return res.status(400).json({ error: 'Invalid resource. Use: ward, bed' })
  } catch (err) {
    console.error('inpatient remove error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
