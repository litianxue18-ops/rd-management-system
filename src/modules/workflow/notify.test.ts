import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { seedRoles } from '../../../prisma/seeds/roles';
import { notifyRoles } from './notify';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

beforeEach(async () => {
  await seedRoles(prisma);
  const role = await prisma.role.findUniqueOrThrow({ where: { code: R.RESEARCHER } });
  for (let i = 0; i < 3; i++) {
    const u = await prisma.user.create({ data: { username: `r${i}`, employeeId: `R${i}`, name: `r${i}`, passwordHash: 'x' } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: role.id, isPrimary: true } });
  }
});

describe('notifyRoles', () => {
  it('推 3 个 researcher', async () => {
    const n = await notifyRoles([R.RESEARCHER], { eventType: 'test', message: 'hi' });
    expect(n).toBe(3);
    const rows = await prisma.notification.findMany();
    expect(rows).toHaveLength(3);
    expect(rows[0].message).toBe('hi');
  });
});
