import { db } from '../config/db.js'

export async function getAnalytics(req, res, next) {
  try {
    const ORG_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { resource, dateFrom, dateTo } = req.query

    if (resource === 'dashboard') {
      // Real-time hospital metrics
      const [
        totalBeds,
        wards,
        activeAdmissions,
        dischargedToday,
        criticalPatients,
        pendingDischarges,
        totalPatients,
        labOrders,
        radiologyOrders,
        consultations,
      ] = await Promise.all([
        db.bed.count({ where: { organizationId: ORG_ID } }),
        db.ward.findMany({
          where: { organizationId: ORG_ID, isActive: true },
          include: { beds: true }
        }),
        db.admission.count({
          where: { organizationId: ORG_ID, status: 'admitted' }
        }),
        db.admission.count({
          where: {
            organizationId: ORG_ID,
            status: 'discharged',
            createdAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lte: new Date(new Date().setHours(23, 59, 59, 999))
            }
          }
        }),
        db.admission.count({
          where: { organizationId: ORG_ID, status: 'admitted', isCritical: true }
        }),
        db.admission.findMany({
          where: { organizationId: ORG_ID, status: 'admitted' },
          select: { admissionDate: true, expectedLengthOfStay: true }
        }),
        db.patient.count({ where: { organizationId: ORG_ID } }),
        db.labOrder.count({ where: { organizationId: ORG_ID } }),
        db.radiologyOrder.count({ where: { organizationId: ORG_ID } }),
        db.consultation.count({ where: { organizationId: ORG_ID } }),
      ])

      // Calculate occupancy
      let occupiedBeds = 0
      wards.forEach(ward => {
        occupiedBeds += ward.beds.filter(b => b.status === 'occupied').length
      })

      const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0

      // Admissions overdue for discharge: admissionDate + expectedLengthOfStay (days) has passed.
      const nowMs = Date.now()
      const pendingDischargeCount = pendingDischarges.filter(a =>
        a.admissionDate && a.expectedLengthOfStay
          ? new Date(a.admissionDate).getTime() + a.expectedLengthOfStay * 86400000 <= nowMs
          : false
      ).length

      return res.json({
        success: true,
        data: {
          beds: { total: totalBeds, occupied: occupiedBeds, available: totalBeds - occupiedBeds, occupancyRate },
          admissions: { active: activeAdmissions, critical: criticalPatients, dischargedToday, pendingDischarge: pendingDischargeCount },
          patients: { total: totalPatients },
          orders: { labOrders, radiologyOrders },
          consultations,
          wards: wards.length,
        }
      })
    }

    if (resource === 'ward-occupancy') {
      // Ward-wise occupancy details
      const wards = await db.ward.findMany({
        where: { organizationId: ORG_ID, isActive: true },
        include: {
          beds: true,
          _count: { select: { beds: true } }
        }
      })

      const wardOccupancy = wards.map(ward => {
        const occupiedBeds = ward.beds.filter(b => b.status === 'occupied').length
        const capacity = ward.capacity || ward._count.beds
        return {
          wardId: ward.id,
          wardName: ward.name,
          wardType: ward.type,
          capacity,
          occupied: occupiedBeds,
          available: capacity - occupiedBeds,
          occupancyRate: capacity > 0 ? Math.round((occupiedBeds / capacity) * 100) : 0,
        }
      })

      return res.json({ success: true, data: wardOccupancy })
    }

    if (resource === 'admission-stats') {
      // Admission statistics
      const admissions = await db.admission.findMany({
        where: { organizationId: ORG_ID },
        include: { patient: true }
      })

      const today = new Date()
      const thisMonth = admissions.filter(a => {
        const d = new Date(a.admissionDate)
        return d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear()
      })

      const dischargedAdmissions = admissions.filter(a => a.status === 'discharged')
      const avgStay = dischargedAdmissions.length > 0
        ? dischargedAdmissions
            .map(a => {
              const discharge = a.dischargeDate ? new Date(a.dischargeDate) : new Date()
              const admission = new Date(a.admissionDate)
              return (discharge - admission) / (1000 * 60 * 60 * 24) // ms to days
            })
            .reduce((a, b) => a + b, 0) / dischargedAdmissions.length
        : 0

      const admissionsByType = {}
      admissions.forEach(a => {
        const type = a.admissionType || 'Unknown'
        admissionsByType[type] = (admissionsByType[type] || 0) + 1
      })

      return res.json({
        success: true,
        data: {
          totalAdmissions: admissions.length,
          thisMonth: thisMonth.length,
          activeAdmissions: admissions.filter(a => a.status === 'admitted').length,
          discharged: admissions.filter(a => a.status === 'discharged').length,
          avgLengthOfStay: parseFloat(avgStay.toFixed(1)),
          admissionsByType,
        }
      })
    }

    if (resource === 'consultation-stats') {
      // Consultation and doctor performance
      const consultations = await db.consultation.findMany({
        where: { organizationId: ORG_ID },
        include: { doctor: true, patient: true }
      })

      const doctorStats = {}
      consultations.forEach(c => {
        const docName = c.doctor?.fullName || 'Unknown'
        if (!doctorStats[docName]) {
          doctorStats[docName] = { consultations: 0, avgTemp: 0, totalTemp: 0, patients: new Set() }
        }
        doctorStats[docName].consultations += 1
        doctorStats[docName].totalTemp += c.temperature || 0
        doctorStats[docName].patients.add(c.patientId)
      })

      const formattedDoctorStats = Object.entries(doctorStats).map(([doctor, stats]) => ({
        doctor,
        consultations: stats.consultations,
        uniquePatients: stats.patients.size,
        avgTemperature: stats.totalTemp > 0 ? (stats.totalTemp / stats.consultations).toFixed(1) : 'N/A'
      }))

      return res.json({
        success: true,
        data: {
          totalConsultations: consultations.length,
          uniquePatients: new Set(consultations.map(c => c.patientId)).size,
          doctorStats: formattedDoctorStats.slice(0, 10),
        }
      })
    }

    if (resource === 'laboratory-stats') {
      // Lab order statistics
      const orders = await db.labOrder.findMany({
        where: { organizationId: ORG_ID }
      })

      const statusCount = {}
      orders.forEach(o => {
        const status = o.status || 'unknown'
        statusCount[status] = (statusCount[status] || 0) + 1
      })

      return res.json({
        success: true,
        data: {
          totalOrders: orders.length,
          pending: statusCount['pending'] || 0,
          completed: statusCount['completed'] || 0,
          inProgress: statusCount['in_progress'] || 0,
          statusBreakdown: statusCount,
        }
      })
    }

    if (resource === 'radiology-stats') {
      // Radiology order statistics
      const orders = await db.radiologyOrder.findMany({
        where: { organizationId: ORG_ID }
      })

      const statusCount = {}
      const modalityCount = {}
      orders.forEach(o => {
        const status = o.status || 'unknown'
        statusCount[status] = (statusCount[status] || 0) + 1
      })

      return res.json({
        success: true,
        data: {
          totalOrders: orders.length,
          pending: statusCount['pending'] || 0,
          completed: statusCount['completed'] || 0,
          reported: statusCount['reported'] || 0,
          statusBreakdown: statusCount,
        }
      })
    }

    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}
