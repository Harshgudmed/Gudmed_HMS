import { db } from '../config/db.js'
import { getOrgId } from "../lib/reqContext.js";
import { startOfDay, endOfDay } from '../utils/dates.js'
import { scopedDoctorId } from '../utils/scope.js'

export async function getAll(req, res, next) {
  try {
    const organizationId = getOrgId(req)
    const { date, status, doctorId, patientId } = req.query
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')

    const where = { organizationId }

    if (date) {
      // Match any appointment that falls on the requested calendar day
      where.appointmentDate = { gte: startOfDay(date), lte: endOfDay(date) }
    }
    if (status) where.status = status
    if (doctorId) where.doctorId = doctorId
    if (patientId) where.patientId = patientId

    // A doctor only sees their own appointments (overrides any doctorId query param).
    const myDoctorId = scopedDoctorId(req)
    if (myDoctorId) where.doctorId = myDoctorId

    const [appointments, total] = await Promise.all([
      db.appointment.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, lastName: true, phonePrimary: true, gender: true, dateOfBirth: true },
          },
          doctor: {
            select: { id: true, fullName: true, specialization: true },
          },
        },
      }),
      db.appointment.count({ where }),
    ])

    res.json({ 
      success: true, 
      data: appointments,
      meta: { total, limit, offset, hasMore: offset + limit < total }
    })
  } catch (err) {
    next(err)
  }
}

export async function getOne(req, res, next) {
  try {
    const organizationId = getOrgId(req)
    const { id } = req.params

    // Scope single-appointment reads to the doctor's own (others → 404 below).
    const where = { id, organizationId }
    const myDoctorId = scopedDoctorId(req)
    if (myDoctorId) where.doctorId = myDoctorId

    const appointment = await db.appointment.findFirst({
      where,
      include: {
        patient: true,
        doctor: { select: { id: true, fullName: true, specialization: true } },
        consultations: true,
      },
    })

    if (!appointment) {
      return res.status(404).json({ success: false, error: 'Appointment not found' })
    }

    res.json({ success: true, data: appointment })
  } catch (err) {
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const organizationId = getOrgId(req)
    const validatedData = req.validatedBody

    const apptDate = new Date(validatedData.appointmentDate)
    let consultationFee = null
    let appliedSlabInfo = null

    // If frontend sends consultationFee (from OPD service selection), use it directly
    if (validatedData.consultationFee !== null && validatedData.consultationFee !== undefined && validatedData.consultationFee !== '') {
      consultationFee = parseFloat(validatedData.consultationFee)
      appliedSlabInfo = { type: 'opd_service_selected' }
    } else if (validatedData.doctorId) {
      // Otherwise, get doctor's fee based on slabs or default
      const doctor = await db.user.findFirst({
        where: { id: validatedData.doctorId, organizationId, role: 'doctor' },
        select: { consultationFee: true, id: true },
      })

      if (!doctor) {
        return res.status(404).json({ success: false, error: 'Doctor not found' })
      }

      // Anchor: the patient's most recent NEW-PATIENT visit with this doctor.
      // Follow-up pricing is measured from this visit (not from the last visit of
      // any kind), so all follow-ups are priced relative to the original new visit.
      const lastNewVisit = await db.appointment.findFirst({
        where: {
          organizationId,
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          appointmentType: 'new_patient',
          status: { notIn: ['cancelled', 'rescheduled'] },
          appointmentDate: { lt: apptDate },
        },
        orderBy: { appointmentDate: 'desc' },
        select: { appointmentDate: true },
      })

      let daysSinceLastVisit = null
      if (lastNewVisit) {
        daysSinceLastVisit = Math.floor((apptDate - new Date(lastNewVisit.appointmentDate)) / (1000 * 60 * 60 * 24))
      }

      // Apply fee based on slab or base fee
      if (!lastNewVisit || daysSinceLastVisit > 30) {
        // First-ever new patient, or beyond the 30-day window (reset to New Patient)
        consultationFee = doctor.consultationFee || 500
        appliedSlabInfo = { type: lastNewVisit ? '30day_reset' : 'new_patient' }
      } else {
        // Check for matching slab
        const slab = await db.doctorFeeSlab.findFirst({
          where: {
            doctorId: validatedData.doctorId,
            organizationId,
            isActive: true,
            fromDays: { lte: daysSinceLastVisit },
            toDays: { gt: daysSinceLastVisit },
          },
        })

        if (slab) {
          consultationFee = slab.feeAmount
          appliedSlabInfo = { type: 'slab', slabId: slab.id, fromDays: slab.fromDays, toDays: slab.toDays }
        } else {
          // No slab matched, use base fee
          consultationFee = doctor.consultationFee || 500
          appliedSlabInfo = { type: 'default' }
        }
      }
    }

    // Create appointment, invoice, AND commission in transaction
    const { appointment, draftInvoiceNumber, commission } = await db.$transaction(async (tx) => {
      const appointment = await tx.appointment.create({
        data: {
          organizationId,
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          appointmentDate: apptDate,
          appointmentTime: validatedData.appointmentTime,
          appointmentType: validatedData.appointmentType,
          priority: validatedData.priority || 'normal',
          notes: validatedData.notes,
          departmentId: validatedData.departmentId,
          consultationFee,
          status: 'scheduled',
          reminderSent: false,
        },
        include: {
          patient: { select: { id: true, mrn: true, firstName: true, lastName: true, phonePrimary: true } },
          doctor: { select: { id: true, fullName: true } },
        },
      })

      // Create draft invoice
      const aptType = validatedData.appointmentType || 'OPD'
      const opdService = await tx.billingService.findFirst({
        where: { organizationId, isActive: true, serviceCategory: 'consultation' },
        orderBy: { createdAt: 'asc' },
      })
      const unitPrice = consultationFee ?? opdService?.unitPrice ?? 500
      const description = opdService?.serviceName ?? `${aptType} Consultation`
      const invoiceNumber = `INV${Date.now()}`

      const invoice = await tx.invoice.create({
        data: {
          organizationId,
          patientId: validatedData.patientId,
          invoiceNumber,
          items: JSON.stringify([{
            type: 'consultation',
            description,
            quantity: 1,
            unitPrice,
            discount: 0,
            tax: 0,
            total: unitPrice,
          }]),
          subtotal: unitPrice,
          discountAmount: 0,
          discountPercentage: 0,
          taxAmount: 0,
          totalAmount: unitPrice,
          balanceDue: unitPrice,
          status: 'draft',
          paymentStatus: 'unpaid',
          notes: `Auto-voucher | Appointment: ${appointment.id} | Type: ${aptType}`,
        },
      })

      // Auto-create commission if doctor has commission config
      let commission = null
      if (validatedData.doctorId) {
        const commissionConfig = await tx.doctorCommissionConfig.findUnique({
          where: { doctorId: validatedData.doctorId },
        })

        if (commissionConfig && commissionConfig.isActive && unitPrice > 0) {
          const commissionAmount = commissionConfig.commissionType === 'percentage'
            ? (unitPrice * commissionConfig.commissionRate) / 100
            : commissionConfig.commissionRate

          commission = await tx.doctorCommission.create({
            data: {
              organizationId,
              doctorId: validatedData.doctorId,
              invoiceId: invoice.id,
              invoiceAmount: unitPrice,
              commissionRate: commissionConfig.commissionRate,
              commissionType: commissionConfig.commissionType,
              commissionAmount,
              status: 'pending',
            },
          })
        }
      }

      return { appointment, draftInvoiceNumber: invoice.invoiceNumber, commission }
    })

    const messageLines = [
      `Appointment scheduled`,
      consultationFee === 0 ? ` — Free follow-up (no charge)` : '',
      draftInvoiceNumber ? ` — Draft invoice ${draftInvoiceNumber} created` : '',
      commission ? ` — Commission ₹${commission.commissionAmount.toFixed(2)} auto-generated` : '',
    ].filter(Boolean).join('')

    res.status(201).json({
      success: true,
      data: { ...appointment, draftInvoiceNumber, appliedSlabInfo, commission },
      message: messageLines,
    })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const organizationId = getOrgId(req)
    const { id } = req.params
    const body = req.body

    // Ensure the appointment belongs to this org before mutating it
    const existing = await db.appointment.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Appointment not found' })
    }

    // Whitelist: only these fields can be changed — sensitive fields like
    // organizationId, patientId, invoiceId are never touched.
    const updates = {}
    if (body.appointmentDate !== undefined) updates.appointmentDate = body.appointmentDate
    if (body.appointmentTime !== undefined) updates.appointmentTime = body.appointmentTime
    if (body.appointmentType !== undefined) updates.appointmentType = body.appointmentType
    if (body.doctorId        !== undefined) updates.doctorId        = body.doctorId
    if (body.notes           !== undefined) updates.notes           = body.notes
    if (body.reason          !== undefined) updates.reason          = body.reason
    if (body.consultationFee !== undefined) updates.consultationFee = body.consultationFee
    if (body.reminderSent    !== undefined) updates.reminderSent    = body.reminderSent

    // Status change → auto-set the matching timestamp
    if (body.status !== undefined) {
      updates.status = body.status
      if      (body.status === 'checked_in')  updates.checkedInAt  = new Date()
      else if (body.status === 'in_progress') updates.startedAt    = new Date()
      else if (body.status === 'completed')   updates.completedAt  = new Date()
      else if (body.status === 'cancelled')   updates.cancelledAt  = new Date()
      else if (body.status === 'no_show')     updates.cancelledAt  = new Date()
    }

    if (body.reminderSent === true) updates.reminderSentAt = new Date()

    const appointment = await db.appointment.update({
      where: { id },
      data: updates,
      include: {
        patient: {
          select: { id: true, mrn: true, firstName: true, lastName: true, phonePrimary: true, gender: true, dateOfBirth: true },
        },
        doctor: {
          select: { id: true, fullName: true, specialization: true },
        },
      },
    })

    res.json({ success: true, data: appointment })
  } catch (err) {
    next(err)
  }
}

export async function remove(req, res, next) {
  try {
    const organizationId = getOrgId(req)
    const { id } = req.params

    // Scope the delete to this org — deleteMany lets us filter on non-unique fields
    const { count } = await db.appointment.deleteMany({ where: { id, organizationId } })
    if (count === 0) {
      return res.status(404).json({ success: false, error: 'Appointment not found' })
    }

    res.json({ success: true, message: 'Appointment deleted' })
  } catch (err) {
    next(err)
  }
}
