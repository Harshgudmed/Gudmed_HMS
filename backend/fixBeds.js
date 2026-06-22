import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const orgId = 'org-demo'
  
  // 1. Create categories
  let genCat = await prisma.bedCategory.findFirst({ where: { name: 'General Ward' } })
  if (!genCat) {
    genCat = await prisma.bedCategory.create({
      data: {
        id: 'cat-general',
        organizationId: orgId,
        name: 'General Ward',
        code: 'GEN',
        defaultBedDayRate: 1500
      }
    })
    console.log('Created General Ward category:', genCat.id)
  }

  let matCat = await prisma.bedCategory.findFirst({ where: { name: 'Maternity Ward' } })
  if (!matCat) {
    matCat = await prisma.bedCategory.create({
      data: {
        id: 'cat-maternity',
        organizationId: orgId,
        name: 'Maternity Ward',
        code: 'MAT',
        defaultBedDayRate: 2500
      }
    })
    console.log('Created Maternity Ward category:', matCat.id)
  }

  // 2. Update Beds
  const beds = await prisma.bed.findMany({ include: { ward: true } })
  for (const bed of beds) {
    let catId = null
    if (bed.ward.name.toLowerCase().includes('maternity')) catId = matCat.id
    else if (bed.ward.name.toLowerCase().includes('general')) catId = genCat.id

    if (catId && bed.bedCategoryId !== catId) {
      await prisma.bed.update({ where: { id: bed.id }, data: { bedCategoryId: catId } })
      console.log(`Updated bed ${bed.bedNumber} -> category ${catId}`)
    }
  }

  // 3. Update Occupancy Segments (so existing admitted patients get billed properly)
  const occupancies = await prisma.bedOccupancy.findMany({ include: { bed: true } })
  for (const occ of occupancies) {
    if (occ.bed && occ.bed.bedCategoryId && occ.bedCategoryId !== occ.bed.bedCategoryId) {
      await prisma.bedOccupancy.update({ where: { id: occ.id }, data: { bedCategoryId: occ.bed.bedCategoryId } })
      console.log(`Updated occupancy segment ${occ.id} -> category ${occ.bed.bedCategoryId}`)
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
