import { db } from '../config/db.js'

// ── CRM users (for the "assign to" dropdown) ────────────────────────────────────
export async function getCrmUsers(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const users = await db.user.findMany({
      where: { organizationId, role: 'patient_crm', isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: 'asc' },
    })
    res.json({ success: true, data: users })
  } catch (err) { next(err) }
}

// ── Assign a patient to a CRM user (or unassign with crmUserId=null) ─────────────
export async function assignPatient(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { patientId, crmUserId } = req.body
    if (!patientId) return res.status(400).json({ success: false, error: 'patientId is required' })

    const patient = await db.patient.update({
      where: { id: patientId },
      data: { assignedCrmUserId: crmUserId || null },
    })

    await db.auditLog.create({
      data: {
        organizationId, action: 'update', entityType: 'patient', entityId: patientId,
        description: crmUserId ? `Assigned to CRM user ${crmUserId}` : 'Unassigned from CRM',
      },
    }).catch(() => {})

    res.json({ success: true, data: { id: patient.id, assignedCrmUserId: patient.assignedCrmUserId } })
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ success: false, error: 'Patient not found' })
    next(err)
  }
}

// ── Route a patient to one or more departments — creates the real record ─────────
// body: { patientId, departments: ['lab','radiology','ipd','pharmacy'] }
export async function routePatient(req, res, next) {
  try {
    const organizationId = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const requestedById = req.user?.userId
    const { patientId, departments } = req.body
    if (!patientId || !Array.isArray(departments) || departments.length === 0) {
      return res.status(400).json({ success: false, error: 'patientId and departments[] are required' })
    }

    const patient = await db.patient.findUnique({ where: { id: patientId } })
    if (!patient) return res.status(404).json({ success: false, error: 'Patient not found' })

    const results = {}
    const orderNo = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`

    for (const dept of departments) {
      try {
        if (dept === 'lab') {
          await db.labOrder.create({
            data: { organizationId, patientId, requestedById, orderNumber: orderNo('LAB'), tests: '[]', status: 'pending' },
          })
          results.lab = 'created'
        } else if (dept === 'radiology') {
          const exam = await db.radiologyExam.findFirst({ where: { organizationId }, select: { id: true } })
          if (!exam) { results.radiology = 'skipped: no exams configured'; continue }
          await db.radiologyOrder.create({
            data: { organizationId, patientId, requestedById, examId: exam.id, orderNumber: orderNo('RAD'), status: 'pending' },
          })
          results.radiology = 'created'
        } else if (dept === 'ipd') {
          await db.admission.create({
            data: { organizationId, patientId, admissionType: 'elective', status: 'admitted' },
          })
          results.ipd = 'created'
        } else if (dept === 'pharmacy') {
          // A prescription needs a doctor — use the patient's most recent doctor.
          const recent = await db.appointment.findFirst({
            where: { patientId, doctorId: { not: null } },
            orderBy: { appointmentDate: 'desc' }, select: { doctorId: true },
          }) || await db.consultation.findFirst({
            where: { patientId }, orderBy: { visitDate: 'desc' }, select: { doctorId: true },
          })
          if (!recent?.doctorId) { results.pharmacy = 'skipped: no doctor linked to patient'; continue }
          await db.prescription.create({
            data: { organizationId, patientId, doctorId: recent.doctorId, items: '[]', status: 'pending' },
          })
          results.pharmacy = 'created'
        } else {
          results[dept] = 'unknown department'
        }
      } catch (e) {
        results[dept] = `failed: ${e.message}`
      }
    }

    res.json({ success: true, data: results })
  } catch (err) { next(err) }
}
