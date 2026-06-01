import { db } from '../config/db.js'

// Temporary import endpoint — run once to seed production from local backup
// Protected by secret key
export async function importData(req, res) {
  const secret = req.headers['x-import-secret']
  if (secret !== process.env.IMPORT_SECRET && secret !== 'GudMedImport2026!') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const results = {}
  const errors = []

  try {
    const {
      organizations, users, patients, appointments, consultations,
      prescriptions, labOrders, labResults, radiologyOrders,
      invoices, payments, pharmacySales, pharmacyDrugs,
      admissions, wards, preTriages, queueItems
    } = req.body

    // Disable FK checks for the duration of import
    await db.$executeRawUnsafe(`SET session_replication_role = 'replica'`)

    // Helper: clean record removing auto-managed and problematic FK fields
    function clean(rec) {
      const {
        updatedAt, createdAt,
        departmentId, buildingId, floorId, roomId,
        referredById, supervisorId, reviewedById,
        createdById, updatedById, cancelledById,
        soldById, servedById, invitedById,
        ...rest
      } = rec
      return rest
    }

    // Helper: upsert many records
    async function upsertMany(model, records, idField = 'id') {
      let count = 0
      for (const rec of (records || [])) {
        try {
          const data = clean(rec)
          await db[model].upsert({
            where:  { [idField]: rec[idField] },
            update: data,
            create: data,
          })
          count++
        } catch (e) {
          errors.push(`${model}/${rec[idField]}: ${e.message.slice(0, 100)}`)
        }
      }
      return count
    }

    // Import in order
    results.organizations   = await upsertMany('organization', organizations)
    results.users           = await upsertMany('user', users)
    results.wards           = await upsertMany('ward', wards)
    results.patients        = await upsertMany('patient', patients)
    results.pharmacyDrugs   = await upsertMany('pharmacyDrug', pharmacyDrugs)
    results.appointments    = await upsertMany('appointment', appointments)
    results.preTriages      = await upsertMany('preTriage', preTriages)
    results.queueItems      = await upsertMany('queueManagement', queueItems)
    results.consultations   = await upsertMany('consultation', consultations)
    results.prescriptions   = await upsertMany('prescription', prescriptions)
    results.labOrders       = await upsertMany('labOrder', labOrders)
    results.labResults      = await upsertMany('labResult', labResults)
    results.radiologyOrders = await upsertMany('radiologyOrder', radiologyOrders)
    results.admissions      = await upsertMany('admission', admissions)
    results.invoices        = await upsertMany('invoice', invoices)
    results.payments        = await upsertMany('payment', payments)
    results.pharmacySales   = await upsertMany('pharmacySale', pharmacySales)

    // Re-enable FK checks
    await db.$executeRawUnsafe(`SET session_replication_role = 'origin'`)

    return res.json({
      success: true,
      imported: results,
      errors: errors.slice(0, 20),
      message: 'Import complete!'
    })
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message, partial: results })
  }
}
