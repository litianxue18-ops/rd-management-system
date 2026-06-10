import { describe, it, expect, beforeEach } from 'vitest';
import { POST as deptPOST } from '@/app/api/departments/route';
import { PUT as matrixPUT } from '@/app/api/permission-matrix/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

async function createUserWithRole(username: string, password: string, roleCode: string) {
  const role = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
  const user = await prisma.user.create({
    data: {
      username,
      employeeId: username.toUpperCase(),
      name: username,
      passwordHash: await hashPassword(password),
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, isPrimary: true } });
  return user;
}

function mockRequest(body?: any, headers: Record<string, string> = {}, search = ''): any {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
    nextUrl: { searchParams: new URLSearchParams(search) },
  };
}

async function loginAs(username: string, password: string): Promise<string> {
  const res = await loginPOST(mockRequest({ username, password }) as any);
  const j = await res.json();
  if (!j.data?.token) throw new Error(`login failed for ${username}: ${JSON.stringify(j)}`);
  return j.data.token;
}

beforeEach(async () => {
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('admin authz', () => {
  it('researcher 调 POST /api/departments → 403', async () => {
    await createUserWithRole('alice', 'pass1234', R.RESEARCHER);
    const token = await loginAs('alice', 'pass1234');
    const res = await deptPOST(
      mockRequest({ code: 'rd', name: '研发中心' }, { authorization: `Bearer ${token}` }) as any,
    );
    expect(res.status).toBe(403);
  });

  it('researcher 调 PUT /api/permission-matrix → 403', async () => {
    await createUserWithRole('bob', 'pass1234', R.RESEARCHER);
    const token = await loginAs('bob', 'pass1234');
    const res = await matrixPUT(
      mockRequest({ entries: [] }, { authorization: `Bearer ${token}` }) as any,
    );
    expect(res.status).toBe(403);
  });

  it('super_admin 调 PUT /api/permission-matrix → 200', async () => {
    await createUserWithRole('root', 'pass1234', R.SUPER_ADMIN);
    const token = await loginAs('root', 'pass1234');
    const res = await matrixPUT(
      mockRequest({ entries: [] }, { authorization: `Bearer ${token}` }) as any,
    );
    expect(res.status).toBe(200);
  });
});
