#!/usr/bin/env node
/**
 * Seed the RadiologyExam catalog into the LOCAL database, then push with
 * `node upload-to-prod.js`. Idempotent: deterministic ids (radexam-NNNN).
 */
import { db } from './src/config/db.js'
import { RADIOLOGY_EXAMS } from './radiology-data.js'

const ORG = 'org-demo'
const pad = (n, l = 4) => String(n).padStart(l, '0')

// modality + category from the exam name
function classify(name) {
  const n = name.toLowerCase()
  if (/mammogra|sonomammog/.test(n))         return { modality: 'MG',  category: 'Mammography' }
  if (/\bpet\b|spect|dmsa|dtpa|hida|bone scan|nuclear|positron/.test(n)) return { modality: 'NM', category: 'Nuclear Medicine' }
  if (/dexa|bone densit|bone density/.test(n)) return { modality: 'DEXA', category: 'Bone Densitometry' }
  if (/doppler|echocardiog|2d echo|\becho\b/.test(n)) return { modality: 'US', category: 'Doppler / Echo' }
  if (/\busg\b|ultrasound|sonograph|sonography|\btvs\b/.test(n)) return { modality: 'US', category: 'Ultrasound' }
  if (/\bmri\b|mr angio|mrcp|\bmrv\b|magnetic resonance/.test(n)) return { modality: 'MRI', category: 'MRI' }
  if (/\bct\b|hrct|ncct|cect|tomography|angiograph|urogram|pyelogram/.test(n)) return { modality: 'CT', category: 'CT Scan' }
  if (/x-ray|x ray|xray/.test(n))            return { modality: 'DR',  category: 'X-Ray' }
  if (/barium|swallow|enteroclysis|hsg|hysterosalp|cysto|sinogram|cholangiogram/.test(n)) return { modality: 'FL', category: 'Fluoroscopy' }
  if (/ecg|electrocardiogram|nerve conduction|emg|spirometry|pulmonary function|electrophysiology/.test(n)) return { modality: 'OT', category: 'Other Diagnostics' }
  return { modality: 'OT', category: 'Other Imaging' }
}

function bodyPart(name) {
  const n = name.toLowerCase()
  const parts = ['brain','head','skull','chest','thorax','abdomen','pelvis','spine','cervical','lumbar','dorsal','knee','ankle','foot','hand','wrist','elbow','shoulder','hip','femur','tibia','arm','forearm','neck','breast','heel','thyroid','prostate','scrotum','kub','orbit','sinus','pns']
  return parts.find(p => n.includes(p)) || null
}

const PRICE = {
  'X-Ray': 400, 'CT Scan': 3500, 'MRI': 7000, 'Ultrasound': 900, 'Doppler / Echo': 1500,
  'Mammography': 1800, 'Nuclear Medicine': 9000, 'Bone Densitometry': 2000,
  'Fluoroscopy': 2500, 'Other Diagnostics': 800, 'Other Imaging': 1000,
}

async function main() {
  console.log(`Seeding ${RADIOLOGY_EXAMS.length} radiology exams into local DB...`)
  let ok = 0, fail = 0
  const seen = new Set()
  for (let i = 0; i < RADIOLOGY_EXAMS.length; i++) {
    const examName = RADIOLOGY_EXAMS[i].trim()
    if (!examName || seen.has(examName.toLowerCase())) continue
    seen.add(examName.toLowerCase())
    const id = `radexam-${pad(i + 1)}`
    const { modality, category } = classify(examName)
    const data = {
      organizationId: ORG, examName,
      examCode: examName.replace(/[^A-Za-z0-9]/g, '').slice(0, 8).toUpperCase(),
      examCategory: category, modality, bodyPart: bodyPart(examName),
      price: PRICE[category] || 1000,
      contrastRequired: /contrast|cect|cemri|ce mri|angiog/i.test(examName),
      isActive: true, updatedAt: new Date(),
    }
    try {
      await db.radiologyExam.upsert({ where: { id }, update: data, create: { id, ...data } })
      ok++
    } catch (e) {
      fail++
      if (fail <= 3) console.log(`  ${id}: ${e.message.slice(0, 80)}`)
    }
  }
  console.log(`✅ Radiology exams: ${ok} seeded${fail ? `, ${fail} failed` : ''}`)
  const total = await db.radiologyExam.count({ where: { organizationId: ORG } })
  console.log(`   Total radiology exams in catalog now: ${total}`)
}

main().catch(e => { console.error('FATAL:', e.message); process.exit(1) }).finally(() => db.$disconnect())
