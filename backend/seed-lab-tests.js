#!/usr/bin/env node
/**
 * Seed the LabTest catalog (942 tests) into the LOCAL database, then it can be
 * pushed to production with `node upload-to-prod.js`.
 * Idempotent: deterministic ids (labtest-cat-NNNN) so re-runs update.
 */
import { db } from './src/config/db.js'
import { LAB_TESTS } from './lab-tests-data.js'

const ORG = 'org-demo'
const pad = (n, l = 4) => String(n).padStart(l, '0')

// crude category guesser from the test name
function categorize(name) {
  const n = name.toLowerCase()
  if (/(cbc|hemogram|haemogram|hemoglobin|platelet|wbc|rbc|esr|mcv|mch|mchc|neutrophil|lymphocyte|monocyte|eosinophil|basophil|reticulocyte|dlc|tlc|pcv|hematocrit|blood film|peripheral smear|anemia|thalassem)/.test(n)) return 'Hematology'
  if (/(urine|urinalysis|urinary|uacr|microalbumin|creatinine ratio|spot urine)/.test(n)) return 'Clinical Pathology'
  if (/(stool|fecal|faecal|occult blood|ova|cyst)/.test(n)) return 'Clinical Pathology'
  if (/(culture|sensitivity|gram stain|afb|koh|fungal|bacteri|mantoux|tb gold|genexpert|quantiferon|widal|typhidot|typhoid|c\/s|swab)/.test(n)) return 'Microbiology'
  if (/(igg|igm|iga|ige|antibody|antigen|serology|elisa|hiv|hbsag|hcv|hbv|hav|hev|dengue|chikungunya|rubella|cmv|ebv|herpes|hsv|toxo|leptospira|scrub|ana|anca|aso|rf|ccp|dsdna|complement|treponema|vdrl|rpr|torch)/.test(n)) return 'Immunology / Serology'
  if (/(tsh|t3|t4|thyroid|prolactin|cortisol|testosterone|estradiol|estrogen|progesterone|fsh|lh|insulin|growth hormone|hormone|amh|dhea|acth|pth|gonadotropin|c-peptide|androstenedione)/.test(n)) return 'Endocrinology / Hormones'
  if (/(cholesterol|lipid|triglyceride|hdl|ldl|vldl|apolipoprotein|lipoprotein)/.test(n)) return 'Lipid Profile'
  if (/(sgot|sgpt|ast|alt|bilirubin|ggt|alkaline phosphatase|liver|albumin|globulin|protein total|lft)/.test(n)) return 'Liver Function'
  if (/(urea|creatinine|kft|rft|kidney|egfr|gfr|bun|uric acid|electrolyte|sodium|potassium|chloride|bicarbonate)/.test(n)) return 'Kidney Function'
  if (/(glucose|sugar|hba1c|a1c|fbs|ppbs|rbs|fructosamine|ogtt|diabet)/.test(n)) return 'Diabetes'
  if (/(vitamin|folate|folic|ferritin|iron|tibc|b12|copper|zinc|magnesium|calcium|phosphor)/.test(n)) return 'Biochemistry'
  if (/(troponin|cpk|ck-mb|bnp|natriuretic|d-dimer|pt|inr|aptt|ptt|coagulation|clotting|bleeding time|fibrin|protein-c|protein-s|thrombin)/.test(n)) return 'Cardiac / Coagulation'
  if (/(psa|cea|ca-125|ca 125|ca 15|ca 19|afp|beta hcg|hcg|tumor|tumour|marker|biopsy|cytology|pap smear)/.test(n)) return 'Oncology / Tumor Markers'
  if (/(pcr|dna|rna|gene|karyotype|mutation|fish|cytogenetic|molecular|bcr-abl|brca)/.test(n)) return 'Molecular / Genetics'
  if (/(vision|visual|ocular|retina|fundus|intraocular|corneal|optic|schirmer|pentacam|nystagmus|oct)/.test(n)) return 'Ophthalmology'
  return 'General'
}

// crude test code: prefer text in parentheses, else initials
function makeCode(name) {
  const paren = name.match(/\(([^)]{2,8})\)/)
  if (paren) return paren[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
  const words = name.replace(/[^A-Za-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 5).toUpperCase()
  return words.map(w => w[0]).join('').toUpperCase().slice(0, 6)
}

// rough price by category
const PRICE = {
  'Hematology': 350, 'Clinical Pathology': 250, 'Microbiology': 600,
  'Immunology / Serology': 900, 'Endocrinology / Hormones': 800, 'Lipid Profile': 700,
  'Liver Function': 600, 'Kidney Function': 500, 'Diabetes': 300, 'Biochemistry': 450,
  'Cardiac / Coagulation': 950, 'Oncology / Tumor Markers': 1500,
  'Molecular / Genetics': 3500, 'Ophthalmology': 500, 'General': 400,
}

async function main() {
  console.log(`Seeding ${LAB_TESTS.length} lab tests into local DB...`)
  let ok = 0, fail = 0
  for (let i = 0; i < LAB_TESTS.length; i++) {
    const testName = LAB_TESTS[i].trim()
    if (!testName) continue
    const id = `labtest-cat-${pad(i + 1)}`
    const category = categorize(testName)
    const data = {
      organizationId: ORG,
      testName,
      testCode: makeCode(testName),
      testCategory: category,
      specimenType: /urine/i.test(testName) ? 'Urine' : /stool/i.test(testName) ? 'Stool' : /sputum/i.test(testName) ? 'Sputum' : 'Blood',
      price: PRICE[category] || 400,
      isActive: true,
      updatedAt: new Date(),
    }
    try {
      await db.labTest.upsert({ where: { id }, update: data, create: { id, ...data } })
      ok++
    } catch (e) {
      fail++
      if (fail <= 3) console.log(`  ${id}: ${e.message.slice(0, 80)}`)
    }
  }
  console.log(`✅ Lab tests: ${ok} seeded${fail ? `, ${fail} failed` : ''}`)
  const total = await db.labTest.count({ where: { organizationId: ORG } })
  console.log(`   Total lab tests in catalog now: ${total}`)
}

main()
  .catch(e => { console.error('FATAL:', e.message); process.exit(1) })
  .finally(() => db.$disconnect())
