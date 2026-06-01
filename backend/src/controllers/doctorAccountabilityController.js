import { db } from '../config/db.js'

export async function handleGet(req, res, next) {
  try {
    const ORG_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { resource, doctorId, status, period } = req.query

    if (resource === 'doctors') {
      const doctors = await db.user.findMany({
        where: { organizationId: ORG_ID, role: 'doctor', isActive: true },
        include: {
          department: { select: { id: true, name: true } },
          commissionConfig: true,
        },
        orderBy: { fullName: 'asc' },
      })
      return res.json({ success: true, data: doctors })
    }

    if (resource === 'commissions') {
      const where = {}
      if (doctorId) where.doctorId = doctorId
      if (status) where.status = status
      if (period) where.period = period
      const commissions = await db.doctorCommission.findMany({
        where,
        include: {
          doctor: { select: { id: true, fullName: true } },
          settledBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
      return res.json({ success: true, data: commissions })
    }

    if (resource === 'stats') {
      const doctors = await db.user.findMany({
        where: { organizationId: ORG_ID, role: 'doctor' }, // ORG_ID set at function start
        include: {
          commissionConfig: true,
          commissions: true,
        },
      })
      const stats = doctors.map(d => {
        const commissions = d.commissions || []
        const pending = commissions.filter(c => c.status === 'pending')
        const settled = commissions.filter(c => c.status === 'settled')
        return {
          doctorId: d.id,
          doctorName: d.fullName,
          commissionRate: d.commissionConfig?.commissionRate || 0,
          commissionType: d.commissionConfig?.commissionType || 'percentage',
          isActive: d.commissionConfig?.isActive || false,
          totalCommissions: commissions.length,
          pendingCount: pending.length,
          settledCount: settled.length,
          pendingAmount: pending.reduce((s, c) => s + (c.commissionAmount || 0), 0),
          settledAmount: settled.reduce((s, c) => s + (c.commissionAmount || 0), 0),
          totalInvoiceAmount: commissions.reduce((s, c) => s + (c.invoiceAmount || 0), 0),
        }
      })
      return res.json({ success: true, data: stats })
    }

    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}

export async function handlePost(req, res, next) {
  try {
    const ORG_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { resource } = req.query

    if (resource === 'config') {
      const { doctorId, commissionType, commissionRate, isActive, notes } = req.body
      const existing = await db.doctorCommissionConfig.findUnique({ where: { doctorId } })
      let config
      if (existing) {
        config = await db.doctorCommissionConfig.update({
          where: { doctorId },
          data: { commissionType, commissionRate: parseFloat(commissionRate) || 0, isActive, notes: notes || null },
        })
      } else {
        config = await db.doctorCommissionConfig.create({
          data: { organizationId: ORG_ID, doctorId, commissionType, commissionRate: parseFloat(commissionRate) || 0, isActive, notes: notes || null },
        })
      }
      return res.json({ success: true, data: config })
    }

    if (resource === 'commission') {
      const { doctorId, invoiceId, invoiceAmount, commissionRate, commissionType, commissionAmount, period } = req.body
      const commission = await db.doctorCommission.create({
        data: {
          organizationId: ORG_ID,
          doctorId,
          invoiceId: invoiceId || null,
          invoiceAmount: parseFloat(invoiceAmount) || 0,
          commissionRate: parseFloat(commissionRate) || 0,
          commissionType,
          commissionAmount: parseFloat(commissionAmount) || 0,
          period: period || null,
          status: 'pending',
        },
        include: {
          doctor: { select: { id: true, fullName: true } },
        },
      })
      return res.json({ success: true, data: commission })
    }

    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}

export async function handlePatch(req, res, next) {
  try {
    const { resource } = req.query

    if (resource === 'settle') {
      const { commissionIds, settlementNote, settlementRef } = req.body
      await db.doctorCommission.updateMany({
        where: { id: { in: commissionIds }, status: 'pending' },
        data: {
          status: 'settled',
          settledAt: new Date(),
          settlementNote: settlementNote || null,
          settlementRef: settlementRef || null,
        },
      })
      return res.json({ success: true, message: `${commissionIds.length} commission(s) settled successfully` })
    }

    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}

export async function handleDelete(req, res, next) {
  try {
    const { resource, id } = req.query
    if (resource === 'commission') {
      await db.doctorCommission.delete({ where: { id } })
      return res.json({ success: true })
    }
    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}
