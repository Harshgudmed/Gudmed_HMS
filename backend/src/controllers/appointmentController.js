import { db } from '../config/db.js'
import { syncAppointmentToGudmed } from '../services/gudmedService.js'

export async function getAll(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { date, status, doctorId, patientId } = req.query
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')

    const where = { organizationId }

    if (date) {
      const targetDate = new Date(date)
      const startOfDay = new Date(new Date(targetDate).setHours(0, 0, 0, 0))
      const endOfDay = new Date(new Date(targetDate).setHours(23, 59, 59, 999))   
      where.appointmentDate = { gte: startOfDay, lte: endOfDay }
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
    const { id } = req.params

    const appointment = await db.appointment.findUnique({
      where: { id },
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
    const validatedData = req.validatedBody // Pulled from the validation middleware

    const appointment = await db.appointment.create({
      data: {
        organizationId,
        patientId: validatedData.patientId,
        doctorId: validatedData.doctorId,
        appointmentDate: new Date(validatedData.appointmentDate),
        appointmentTime: validatedData.appointmentTime,
        durationMinutes: validatedData.durationMinutes,
        appointmentType: validatedData.appointmentType,
        priority: validatedData.priority || 'normal',
        chiefComplaint: validatedData.chiefComplaint,
        notes: validatedData.notes,
        departmentId: validatedData.departmentId,
        status: 'scheduled',
        reminderSent: false,
      },
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
        doctor: { select: { id: true, fullName: true } },
      },
    })

    // Auto-create draft OPD invoice (non-fatal)
    let draftInvoiceNumber = null
    try {
      const aptType = validatedData.appointmentType || 'OPD'
      const opdService = await db.billingService.findFirst({
        where: { organizationId, isActive: true, serviceCategory: 'consultation' },
        orderBy: { createdAt: 'asc' },
      })
      const unitPrice = opdService?.unitPrice ?? 500
      const description = opdService?.serviceName ?? `${aptType} Consultation`
      const invoiceNumber = `INV${Date.now()}`

      const invoice = await db.invoice.create({
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
      draftInvoiceNumber = invoice.invoiceNumber
    } catch (e) {
      console.warn('Auto-voucher creation failed (non-fatal):', e.message)
    }

    // Sync to GudMed DocPortal (non-fatal)
    let gudmedSynced = false
    try {
      const patientName  = `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim()
      const patientMobile = appointment.patient.phonePrimary || ''
      await syncAppointmentToGudmed({
        patientName,
        patientMobile,
        appointmentDate: validatedData.appointmentDate,
        appointmentTime: validatedData.appointmentTime,
      })
      gudmedSynced = true
    } catch (e) {
      console.warn('GudMed sync failed (non-fatal):', e.message)
    }

    res.status(201).json({
      success: true,
      data: { ...appointment, draftInvoiceNumber },
      message: `Appointment scheduled${draftInvoiceNumber ? ` — Draft invoice ${draftInvoiceNumber} created` : ''}`,
      gudmedSynced,
    })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const { id } = req.params
    const body = req.body

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
    const { id } = req.params
    await db.appointment.delete({ where: { id } })
    res.json({ success: true, message: 'Appointment deleted' })
  } catch (err) {
    next(err)
  }
}
