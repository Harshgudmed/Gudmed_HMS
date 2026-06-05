import { z } from 'zod'

export const createAppointmentSchema = z.object({
  patientId: z.string(),
  doctorId: z.string().optional(),
  appointmentDate: z.string(),
  appointmentTime: z.string(),
  durationMinutes: z.number().default(30),
  appointmentType: z.string().optional(),
  notes: z.string().optional(),
  departmentId: z.string().optional(),
  priority: z.string().optional(),
})
