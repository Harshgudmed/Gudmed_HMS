import { db } from '../config/db.js'

export async function getAll(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { patientId, doctorId, date } = req.query
    const limit = parseInt(req.query.limit || '50')
    const offset = parseInt(req.query.offset || '0')

    const where = { organizationId }

    if (patientId) where.patientId = patientId
    if (doctorId) where.doctorId = doctorId
    if (date) {
      const targetDate = new Date(date)
      where.visitDate = {
        gte: new Date(new Date(targetDate).setHours(0, 0, 0, 0)),
        lte: new Date(new Date(targetDate).setHours(23, 59, 59, 999)),
      }
    }

    const [consultations, total] = await Promise.all([
      db.consultation.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { visitDate: 'desc' },
        include: {
          patient: {
            select: { id: true, mrn: true, firstName: true, middleName: true, lastName: true, phonePrimary: true, gender: true, dateOfBirth: true, bloodGroup: true },
          },
          doctor: { select: { id: true, fullName: true, specialization: true } },
          prescriptions: true,
          labOrders: true,
          radiologyOrders: true,
        },
      }),
      db.consultation.count({ where })
    ])

    res.json({ 
      success: true, 
      data: consultations,
      meta: { total, limit, offset, hasMore: offset + limit < total }
    })
  } catch (err) {
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const validatedData = req.validatedBody
    const { prescriptionItems, ...consultationData } = validatedData

    // Use a transaction to ensure consultation, prescriptions, and appointment updates all succeed or fail together
    const consultation = await db.$transaction(async (tx) => {
      const newConsultation = await tx.consultation.create({
        data: {
          organizationId,
          patientId: consultationData.patientId,
          doctorId: consultationData.doctorId,
          appointmentId: consultationData.appointmentId,
          visitType: consultationData.visitType || 'outpatient',
          temperature: consultationData.temperature,
          bloodPressureSystolic: consultationData.bloodPressureSystolic,
          bloodPressureDiastolic: consultationData.bloodPressureDiastolic,
          pulseRate: consultationData.pulseRate,
          respiratoryRate: consultationData.respiratoryRate,
          weight: consultationData.weight,
          height: consultationData.height,
          oxygenSaturation: consultationData.oxygenSaturation,
          chiefComplaint: consultationData.chiefComplaint,
          historyOfPresentIllness: consultationData.historyOfPresentIllness,
          physicalExamination: consultationData.physicalExamination,
          diagnosis: consultationData.diagnosis,
          icd10Codes: consultationData.icd10Codes ? JSON.stringify(consultationData.icd10Codes) : null,
          treatmentPlan: consultationData.treatmentPlan,
          followUpInstructions: consultationData.followUpInstructions,
          followUpDate: consultationData.followUpDate ? new Date(consultationData.followUpDate) : null,
          referredTo: consultationData.referredTo,
          referralReason: consultationData.referralReason,
          notes: consultationData.notes,
        },
        include: {
          patient: { select: { id: true, mrn: true, firstName: true, middleName: true, lastName: true } },
          doctor: { select: { id: true, fullName: true } },
        },
      })

      let prescriptionId = null
      if (prescriptionItems && prescriptionItems.length > 0) {
        const prescription = await tx.prescription.create({
          data: {
            organizationId,
            patientId: consultationData.patientId,
            doctorId: consultationData.doctorId,
            consultationId: newConsultation.id,
            items: JSON.stringify(prescriptionItems),
            status: 'pending',
          },
        })
        prescriptionId = prescription.id
      }

      if (consultationData.appointmentId) {
        await tx.appointment.update({
          where: { id: consultationData.appointmentId },
          data: { status: 'completed', completedAt: new Date() },
        })
      }

      return { consultation: newConsultation, prescriptionId }
    })

    res.status(201).json({ success: true, data: consultation.consultation, prescriptionId: consultation.prescriptionId, message: 'Consultation saved successfully' })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { id } = req.params
    const { prescriptionItems, ...updateData } = req.validatedBody

    if (updateData.icd10Codes && Array.isArray(updateData.icd10Codes)) {
      updateData.icd10Codes = JSON.stringify(updateData.icd10Codes)
    }
    if (updateData.followUpDate) {
      updateData.followUpDate = new Date(updateData.followUpDate)
    }

    // Use a transaction to safely handle both consultation updates and prescription updates
    const consultation = await db.$transaction(async (tx) => {
      // 1. Update the main consultation record
      await tx.consultation.update({
        where: { id },
        data: updateData,
      })

      // 2. Handle Prescriptions
      if (prescriptionItems && prescriptionItems.length > 0) {
        // Check if a prescription already exists for this consultation
        const existingPrescription = await tx.prescription.findFirst({
          where: { consultationId: id }
        })

        if (existingPrescription) {
          // Update the existing prescription with the new medicines
          await tx.prescription.update({
            where: { id: existingPrescription.id },
            data: { items: JSON.stringify(prescriptionItems) }
          })
        } else {
          // If no prescription existed, we need to create one. 
          // We fetch the consultation to get the patientId and doctorId.
          const currentConsultation = await tx.consultation.findUnique({ where: { id } })
          await tx.prescription.create({
            data: {
              organizationId,
              patientId: currentConsultation.patientId,
              doctorId: currentConsultation.doctorId,
              consultationId: currentConsultation.id,
              items: JSON.stringify(prescriptionItems),
              status: 'pending',
            }
          })
        }
      }

      // 3. Fetch and return the fully assembled, updated record to send to the frontend
      return await tx.consultation.findUnique({
        where: { id },
        include: {
          patient: { select: { id: true, mrn: true, firstName: true, middleName: true, lastName: true } },
          doctor: { select: { id: true, fullName: true } },
          prescriptions: true,
        },
      })
    })

    res.json({ success: true, data: consultation })
  } catch (err) {
    next(err)
  }
}
