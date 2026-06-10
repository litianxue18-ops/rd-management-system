import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { generateProjectCode } from './number-generator';

beforeEach(async () => {
  await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } });
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });
});

describe('generateProjectCode', () => {
  it('首个 MAT 项目 → RD-MAT-2026-001', async () => {
    const code = await prisma.$transaction((tx) =>
      generateProjectCode(tx, 'MAT', new Date('2026-06-02')),
    );
    expect(code).toBe('RD-MAT-2026-001');
  });

  it('第 2 个 MAT 项目 → RD-MAT-2026-002', async () => {
    const dept = await prisma.department.create({ data: { code: 'rd', name: '研发中心' } });
    const u = await prisma.user.create({
      data: { username: 'a', employeeId: 'A', name: 'a', passwordHash: 'x' },
    });
    const typeId = (await prisma.projectType.findUniqueOrThrow({ where: { code: 'MAT' } })).id;
    // 先造一条 activated 项目占位
    await prisma.project.create({
      data: {
        code: 'RD-MAT-2026-001',
        name: '已激活 #1',
        projectTypeId: typeId,
        departmentId: dept.id,
        leadUserId: u.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 100,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: u.id,
        activatedAt: new Date('2026-03-01'),
      },
    });
    const code = await prisma.$transaction((tx) =>
      generateProjectCode(tx, 'MAT', new Date('2026-06-02')),
    );
    expect(code).toBe('RD-MAT-2026-002');
  });
});
