import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  const bed = await prisma.bed.findFirst({
    where: { bedNumber: 'GEN-005' },
    include: { bedCategory: true, ward: true }
  })
  console.log('BED:', bed)

  const cats = await prisma.bedCategory.findMany()
  console.log('BED CATEGORIES:', cats)

  const rules = await prisma.tariffRule.findMany()
  console.log('TARIFF RULES:', rules)
}

main().catch(console.error).finally(() => prisma.$disconnect())
