import { Router } from 'express'
import { getAll, create, update } from '../controllers/laboratoryController.js'
import { db } from '../config/db.js'

const router = Router()

router.get('/health', async (_req, res) => {
  try {
    await Promise.all([
      db.labTest.count(),
      db.labOrder.count(),
      db.labResult.count(),
    ])
    res.json({ success: true, message: 'Laboratory tables OK' })
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
      code: err.code,
      hint: 'Run: cd backend && npx prisma generate && npx prisma db push',
    })
  }
})

router.get('/', getAll)
router.post('/', create)
router.patch('/', update)

export default router
