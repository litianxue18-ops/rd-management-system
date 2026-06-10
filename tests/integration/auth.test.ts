import { describe, it, expect, beforeEach } from 'vitest';
import { POST as loginPOST } from '@/app/api/auth/login/route';
import { GET as meGET } from '@/app/api/auth/me/route';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';

beforeEach(async () => {
  const role = await prisma.role.create({ data: { code: 'researcher', name: '研发员' } });
  const user = await prisma.user.create({
    data: {
      username: 'alice', employeeId: 'E001', name: 'Alice',
      passwordHash: await hashPassword('pass1234'),
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, isPrimary: true } });
});

function mockRequest(body?: any, headers: Record<string, string> = {}): any {
  return {
    json: async () => body,
    cookies: { get: () => undefined },
    headers: { get: (k: string) => headers[k.toLowerCase()] ?? null },
  };
}

describe('POST /api/auth/login', () => {
  it('200 + token', async () => {
    const res = await loginPOST(mockRequest({ username: 'alice', password: 'pass1234' }) as any);
    expect(res.status).toBe(200);
    const j = await res.json();
    expect(j.data.token).toBeTruthy();
  });

  it('400 密码错', async () => {
    const res = await loginPOST(mockRequest({ username: 'alice', password: 'x' }) as any);
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('401 无 token', async () => {
    const res = await meGET(mockRequest(undefined) as any);
    expect(res.status).toBe(401);
  });

  it('200 有效 token', async () => {
    const loginRes = await loginPOST(mockRequest({ username: 'alice', password: 'pass1234' }) as any);
    const { data } = await loginRes.json();
    const res = await meGET(mockRequest(undefined, { authorization: `Bearer ${data.token}` }) as any);
    expect(res.status).toBe(200);
    const me = await res.json();
    expect(me.data.username).toBe('alice');
  });
});
