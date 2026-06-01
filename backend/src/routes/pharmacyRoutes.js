import { Router } from 'express'
import * as drugCtrl         from '../pharmacy/controllers/drug.controller.js'
import * as batchCtrl        from '../pharmacy/controllers/batch.controller.js'
import * as saleCtrl         from '../pharmacy/controllers/sale.controller.js'
import * as prescriptionCtrl from '../pharmacy/controllers/prescription.controller.js'
import * as purchaseOrderCtrl from '../pharmacy/controllers/purchaseOrder.controller.js'
import * as statsCtrl        from '../pharmacy/controllers/stats.controller.js'

const router = Router()

// ── Drugs ──────────────────────────────────────────────────────────────────────
router.get('/drugs',      drugCtrl.list)
router.get('/drugs/:id',  drugCtrl.getById)
router.post('/drugs',     drugCtrl.create)
router.patch('/drugs/:id', drugCtrl.update)
router.delete('/drugs/:id', drugCtrl.remove)

// ── Batches ────────────────────────────────────────────────────────────────────
router.get('/batches',      batchCtrl.list)
router.get('/batches/:id',  batchCtrl.getById)
router.post('/batches',     batchCtrl.create)
router.patch('/batches/:id', batchCtrl.update)
router.delete('/batches/:id', batchCtrl.remove)

// ── Sales ──────────────────────────────────────────────────────────────────────
router.get('/sales',     saleCtrl.list)
router.get('/sales/:id', saleCtrl.getById)
router.post('/sales',    saleCtrl.create)

// ── Prescriptions ──────────────────────────────────────────────────────────────
router.get('/prescriptions',      prescriptionCtrl.list)
router.get('/prescriptions/:id',  prescriptionCtrl.getById)
router.post('/prescriptions',     prescriptionCtrl.create)
router.patch('/prescriptions/:id', prescriptionCtrl.update)

// ── Purchase Orders ────────────────────────────────────────────────────────────
router.get('/purchase-orders',              purchaseOrderCtrl.list)
router.get('/purchase-orders/:id',          purchaseOrderCtrl.getById)
router.post('/purchase-orders',             purchaseOrderCtrl.create)
router.patch('/purchase-orders/:id',        purchaseOrderCtrl.update)
router.patch('/purchase-orders/:id/receive', purchaseOrderCtrl.receive)

// ── Stats ──────────────────────────────────────────────────────────────────────
router.get('/stats', statsCtrl.getStats)

export default router
