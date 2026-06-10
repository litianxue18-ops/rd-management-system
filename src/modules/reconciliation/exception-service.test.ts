import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import {
  createExceptionNote,
  resolveExceptionNote,
  listOpenExceptions,
} from './exception-service';

let userId: number;
let reconciliationId: number;

beforeEach(async () => {
  const dept = await prisma.department.create({
    data: { code: 'rd', name: '研发' },
  });
  const role = await prisma.role.upsert({
    where: { code: 'audit_lead' },
    update: {},
    create: { code: 'audit_lead', name: 'audit_lead' },
  });
  const u = await prisma.user.create({
    data: {
      username: 'audit',
      employeeId: 'A1',
      name: 'audit',
      passwordHash: await hashPassword('p'),
      departmentId: dept.id,
    },
  });
  await prisma.userRole.create({
    data: { userId: u.id, roleId: role.id, isPrimary: true },
  });
  userId = u.id;

  const rec = await prisma.reconciliationCheck.create({
    data: {
      year: 2026,
      month: 5,
      checkType: 'workhour_project',
      expectedValue: 100,
      actualValue: 50,
      diffRate: 0.5,
      isException: true,
      note: '工时严重低于基准',
    },
  });
  reconciliationId = rec.id;
});

describe('createExceptionNote', () => {
  it('happy → status=open, docNo 自动生成', async () => {
    const n = await createExceptionNote(userId, {
      reconciliationId,
      reason: '当月 3 个项目未及时提交工时, 涉及 P1/P2/P3',
    });
    expect(n.status).toBe('open');
    expect(n.docNo).toMatch(/^EXC-\d{4}-\d{3}$/);
    expect(n.raisedById).toBe(userId);
  });

  it('reason 为空 → BusinessError', async () => {
    await expect(
      createExceptionNote(userId, { reconciliationId, reason: '   ' }),
    ).rejects.toThrow(/原因/);
  });

  it('reconciliationId 不存在 → BusinessError', async () => {
    await expect(
      createExceptionNote(userId, { reconciliationId: 99999, reason: 'x' }),
    ).rejects.toThrow(/勾稽记录/);
  });
});

describe('resolveExceptionNote', () => {
  it('open → resolved, resolution + resolvedAt 已写入', async () => {
    const n = await createExceptionNote(userId, {
      reconciliationId,
      reason: '工时低',
    });
    const r = await resolveExceptionNote(
      userId,
      n.id,
      '已通知项目负责人补录, 5/30 前完成',
    );
    expect(r.status).toBe('resolved');
    expect(r.resolution).toMatch(/补录/);
    expect(r.resolvedById).toBe(userId);
    expect(r.resolvedAt).not.toBeNull();
  });

  it('再次 resolve 已 resolved → BusinessError', async () => {
    const n = await createExceptionNote(userId, {
      reconciliationId,
      reason: '工时低',
    });
    await resolveExceptionNote(userId, n.id, '补录');
    await expect(
      resolveExceptionNote(userId, n.id, '再补'),
    ).rejects.toThrow(/open/);
  });

  it('resolution 为空 → BusinessError', async () => {
    const n = await createExceptionNote(userId, {
      reconciliationId,
      reason: '工时低',
    });
    await expect(resolveExceptionNote(userId, n.id, '  ')).rejects.toThrow(
      /解决方案/,
    );
  });
});

describe('listOpenExceptions', () => {
  it('只返回 open 的异常单', async () => {
    const a = await createExceptionNote(userId, {
      reconciliationId,
      reason: 'a',
    });
    await createExceptionNote(userId, {
      reconciliationId,
      reason: 'b',
    });
    await resolveExceptionNote(userId, a.id, '已处理');
    const open = await listOpenExceptions();
    expect(open.length).toBe(1);
    expect(open[0].reason).toBe('b');
  });
});
