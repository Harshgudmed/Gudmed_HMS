import { db } from '../config/db.js'
import { startOfDay, endOfDay } from '../utils/dates.js'

export async function getAll(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
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
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { id } = req.params

    const appointment = await db.appointment.findFirst({
      where: { id, organizationId },
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
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
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

      // Find patient's last appointment with this doctor
      const lastAppointment = await db.appointment.findFirst({
        where: {
          organizationId,
          patientId: validatedData.patientId,
          doctorId: validatedData.doctorId,
          status: { notIn: ['cancelled', 'rescheduled'] },
          appointmentDate: { lt: apptDate },
        },
        orderBy: { appointmentDate: 'desc' },
        select: { appointmentDate: true },
      })

      let daysSinceLastVisit = null
      if (lastAppointment) {
        daysSinceLastVisit = Math.floor((apptDate - new Date(lastAppointment.appointmentDate)) / (1000 * 60 * 60 * 24))
      }

      // Apply fee based on slab or base fee
      if (!lastAppointment || daysSinceLastVisit > 30) {
        // New patient or beyond 30-day window
        consultationFee = doctor.consultationFee || 500
        appliedSlabInfo = { type: lastAppointment ? '30day_reset' : 'new_patient' }
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
          durationMinutes: validatedData.durationMinutes,
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
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { id } = req.params
    const body = req.body

    // Ensure the appointment belongs to this org before mutating it
    const existing = await db.appointment.findFirst({ where: { id, organizationId }, select: { id: true } })
    if (!existing) {
      return res.status(404).json({ success: false, error: 'Appointment not found' })
    }

    const updates = { ...body }
    if (body.status === 'checked_in') updates.checkedInAt = new Date()
    else if (body.status === 'in_progress') updates.startedAt = new Date()
    else if (body.status === 'completed') updates.completedAt = new Date()
    else if (body.status === 'cancelled') updates.cancelledAt = new Date()
    else if (body.status === 'no_show') updates.cancelledAt = new Date()

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
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
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
