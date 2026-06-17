// Phase 3B — auto-billing for COMPLETED orders (Procedure first).
//
// Reuses the EXISTING tariff engine (resolvePrice) and the EXISTING IpdCharge
// model/flow. Produces a charge byte-for-byte identical to the manual post-charge
// handler (same r2 rounding, frozen tax/lineTotal). Idempotent via the existing
// @@unique([organizationId, sourceModule, sourceRef]) — sourceModule='PROCEDURE',
// sourceRef=<clinicalOrderId>. No new tables, no Bill/Payment changes.
import { db } from '../config/db.js'
import { resolvePrice } from './tariffService.js'

const r2 = (n) => Math.round((n || 0) * 100) / 100

/**
 * Post a single ACTIVE IpdCharge for a completed PROCEDURE order, inside the
 * caller's transaction (tx). Idempotent. Returns { charge, deduped }.
 */
export async function billProcedureOrder(tx, organizationId, order, actor) {
  // Idempotency: a charge already exists for this order → return it, post nothing.
  const existing = await tx.ipdCharge.findFirst({ where: { organizationId, sourceModule: 'PROCEDURE', sourceRef: order.id } })
  if (existing) return { charge: existing, deduped: true }

  // Resolve the catalog code to price against (procedures are placed from ChargeMaster).
  let itemCode = order.itemCode
  if (!itemCode && order.catalogModel === 'ChargeMaster' && order.catalogItemId) {
    const cm = await db.chargeMaster.findFirst({ where: { id: order.catalogItemId, organizationId }, select: { code: true } })
    itemCode = cm?.code || null
  }
  if (!itemCode) throw Object.assign(new Error('Procedure order has no catalog item to price'), { status: 400, code: 'IPD_ORDER_NOT_PRICEABLE' })

  // EXISTING tariff engine — most-specific PROCEDURE rule wins.
  const priced = await resolvePrice(organizationId, order.admissionId, { itemCode, serviceGroup: 'PROCEDURE', serviceDate: new Date() })

  const qty = Number(order.quantity) || 1
  // Frozen tax from the charge master (mirrors manual post-charge).
  let taxPct = 0
  if (priced.chargeItem?.id) {
    const cm = await db.chargeMaster.findUnique({ where: { id: priced.chargeItem.id }, select: { taxRatePct: true } }).catch(() => null)
    taxPct = cm?.taxRatePct || 0
  }
  const gross = r2(priced.price * qty)
  const discountPct = 0
  const discountAmount = 0
  const taxable = r2(gross - discountAmount)
  const taxAmount = r2(taxable * taxPct / 100)

  const data = {
    organizationId,
    admissionId: order.admissionId,
    chargeItemId: priced.chargeItem?.id || null,
    description: order.itemName || priced.chargeItem?.name || itemCode,
    serviceGroup: priced.serviceGroup || 'PROCEDURE',
    unitPrice: priced.price,
    quantity: qty,
    taxPct,
    taxAmount,
    discountPct,
    discountAmount,
    lineTotal: r2(taxable + taxAmount),
    resolvedFrom: { planId: priced.plan?.id, bedCategoryId: priced.bedCategoryId, ruleId: priced.rule?.id, base: priced.base },
    status: 'ACTIVE',
    postedById: actor?.id || null,
    postedByName: actor?.name || null,
    serviceDate: new Date(),
    sourceModule: 'PROCEDURE',
    sourceRef: order.id,
  }

  // Idempotent insert (race-safe against the unique key).
  await tx.ipdCharge.createMany({ data: [data], skipDuplicates: true })
  const charge = await tx.ipdCharge.findFirst({ where: { organizationId, sourceModule: 'PROCEDURE', sourceRef: order.id } })
  return { charge, deduped: false }
}
