import { describe, it, expect, beforeEach } from 'vitest';
import { POST as exportPOST } from '@/app/api/reports/export/route';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

function mockRequest(
  body?: any,
  headers: Record<string, string> = {},
  search = '',
): any {
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
  if (!j.data?.token) throw new Error(`login failed: ${JSON.stringify(j)}`);
  return j.data.token;
}

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
  await prisma.userRole.create({
    data: { userId: user.id, roleId: role.id, isPrimary: true },
  });
  return user;
}

beforeEach(async () => {
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('POST /api/reports/export', () => {
  it('project_ledger 返回 200 + xlsx content-type + 文件名带项目台账', async () => {
    await createUserWithRole('rd1', 'pass1234', R.RD_DIRECTOR);
    const token = await loginAs('rd1', 'pass1234');
    const res = await exportPOST(
      mockRequest(
        { type: 'project_ledger', filters: {} },
        { authorization: `Bearer ${token}` },
      ) as any,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain(
      'spreadsheetml.sheet',
    );
    const cd = res.headers.get('content-disposition') ?? '';
    expect(cd).toContain('attachment');
    expect(decodeURIComponent(cd)).toContain('项目台账');
    // ExcelJS xlsx 文件是 ZIP, 头 2 字节是 "PK"
    const buf = Buffer.from(await res.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
  });

  it('未登录 → 401', async () => {
    const res = await exportPOST(
      mockRequest({ type: 'project_ledger' }) as any,
    );
    expect(res.status).toBe(401);
  });

  it('sample_scrap 返回 200 + xlsx (空表也能渲染)', async () => {
    await createUserWithRole('rd2', 'pass1234', R.RD_DIRECTOR);
    const token = await loginAs('rd2', 'pass1234');
    const res = await exportPOST(
      mockRequest(
        { type: 'sample_scrap' },
        { authorization: `Bearer ${token}` },
      ) as any,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('spreadsheetml.sheet');
  });
});
