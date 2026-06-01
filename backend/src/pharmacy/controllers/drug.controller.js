import { db } from '../../config/db.js'
import { createDrugSchema, updateDrugSchema } from '../validations/drug.validation.js'
import { getPagination, paginationMeta, handleServiceError, makeError } from '../utils.js'

const SORTABLE_FIELDS = ['drugName', 'drugCategory', 'quantityInStock', 'sellingPrice', 'reorderLevel', 'createdAt']

export async function list(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const { search, category, sortBy, sortOrder } = req.query
    const { page, limit, skip } = getPagination(req.query)

    const where = { organizationId: ORGANIZATION_ID, isActive: true }
    if (category) where.drugCategory = category
    if (search) {
      where.OR = [
        { drugName: { contains: search, mode: 'insensitive' } },
        { genericName: { contains: search, mode: 'insensitive' } },
        { brandName: { contains: search, mode: 'insensitive' } },
        { drugCode: { contains: search, mode: 'insensitive' } },
      ]
    }

    const orderBy = SORTABLE_FIELDS.includes(sortBy)
      ? { [sortBy]: sortOrder === 'asc' ? 'asc' : 'desc' }
      : { drugName: 'asc' }

    const [data, total] = await Promise.all([
      db.pharmacyDrug.findMany({
        where,
        include: {
          batches: {
            where: { status: 'active' },
            orderBy: { expiryDate: 'asc' },
            take: 1,
          },
        },
        orderBy,
        skip,
        take: limit,
      }),
      db.pharmacyDrug.count({ where }),
    ])

    res.json({ success: true, data, pagination: paginationMeta(page, limit, total) })
  } catch (err) {
    next(err)
  }
}

export async function getById(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const drug = await db.pharmacyDrug.findFirst({
      where: { id: req.params.id, organizationId: ORGANIZATION_ID },
      include: { batches: { orderBy: { expiryDate: 'asc' } } },
    })
    if (!drug) throw makeError('Drug not found', 404, 'DRUG_NOT_FOUND')
    res.json({ success: true, data: drug })
  } catch (err) {
    if (handleServiceError(res, err)) return
    next(err)
  }
}

export async function create(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const parsed = createDrugSchema.parse(req.body)
    const data = await db.pharmacyDrug.create({
      data: { ...parsed, organizationId: ORGANIZATION_ID, isActive: true },
    })
    res.status(201).json({ success: true, data, message: 'Drug created successfully' })
  } catch (err) {
    next(err)
  }
}

export async function update(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const parsed = updateDrugSchema.parse(req.body)

    const existing = await db.pharmacyDrug.findFirst({
      where: { id: req.params.id, organizationId: ORGANIZATION_ID },
    })
    if (!existing) throw makeError('Drug not found', 404, 'DRUG_NOT_FOUND')

    const data = await db.pharmacyDrug.update({ where: { id: req.params.id }, data: parsed })
    res.json({ success: true, data, message: 'Drug updated successfully' })
  } catch (err) {
    if (handleServiceError(res, err)) return
    next(err)
  }
}

export async function remove(req, res, next) {
  try {
    const ORGANIZATION_ID = req.organizationId || process.env.ORGANIZATION_ID || 'org-demo'
    const existing = await db.pharmacyDrug.findFirst({
      where: { id: req.params.id, organizationId: ORGANIZATION_ID },
    })
    if (!existing) throw makeError('Drug not found', 404, 'DRUG_NOT_FOUND')

    const data = await db.pharmacyDrug.update({
      where: { id: req.params.id },
      data: { isActive: false },
    })
    res.json({ success: true, data, message: 'Drug deactivated successfully' })
  } catch (err) {
    if (handleServiceError(res, err)) return
    next(err)
  }
}
