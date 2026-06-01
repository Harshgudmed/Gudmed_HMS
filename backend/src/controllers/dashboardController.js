import { db } from '../config/db.js'

export async function getDashboard(req, res, next) {
  try {
    const ORG_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const today = new Date()
    const todayStart = new Date(today)
    todayStart.setHours(0, 0, 0, 0)
    const todayEnd = new Date(today)
    todayEnd.setHours(23, 59, 59, 999)

    const [
      totalPatients,
      todayAppointments,
      pendingLabOrders,
      pendingPrescriptions,
      todayPayments,
      occupiedBeds,
      totalBeds,
      waitingQueue,
      criticalLabResults,
    ] = await Promise.all([
      db.patient.count({ where: { organizationId: ORG_ID, isActive: true } }),
      db.appointment.count({
        where: {
          organizationId: ORG_ID,
          appointmentDate: { gte: todayStart, lte: todayEnd },
        },
      }),
      db.labOrder.count({
        where: { organizationId: ORG_ID, status: { in: ['pending', 'sample_collected', 'in_progress'] } },
      }),
      db.prescription.count({ where: { organizationId: ORG_ID, status: 'pending' } }),
      db.payment.aggregate({
        where: {
          organizationId: ORG_ID,
          paymentDate: { gte: todayStart, lte: todayEnd },
          isRefund: false,
        },
        _sum: { amount: true },
      }),
      db.bed.count({ where: { organizationId: ORG_ID, status: 'occupied' } }),
      db.bed.count({ where: { organizationId: ORG_ID } }),
      db.queueManagement.count({
        where: {
          organizationId: ORG_ID,
          status: 'waiting',
          joinedQueueAt: { gte: todayStart, lte: todayEnd },
        },
      }),
      db.labResult.count({ where: { isCritical: true, verifiedAt: null } }),
    ])

    const appointmentStatusGroups = await db.appointment.groupBy({
      by: ['status'],
      where: { organizationId: ORG_ID, appointmentDate: { gte: todayStart, lte: todayEnd } },
      _count: true,
    })

    const queueServiceGroups = await db.queueManagement.groupBy({
      by: ['serviceArea'],
      where: {
        organizationId: ORG_ID,
        status: { in: ['waiting', 'called', 'in_service'] },
        joinedQueueAt: { gte: todayStart, lte: todayEnd },
      },
      _count: true,
    })

    const recentPatients = await db.patient.findMany({
      where: { organizationId: ORG_ID, isActive: true },
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: { id: true, mrn: true, firstName: true, lastName: true, gender: true, dateOfBirth: true, createdAt: true },
    })

    const upcomingAppointments = await db.appointment.findMany({
      where: {
        organizationId: ORG_ID,
        status: { in: ['scheduled', 'confirmed'] },
        appointmentDate: { gte: todayStart },
      },
      take: 10,
      orderBy: [{ appointmentDate: 'asc' }, { appointmentTime: 'asc' }],
      include: {
        patient: { select: { id: true, mrn: true, firstName: true, lastName: true } },
      },
    })

    const queue = await db.queueManagement.findMany({
      where: {
        organizationId: ORG_ID,
        status: { in: ['waiting', 'called', 'in_service'] },
        joinedQueueAt: { gte: todayStart, lte: todayEnd },
      },
      take: 20,
      orderBy: { queueNumber: 'asc' },
      include: {
        patient: { select: { id: true, firstName: true, lastName: true, mrn: true } },
      },
    })

    res.json({
      success: true,
      data: {
        stats: {
          totalPatients,
          todayAppointments,
          pendingLabOrders,
          pendingPrescriptions,
          todayRevenue: todayPayments._sum.amount || 0,
          occupiedBeds,
          availableBeds: totalBeds - occupiedBeds,
          queueWaiting: waitingQueue,
          criticalAlerts: criticalLabResults,
        },
        appointmentStatuses: appointmentStatusGroups.reduce((acc, item) => {
          acc[item.status] = item._count
          return acc
        }, {}),
        queueByService: queueServiceGroups.reduce((acc, item) => {
          acc[item.serviceArea] = item._count
          return acc
        }, {}),
        recentPatients,
        upcomingAppointments,
        queue,
      },
    })
  } catch (err) {
    next(err)
  }
}
