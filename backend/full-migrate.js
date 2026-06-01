#!/usr/bin/env node
/**
 * Full local → production migration.
 * Copies every table in correct FK dependency order.
 *
 * Strategy: copy ALL users/patients first, so the many user/patient
 * references on downstream tables resolve naturally. For parent links
 * that may genuinely be absent, skip the child (required parent) or
 * null the field (optional parent). Only verified column names are touched.
 */
import { PrismaClient } from '@prisma/client'

const LOCAL_URL = 'postgresql://postgres:password@localhost:5432/hospital_db'
const PROD_URL  = 'postgresql://gudmed_db_user:kMvSoIdDuYHhIUWgwDp6szWiJheMw68Q@dpg-d8emi4ek1jcs73a4sidg-a.singapore-postgres.render.com:5432/gudmed_db?sslmode=require'

const local = new PrismaClient({ datasources: { db: { url: LOCAL_URL } } })
const prod  = new PrismaClient({ datasources: { db: { url: PROD_URL  } } })

const log = (...a) => console.log(...a)

async function copy(model, { fix } = {}) {
  let rows = []
  try { rows = await local[model].findMany() }
  catch (e) { log(`  ⏭️  ${model}: skipped (${e.message.slice(0, 60)})`); return }

  let ok = 0, fail = 0, skip = 0
  for (const row of rows) {
    const data = fix ? fix({ ...row }) : { ...row }
    if (data === null) { skip++; continue }
    try {
      await prod[model].upsert({ where: { id: row.id }, update: data, create: data })
      ok++
    } catch (e) {
      fail++
      if (fail <= 3) log(`     ⚠️  ${model}/${row.id}: ${e.message.split('\n').pop().slice(0, 90)}`)
    }
  }
  log(`  ✓ ${model}: ${ok} ok${fail ? `, ${fail} failed` : ''}${skip ? `, ${skip} skipped` : ''} (of ${rows.length})`)
}

async function prodIds(model) {
  const rows = await prod[model].findMany({ select: { id: true } })
  return new Set(rows.map(r => r.id))
}

async function main() {
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('FULL MIGRATION: local → production')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n')

  // Stage 1 — core (order: org → department → user → patient)
  log('Stage 1 — core')
  await copy('organization')
  await copy('department', { fix: r => { r.headId = null; return r } })       // headId → user (not yet)
  const deptIds = await prodIds('department')
  await copy('user', { fix: r => {
    if (r.departmentId && !deptIds.has(r.departmentId)) r.departmentId = null
    r.invitedById = null                                                       // self-ref
    return r
  }})
  await copy('patient')
  const patientIds = await prodIds('patient')

  // Stage 2 — inpatient: ward → bed → admission
  log('\nStage 2 — inpatient')
  await copy('ward', { fix: r => {
    if (r.departmentId && !deptIds.has(r.departmentId)) r.departmentId = null
    return r
  }})
  const wardIds = await prodIds('ward')
  await copy('bed', { fix: r => {
    if (!wardIds.has(r.wardId)) return null
    if (r.currentPatientId && !patientIds.has(r.currentPatientId)) r.currentPatientId = null
    return r
  }})
  const bedIds = await prodIds('bed')
  await copy('admission', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.bedId && !bedIds.has(r.bedId)) r.bedId = null
    return r
  }})

  // Stage 3 — clinical: appointment → consultation → triage/queue
  log('\nStage 3 — clinical')
  await copy('appointment', { fix: r => patientIds.has(r.patientId) ? r : null })
  const apptIds = await prodIds('appointment')
  await copy('consultation', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.appointmentId && !apptIds.has(r.appointmentId)) r.appointmentId = null
    return r
  }})
  const consultIds = await prodIds('consultation')
  await copy('preTriage', { fix: r => {
    if (r.patientId && !patientIds.has(r.patientId)) r.patientId = null
    return r
  }})
  await copy('triageAssessment', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.appointmentId && !apptIds.has(r.appointmentId)) r.appointmentId = null
    return r
  }})
  await copy('queueManagement', { fix: r => {
    if (r.patientId && !patientIds.has(r.patientId)) r.patientId = null
    return r
  }})

  // Stage 4 — pharmacy
  log('\nStage 4 — pharmacy')
  await copy('pharmacyDrug')
  await copy('prescription', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.consultationId && !consultIds.has(r.consultationId)) r.consultationId = null
    return r
  }})
  const prescriptionIds = await prodIds('prescription')
  await copy('pharmacySale', { fix: r => {
    if (r.patientId && !patientIds.has(r.patientId)) r.patientId = null
    if (r.prescriptionId && !prescriptionIds.has(r.prescriptionId)) r.prescriptionId = null
    return r
  }})

  // Stage 5 — lab & radiology
  log('\nStage 5 — lab & radiology')
  await copy('labOrder', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.consultationId && !consultIds.has(r.consultationId)) r.consultationId = null
    return r
  }})
  const labOrderIds = await prodIds('labOrder')
  await copy('labResult', { fix: r => labOrderIds.has(r.orderId) ? r : null })
  await copy('radiologyOrder', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.consultationId && !consultIds.has(r.consultationId)) r.consultationId = null
    return r
  }})
  const radOrderIds = await prodIds('radiologyOrder')
  await copy('radiologyReport', { fix: r => radOrderIds.has(r.orderId) ? r : null })

  // Stage 6 — billing
  log('\nStage 6 — billing')
  await copy('invoice', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.consultationId && !consultIds.has(r.consultationId)) r.consultationId = null
    return r
  }})
  const invoiceIds = await prodIds('invoice')
  await copy('payment', { fix: r => {
    if (!invoiceIds.has(r.invoiceId)) return null
    if (r.patientId && !patientIds.has(r.patientId)) r.patientId = null
    return r
  }})

  // Stage 7 — records & commissions
  log('\nStage 7 — records')
  const userIds = await prodIds('user')
  await copy('deathCertificate', { fix: r => {
    if (!patientIds.has(r.patientId)) return null
    if (r.certifiedById && !userIds.has(r.certifiedById)) r.certifiedById = null
    if (r.issuedById && !userIds.has(r.issuedById)) r.issuedById = null
    return r
  }})
  await copy('doctorCommissionConfig', { fix: r => userIds.has(r.doctorId) ? r : null })
  await copy('doctorCommission', { fix: r => {
    if (!userIds.has(r.doctorId)) return null
    if (r.invoiceId && !invoiceIds.has(r.invoiceId)) r.invoiceId = null
    return r
  }})

  log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('✅ MIGRATION COMPLETE')
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  log('\nVerify at: https://gudmed.vercel.app\n')
}

main()
  .catch(e => { console.error('FATAL:', e.message); process.exit(1) })
  .finally(async () => { await local.$disconnect(); await prod.$disconnect() })
