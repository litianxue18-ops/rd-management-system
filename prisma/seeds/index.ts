import { PrismaClient } from '@prisma/client';
import 'dotenv/config';
import { seedRoles } from './roles';
import { seedPermissionMatrix } from './permission-matrix';
import { seedProjectTypes } from './project-types';
import { seedNumberRules } from './number-rules';
import { seedWarehouses } from './warehouses';

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedRoles(prisma);
    await seedPermissionMatrix(prisma);
    await seedProjectTypes(prisma);
    await seedNumberRules(prisma);
    await seedWarehouses(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
