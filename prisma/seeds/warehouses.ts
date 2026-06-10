import { PrismaClient } from '@prisma/client';

interface WarehouseSeed {
  code: string;
  name: string;
  location?: string;
}

const WAREHOUSES: WarehouseSeed[] = [
  { code: 'rd-warehouse', name: 'R&D 主仓', location: '研发楼 1F' },
  { code: 'trial-warehouse', name: '试制车间仓', location: '试制车间' },
];

export async function seedWarehouses(prisma: PrismaClient) {
  for (const w of WAREHOUSES) {
    await prisma.warehouse.upsert({
      where: { code: w.code },
      update: w,
      create: w,
    });
  }
  console.log(`seeded ${WAREHOUSES.length} warehouses`);
}
