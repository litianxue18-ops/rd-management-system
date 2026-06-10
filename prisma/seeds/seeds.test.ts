import { describe, it, expect } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { seedRoles } from './roles';
import { seedPermissionMatrix } from './permission-matrix';

describe('seed', () => {
  const prisma = new PrismaClient();

  it('roles 幂等', async () => {
    await seedRoles(prisma);
    await seedRoles(prisma);
    expect(await prisma.role.count()).toBe(13);
  });

  it('permission-matrix 幂等', async () => {
    await seedRoles(prisma);
    await seedPermissionMatrix(prisma);
    await seedPermissionMatrix(prisma);
    expect(await prisma.rolePermissionNode.count()).toBe(80);
  });
});
