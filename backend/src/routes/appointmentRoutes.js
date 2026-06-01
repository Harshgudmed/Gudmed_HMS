import { Router } from 'express'
import { getAll, getOne, create, update, remove } from '../controllers/appointmentController.js'
import { validate } from '../middleware/validate.js'
import { createAppointmentSchema } from '../validations/appointment.validation.js'

const router = Router()

router.get('/', getAll)
router.get('/:id', getOne)
router.post('/', validate(createAppointmentSchema), create)
router.patch('/:id', update)
router.delete('/:id', remove)

export default router
