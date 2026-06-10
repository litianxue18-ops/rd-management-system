import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createUser, listUsers, setUserRoles, resetPassword } from './user-service';

let deptId: number;
let roleResearcherId: number;
let roleDirectorId: number;

beforeEach(async () => {
  const d = await prisma.department.create({ data: { code: 'rd', name: '研发中心' } });
  deptId = d.id;
  const r1 = await prisma.role.create({ data: { code: 'researcher', name: '研发员' } });
  const r2 = await prisma.role.create({ data: { code: 'rd_director', name: '研发中心负责人' } });
  roleResearcherId = r1.id; roleDirectorId = r2.id;
});

describe('user service', () => {
  it('createUser 自动 hash 密码', async () => {
    const u = await createUser({ username: 'alice', employeeId: 'E001', name: 'Alice', password: 'pass1234', departmentId: deptId, roleIds: [roleResearcherId] });
    expect(u.passwordHash).not.toBe('pass1234');
    expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
  });

  it('list 含部门和角色', async () => {
    await createUser({ username: 'alice', employeeId: 'E001', name: 'Alice', password: 'pass1234', departmentId: deptId, roleIds: [roleResearcherId] });
    const list = await listUsers();
    expect(list[0].department?.name).toBe('研发中心');
    expect(list[0].roles[0].code).toBe('researcher');
  });

  it('setUserRoles 替换角色', async () => {
    const u = await createUser({ username: 'alice', employeeId: 'E001', name: 'Alice', password: 'p', departmentId: deptId, roleIds: [roleResearcherId] });
    await setUserRoles(u.id, [{ roleId: roleDirectorId, isPrimary: true }]);
    const list = await listUsers();
    expect(list[0].roles).toHaveLength(1);
    expect(list[0].roles[0].code).toBe('rd_director');
  });

  it('resetPassword 重设', async () => {
    const u = await createUser({ username: 'alice', employeeId: 'E001', name: 'Alice', password: 'old', departmentId: deptId, roleIds: [roleResearcherId] });
    await resetPassword(u.id, 'new5678');
    const u2 = await prisma.user.findUnique({ where: { id: u.id } });
    expect(u2?.passwordHash).not.toBe(u.passwordHash);
  });
});
