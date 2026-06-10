import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from './password';
import { login } from './service';

beforeEach(async () => {
  const role = await prisma.role.create({ data: { code: 'researcher', name: '研发员' } });
  const dept = await prisma.department.create({ data: { code: 'rd', name: '研发中心' } });
  const user = await prisma.user.create({
    data: {
      username: 'alice', employeeId: 'E001', name: 'Alice',
      passwordHash: await hashPassword('pass1234'),
      departmentId: dept.id,
    },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, isPrimary: true } });
});

describe('login', () => {
  it('用户名密码正确返回 token', async () => {
    const { token, user } = await login('alice', 'pass1234');
    expect(token).toBeTruthy();
    expect(user.username).toBe('alice');
  });

  it('密码错误抛错', async () => {
    await expect(login('alice', 'wrong')).rejects.toThrow('用户名或密码错误');
  });

  it('用户不存在抛错', async () => {
    await expect(login('bob', 'pass1234')).rejects.toThrow('用户名或密码错误');
  });
});
