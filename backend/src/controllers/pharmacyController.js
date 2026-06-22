import { db } from '../config/db.js'
import { getOrgId } from "../lib/reqContext.js";

export async function getAll(req, res, next) {
  try {
    const ORG_ID = getOrgId(req)
    const { resource } = req.query

    let limit = parseInt(req.query.limit) || 10
    let offset = parseInt(req.query.offset) || 0
    limit = Math.max(1, Math.min(limit, 1000))
    offset = Math.max(0, offset)

    if (resource === 'drugs') {
      const [drugs, total] = await Promise.all([
        db.pharmacyDrug.findMany({
          where: { organizationId: ORG_ID, isActive: true },
          orderBy: { drugName: 'asc' },
          take: limit,
          skip: offset,
        }),
        db.pharmacyDrug.count({ where: { organizationId: ORG_ID, isActive: true } })
      ])

      const hasMore = (offset + limit) < total
      return res.json({
        success: true,
        data: drugs,
        meta: { total, limit, offset, page: Math.floor(offset / limit) + 1, totalPages: Math.ceil(total / limit), hasMore }
      })
    }

    if (resource === 'prescriptions') {
      const [prescriptions, total] = await Promise.all([
        db.prescription.findMany({
          where: { organizationId: ORG_ID },
          include: { patient: { select: { id: true, mrn: true, firstName: true, lastName: true } }, doctor: { select: { id: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.prescription.count({ where: { organizationId: ORG_ID } })
      ])

      const hasMore = (offset + limit) < total
      return res.json({
        success: true,
        data: prescriptions,
        meta: { total, limit, offset, page: Math.floor(offset / limit) + 1, totalPages: Math.ceil(total / limit), hasMore }
      })
    }

    if (resource === 'sales') {
      const { dateFilter } = req.query
      const today = new Date()
      let dateRange = { gte: new Date(today.setHours(0, 0, 0, 0)), lte: new Date() }

      if (dateFilter === 'week') {
        const weekAgo = new Date()
        weekAgo.setDate(weekAgo.getDate() - 7)
        dateRange = { gte: weekAgo, lte: new Date() }
      } else if (dateFilter === 'month') {
        const monthAgo = new Date()
        monthAgo.setMonth(monthAgo.getMonth() - 1)
        dateRange = { gte: monthAgo, lte: new Date() }
      } else if (dateFilter === 'year') {
        const yearAgo = new Date()
        yearAgo.setFullYear(yearAgo.getFullYear() - 1)
        dateRange = { gte: yearAgo, lte: new Date() }
      }

      const [sales, total] = await Promise.all([
        db.pharmacySale.findMany({
          where: { organizationId: ORG_ID, createdAt: dateRange },
          include: { drug: true, patient: { select: { id: true, mrn: true, firstName: true, lastName: true } } },
          orderBy: { createdAt: 'desc' },
          take: limit,
          skip: offset,
        }),
        db.pharmacySale.count({ where: { organizationId: ORG_ID, createdAt: dateRange } })
      ])

      const hasMore = (offset + limit) < total
      const totalSalesValue = sales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)

      return res.json({
        success: true,
        data: sales,
        meta: { total, limit, offset, page: Math.floor(offset / limit) + 1, totalPages: Math.ceil(total / limit), hasMore, totalSalesValue }
      })
    }

    if (resource === 'inventory') {
      const drugs = await db.pharmacyDrug.findMany({
        where: { organizationId: ORG_ID, isActive: true }
      })

      const inventory = drugs.map(drug => ({
        drugId: drug.id,
        drugName: drug.drugName,
        genericName: drug.genericName,
        quantity: drug.quantity || 0,
        unit: drug.unitOfMeasure,
        price: drug.sellingPrice,
        stockValue: (drug.quantity || 0) * (drug.sellingPrice || 0),
      }))

      const totalStockValue = inventory.reduce((sum, item) => sum + item.stockValue, 0)
      const lowStockItems = inventory.filter(item => item.quantity <= 10)

      return res.json({
        success: true,
        data: inventory,
        summary: {
          totalDrugs: inventory.length,
          totalQuantity: inventory.reduce((sum, item) => sum + item.quantity, 0),
          totalStockValue,
          lowStockItems: lowStockItems.length
        }
      })
    }

    if (resource === 'stats') {
      const today = new Date()
      const todaySales = await db.pharmacySale.findMany({
        where: { organizationId: ORG_ID, createdAt: { gte: new Date(today.setHours(0, 0, 0, 0)) } }
      })

      const totalDrugs = await db.pharmacyDrug.count({ where: { organizationId: ORG_ID, isActive: true } })
      const totalPrescriptions = await db.prescription.count({ where: { organizationId: ORG_ID } })

      const drugs = await db.pharmacyDrug.findMany({ where: { organizationId: ORG_ID, isActive: true } })
      const totalStockValue = drugs.reduce((sum, d) => sum + ((d.quantity || 0) * (d.sellingPrice || 0)), 0)

      const todayRevenue = todaySales.reduce((sum, s) => sum + (s.totalAmount || 0), 0)

      return res.json({
        success: true,
        data: {
          totalDrugs,
          totalPrescriptions,
          todaysSales: todaySales.length,
          todaysRevenue: todayRevenue,
          totalStockValue,
          lowStockDrugs: drugs.filter(d => (d.quantity || 0) <= 10).length
        }
      })
    }

    res.status(400).json({ success: false, error: 'Unknown resource' })
  } catch (err) {
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const ORG_ID = getOrgId(req)
    const { resource } = req.body

    if (resource === 'sale') {
      const { drugId, patientId, quantity, pricePerUnit, totalAmount, notes } = req.body

      const sale = await db.pharmacySale.create({
        data: {
          organizationId: ORG_ID,
          drugId,
          patientId,
          quantity: parseInt(quantity),
          pricePerUnit: parseFloat(pricePerUnit),
          totalAmount: parseFloat(totalAmount),
          notes,
        },
        include: { drug: true, patient: true }
      })

      // Update drug quantity
      await db.pharmacyDrug.update({
        where: { id: drugId },
        data: { quantity: { decrement: parseInt(quantity) } }
      })

      return res.json({ success: true, data: sale, message: 'Sale recorded' })
    }

    res.status(400).json({ success: false, error: 'Invalid resource' })
  } catch (err) {
    next(err)
  }
}
