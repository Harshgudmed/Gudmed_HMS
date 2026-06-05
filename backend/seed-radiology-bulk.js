import { db } from './src/config/db.js'

// Extract just the radiology exams from your data
const radiologyExamsData = [
  'X RAY CHEST (Male)',
  'X- Ray Abdomen - Supine',
  'X- Ray Forearm - AP Left',
  'X-Ray Abdomen - Cross Table',
  'X-Ray Abdomen - KUB',
  'X-Ray Abdomen - Standing',
  'X-Ray Ankle - AP',
  'X-Ray Ankle - AP left',
  'X-Ray Ankle - AP Right',
  'X-Ray Ankle - AP/Lateral left',
  'X-Ray Ankle - AP/Lateral Right',
  'X-Ray Ankle - AP/Oblique Left',
  'X-Ray Ankle - AP/Oblique Right',
  'X-Ray Ankle - Lateral',
  'X-Ray Ankle - Lateral Left',
  'X-Ray Ankle - Lateral Right',
  'X-Ray Ankle - Lateral/Oblique Left',
  'X-Ray Ankle - Lateral/Oblique Right',
  'X-Ray Ankle - Oblique',
  'X-Ray Ankle - Oblique Left',
  'X-Ray Ankle - Oblique Right',
  'X-Ray Arm - AP',
  'X-Ray Arm - AP Left',
  'X-Ray Arm - AP Right',
  'X-Ray Arm - AP/Lateral Left',
  'X-Ray Arm - AP/Lateral Right',
  'X-Ray Arm - AP/Oblique Left',
  'X-Ray Arm - AP/Oblique Right',
  'X-Ray Arm - Lateral',
  'X-Ray Arm - Lateral Left',
  'X-Ray Arm - Lateral Right',
  'X-Ray Arm - Lateral/Oblique Left',
  'X-Ray Arm - Lateral/Oblique Right',
  'X-Ray Arm - Oblique',
  'X-Ray Arm - Oblique Left',
  'X-Ray Arm - Oblique Right',
  'X-Ray Base of the Skull',
  'X-Ray both SI joint',
  'X-Ray Both SI Joint - Left',
  'X-Ray Both SI Joint - RIght',
  'X-Ray Carpell Tunnel View',
  'X-Ray Carpell Tunnel View Left',
  'X-Ray Carpell Tunnel View Right',
  'X-Ray Cervical Spine',
  'X-Ray Chest',
  'X-ray Chest PA View',
  'X-Ray DL Spine',
  'X-Ray Dorsal Spine',
  'X-Ray Elbow - AP',
  'X-Ray Elbow - AP left',
  'X-Ray Elbow - AP Right',
  'X-Ray Elbow - AP/Lateral left',
  'X-Ray Elbow - AP/Lateral Right',
  'X-Ray Elbow - AP/Oblique Left',
  'X-Ray Elbow - AP/Oblique Right',
  'X-Ray Elbow - Lateral',
  'X-Ray Elbow - Lateral Left',
  'X-Ray Elbow - Lateral Right',
  'X-Ray Elbow - Lateral/Oblique Left',
  'X-Ray Elbow - Lateral/Oblique Right',
  'X-Ray Elbow - Oblique Left',
  'X-Ray Elbow - Oblique Right',
  'X-Ray Femur - Lateral Left',
  'X-Ray Femur - Lateral Right',
  'X-Ray Foot - AP',
  'X-Ray Foot - AP Left',
  'X-Ray Foot - AP Right',
  'X-Ray Foot - AP/Lateral Left',
  'X-Ray Foot - AP/Lateral Right',
  'X-Ray Foot - AP/Oblique Left',
  'X-Ray Foot - AP/Oblique Right',
  'X-Ray Foot - Lateral',
  'X-Ray Foot - Lateral Left',
  'X-Ray Foot - Lateral Right',
  'X-Ray Foot - Lateral/Oblique Left',
  'X-Ray Foot - Lateral/Oblique Right',
  'X-Ray Foot - Oblique',
  'X-Ray Foot - Oblique Left',
  'X-Ray Foot - Oblique Right',
  'X-Ray Forearm - AP',
  'X-Ray Forearm - AP Right',
  'X-Ray Forearm - AP/ Oblique Left',
  'X-Ray Forearm - AP/ Oblique Right',
  'X-Ray Forearm - AP/Lateral Left',
  'X-Ray Forearm - AP/Lateral Right',
  'X-Ray Forearm - Lateral Left',
  'X-Ray Forearm - Lateral Right',
  'X-Ray Forearm - Lateral/Oblique Left',
  'X-Ray Forearm - Lateral/Oblique Right',
  'X-Ray Forearm - Oblique',
  'X-Ray Forearm - Oblique Left',
  'X-Ray Forearm - Oblique Right',
  'X-Ray Hand - AP',
  'X-Ray Hand - AP left',
  'X-Ray Hand - AP Right',
  'X-Ray Hand - AP/Lateral left',
  'X-Ray Hand - AP/Lateral Right',
  'X-Ray Hand - AP/Oblique Left',
  'X-Ray Hand - AP/Oblique Right',
  'X-Ray Hand - Lateral',
  'X-Ray Hand - Lateral Left',
  'X-Ray Hand - Lateral Right',
  'X-Ray Hand - Lateral/Oblique Left',
  'X-Ray Hand - Lateral/Oblique Right',
  'X-Ray Hand - Oblique',
  'X-Ray Knee - AP',
  'X-Ray Knee - AP left',
  'X-Ray Knee - AP Right',
  'X-Ray Knee - AP/Lateral left',
  'X-Ray Knee - AP/Lateral Right',
  'X-Ray Knee - AP/Oblique Left',
  'X-Ray Knee - AP/Oblique Right',
  'X-Ray Knee - Lateral',
  'X-Ray Knee - Lateral Left',
  'X-Ray Knee - Lateral Right',
  'X-Ray Knee - Lateral/Oblique Left',
  'X-Ray Knee - Lateral/Oblique Right',
  'X-Ray Knee - Oblique Left',
  'X-Ray Knee - Oblique Right',
  'Bilateral Mammography',
  'Mammography',
  'Hysterosalpingography (HSG)',
  '3D Mammography',
  '3-D conformal radiation',
  '3D mammogram',
  'MRI - Abdomen',
  'MRI - Angiography',
  'MRI - Ankle Left',
  'MRI - Ankle Right',
  'MRI - Base of Skull to Inlet of Thorax',
  'MRI - Brain',
  'MRI - Brain + Angio',
  'MRI - Brain + Orbit',
  'MRI - Brain + Veno',
  'MRI - Breast Left',
  'MRI - BReast Right',
  'MRI - Cardiac',
  'MRI - Cervical Spine',
  'MRI - CIsternography',
  'MRI - CSF flow Study',
  'MRI - CV Junction',
  'MRI - DL Spine',
  'MRI - Dorsal Spine',
  'MRI - FIstulogram',
  'MRI - Functional',
  'MRI - Hip Joint',
  'MRI - Knee Left',
  'MRI - Knee Right',
  'MRI - LImb Left',
  'MRI - LImb Right',
  'MRI - Lumbar Spine',
  'MRI - Lumbosacral Spine',
  'MRI - Neck Left',
  'MRI - Neck Right',
  'MRI - Orbit',
  'MRI - PBH',
  'MRI - Pelvis',
  'MRI - PNS',
  'MRI - Prostate',
  'MRI - Shoulder Joint',
  'MRI - SHoulder Left',
  'MRI - Shoulder Right',
  'MRI - SI Joint Left',
  'MRI - SI joint Right',
  'MRI - Spectroscopy',
  'MRI - Spine',
  'MRI - Thorax Left',
  'MRI - Thorax Right',
  'MRI - TM joint Left',
  'MRI - TM joint Right',
  'MRI - Tractography',
  'MRI - Urography/Myelography',
  'MRI - Wrist Left',
  'MRI - Wrist Right',
  'MRI Scan of Brain and Pitutary',
  'MRI- Lumbosacral SPine',
  'MRI- Perfusion study',
  'CT - Abdomen',
  'CT - Abdomen and Pelvis',
  'CT - Bone Densitomjetry',
  'CT - Cardiac',
  'CT - Chest',
  'CT - Cisternography',
  'CT - Coronary Angiography',
  'CT - Coronary Calcium Study',
  'CT - CV junction',
  'CT - DL Spine Plain',
  'CT - DL Spine Plain + Contrast',
  'CT - Elbow Left',
  'CT - Head/Brain Plain',
  'CT - Head/Brain Plain + Contrast',
  'CT - HRCT Chest',
  'CT - HRCT Lung',
  'CT - HRCT PNS',
  'CT - HRCT Temporal bone',
  'CT - HRCT Thorax',
  'CT - KUB plain',
  'CT - KUB plain + Contrast',
  'CT - Left Limb',
  'CT - Lung',
  'CT - Neck',
  'CT - Orbit',
  'CT - Patroid Swelling',
  'CT - Pelvis',
  'CT - Perfusion Study',
  'CT - PNS',
  'CT - Right Limb',
  'CT - Shoulder Left',
  'CT - Shoulder RIght',
  'CT - Skull',
  'CT - Spine Contrast + Plain',
  'CT - Spine Left',
  'CT - Spine Plain',
  'CT - Spine Right',
  'CT - Thorax',
  'CT - TMJ',
  'CT - Virtual Bronchoscoopy',
  'CT - Virtual Colonoscopy',
  'CT - Whole Body',
  'CT coronary Angiogram',
  'USG Abdomen',
  'USG Abdomen and Pelvis',
  'USG Ankle Joint Left',
  'USG Ankle Joint Right',
  'USG Congenital Anomaly Scan',
  'USG Fistulography',
  'USG Knee Joint Left',
  'USG Knee Joint Right',
  'USG KUB with Post Void Residual Urine',
  'USG Left Hip',
  'USG Left SHoulder',
  'USG Local',
  'USG Neck',
  'USG Obstetric',
  'USG Orbit Left',
  'USG Orbit Right',
  'USG Parotid',
  'USG Pelvis',
  'USG Prostate',
  'USG Right SHoulder',
  'USG Scrotum',
  'USG Skull',
  'USG Testes (Male)',
  'USG Thyroid',
  'USG Trans Rectal Sonography',
  'USG Trans Vaginal Sonography',
  'Carotid ultrasound',
  'Fetal ultrasound',
  'Color Doppler Scrotum (Male)',
  'Lower Limb Arterial Doppler Left',
  'Lower Limb Arterial Doppler Right',
  'Lower Limb Venous Doppler Right',
  'Lower Limp Venous Doppler Left',
  'Carotid Doppler',
]

// Categorize exams based on name
function categorizeExam(examName) {
  const name = examName.toLowerCase()

  if (name.includes('x-ray') || name.includes('x ray')) {
    return { examCategory: 'x-ray', modality: 'CR', bodyPart: extractBodyPart(examName) }
  } else if (name.includes('mri')) {
    return { examCategory: 'mri', modality: 'MRI', bodyPart: extractBodyPart(examName) }
  } else if (name.includes('ct')) {
    return { examCategory: 'ct', modality: 'CT', bodyPart: extractBodyPart(examName) }
  } else if (name.includes('usg') || name.includes('ultrasound') || name.includes('doppler')) {
    return { examCategory: 'ultrasound', modality: 'US', bodyPart: extractBodyPart(examName) }
  } else if (name.includes('mammography')) {
    return { examCategory: 'mammography', modality: 'MG', bodyPart: 'breast' }
  } else if (name.includes('hsg')) {
    return { examCategory: 'fluoroscopy', modality: 'CR', bodyPart: 'pelvis' }
  }

  return { examCategory: 'radiography', modality: 'CR', bodyPart: 'general' }
}

function extractBodyPart(examName) {
  const name = examName.toLowerCase()

  if (name.includes('abdomen')) return 'abdomen'
  if (name.includes('ankle')) return 'ankle'
  if (name.includes('brain')) return 'brain'
  if (name.includes('breast')) return 'breast'
  if (name.includes('cervical')) return 'cervical spine'
  if (name.includes('chest')) return 'chest'
  if (name.includes('dorsal')) return 'thoracic spine'
  if (name.includes('elbow')) return 'elbow'
  if (name.includes('femur')) return 'femur'
  if (name.includes('foot')) return 'foot'
  if (name.includes('forearm')) return 'forearm'
  if (name.includes('hand')) return 'hand'
  if (name.includes('knee')) return 'knee'
  if (name.includes('lumbar')) return 'lumbar spine'
  if (name.includes('neck')) return 'neck'
  if (name.includes('pelvis')) return 'pelvis'
  if (name.includes('shoulder')) return 'shoulder'
  if (name.includes('spine')) return 'spine'
  if (name.includes('wrist')) return 'wrist'
  if (name.includes('doppler')) return 'vascular'

  return 'general'
}

async function seedRadiologyBulk() {
  try {
    console.log('🌍 BULK RADIOLOGY SEEDING STARTED')
    console.log(`📊 Total exams to seed: ${radiologyExamsData.length}\n`)

    const orgId = 'org-demo'
    let successCount = 0
    let errorCount = 0
    const errors = []

    for (let i = 0; i < radiologyExamsData.length; i++) {
      const examName = radiologyExamsData[i].trim()

      if (!examName) continue

      try {
        const { examCategory, modality, bodyPart } = categorizeExam(examName)
        const examId = `radio-${examName.toLowerCase().replace(/\s+/g, '-').replace(/[()]/g, '')}`
        const examCode = `RAD${String(i + 1).padStart(4, '0')}`

        await db.radiologyExam.upsert({
          where: { id: examId },
          update: {
            examName,
            examCode,
            examCategory,
            modality,
            bodyPart,
            isActive: true,
          },
          create: {
            id: examId,
            organizationId: orgId,
            examName,
            examCode,
            examCategory,
            modality,
            bodyPart,
            price: 1000, // Default price
            isActive: true,
          },
        })

        successCount++
        if ((i + 1) % 50 === 0) {
          console.log(`⏳ Progress: ${i + 1}/${radiologyExamsData.length} exams processed...`)
        }
      } catch (err) {
        errorCount++
        errors.push({ exam: examName, error: err.message.substring(0, 100) })
        if (errors.length <= 5) {
          console.log(`⚠️  Error: ${examName} - ${err.message.substring(0, 80)}`)
        }
      }
    }

    console.log('\n' + '='.repeat(70))
    console.log('📊 BULK RADIOLOGY SEEDING COMPLETE')
    console.log('='.repeat(70))
    console.log(`✅ Successfully seeded: ${successCount} exams`)
    console.log(`❌ Failed: ${errorCount} exams`)
    console.log(`\n🎉 Radiology catalog updated!`)

    if (errors.length > 5) {
      console.log(`\n(Showing first 5 errors of ${errors.length} total errors)`)
    }

    process.exit(successCount > 0 ? 0 : 1)
  } catch (err) {
    console.error('❌ Critical error:', err.message)
    process.exit(1)
  }
}

seedRadiologyBulk()
