import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { createAudit, listAudits } from './audit-service';

let auditorId: number;

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
      username: 'aud',
      employeeId: 'AUD1',
      name: 'auditor',
      passwordHash: await hashPassword('p'),
      departmentId: dept.id,
    },
  });
  await prisma.userRole.create({
    data: { userId: u.id, roleId: role.id, isPrimary: true },
  });
  auditorId = u.id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createAudit>[1]> = {},
): Parameters<typeof createAudit>[1] {
  return {
    year: 2026,
    quarter: 2,
    checkProject: '人员认定: 全部研发员合规',
    checkBudget: '投入归集: 各项目预算 vs 实际, 误差 < 3%',
    checkMaterial: '工时记录: 抽查 10 人, 全部齐全',
    checkOutsource: '样品销售: 3 单监销留痕',
    checkArchive: '资本化时点: 5 条件满足, 凭证齐全',
    compliantProject: true,
    compliantBudget: true,
    compliantMaterial: true,
    compliantOutsource: true,
    compliantArchive: true,
    overallOpinion: '本季度整体合规, 无重大风险',
    ...overrides,
  };
}

describe('createAudit', () => {
  it('happy 全合规 → 落库 + overallOpinion 不含整改要求', async () => {
    const a = await createAudit(auditorId, baseInput());
    expect(a.year).toBe(2026);
    expect(a.quarter).toBe(2);
    expect(a.compliantProject).toBe(true);
    expect(a.overallOpinion).toBe('本季度整体合规, 无重大风险');
    expect(a.auditorId).toBe(auditorId);
  });

  it('存在不合规且无整改要求 → BusinessError', async () => {
    await expect(
      createAudit(
        auditorId,
        baseInput({ compliantMaterial: false, rectifyRequired: '' }),
      ),
    ).rejects.toThrow(/整改要求必填/);
  });

  it('存在不合规且填整改要求 → 拼到 overallOpinion 末尾', async () => {
    const a = await createAudit(
      auditorId,
      baseInput({
        compliantMaterial: false,
        rectifyRequired: '研发部 7 月底前完成工时台账整改',
      }),
    );
    expect(a.compliantMaterial).toBe(false);
    expect(a.overallOpinion).toContain('整改要求');
    expect(a.overallOpinion).toContain('研发部 7 月底前完成工时台账整改');
  });

  it('季度不在 1-4 → BusinessError', async () => {
    await expect(
      createAudit(auditorId, baseInput({ quarter: 5 })),
    ).rejects.toThrow(/季度必须 1-4/);
  });

  it('同 year+quarter 重复创建 → DUPLICATE', async () => {
    await createAudit(auditorId, baseInput());
    await expect(createAudit(auditorId, baseInput())).rejects.toThrow(
      /内审已存在/,
    );
  });

  it('listAudits 按 year/quarter 倒序', async () => {
    await createAudit(auditorId, baseInput({ year: 2026, quarter: 1 }));
    await createAudit(auditorId, baseInput({ year: 2026, quarter: 2 }));
    const list = await listAudits();
    expect(list.length).toBe(2);
    expect(list[0].quarter).toBe(2);
    expect(list[1].quarter).toBe(1);
  });
});
