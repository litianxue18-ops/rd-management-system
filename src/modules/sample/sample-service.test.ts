import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import {
  createSample,
  superviseDirectly,
  listSamples,
} from './sample-service';

let projId: number;
let researcherId: number;
let supervisorId: number;
let matA: number;
let whMain: number;

beforeEach(async () => {
  const dept = await prisma.department.create({
    data: { code: 'rd', name: '研发' },
  });
  const ptype = await prisma.projectType.create({
    data: { code: 'MAT', name: '新材料' },
  });
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });
  const r1 = await prisma.role.create({
    data: { code: 'researcher', name: '研究员' },
  });
  const r2 = await prisma.role.create({
    data: { code: 'finance_lead', name: '财务' },
  });
  const u1 = await prisma.user.create({
    data: {
      username: 'res',
      employeeId: 'RES',
      name: '研究员',
      passwordHash: await hashPassword('p'),
      departmentId: dept.id,
    },
  });
  const u2 = await prisma.user.create({
    data: {
      username: 'fin',
      employeeId: 'FIN',
      name: '财务',
      passwordHash: await hashPassword('p'),
      departmentId: dept.id,
    },
  });
  await prisma.userRole.create({
    data: { userId: u1.id, roleId: r1.id, isPrimary: true },
  });
  await prisma.userRole.create({
    data: { userId: u2.id, roleId: r2.id, isPrimary: true },
  });
  researcherId = u1.id;
  supervisorId = u2.id;

  matA = (
    await prisma.material.create({
      data: { code: 'M-A', name: '物料 A', unit: 'kg' },
    })
  ).id;
  whMain = (
    await prisma.warehouse.create({ data: { code: 'wh-main', name: '主仓' } })
  ).id;

  projId = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
        projectTypeId: ptype.id,
        departmentId: dept.id,
        leadUserId: u1.id,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 100000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: u1.id,
        status: 'active',
      },
    })
  ).id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createSample>[1]> = {},
): Parameters<typeof createSample>[1] {
  return {
    projectId: projId,
    type: 'sample',
    materialId: matA,
    warehouseId: whMain,
    consumedQty: 5,
    productName: '样品 A',
    productQty: 1,
    productUnit: '件',
    disposalMethod: 'retained',
    ...overrides,
  };
}

describe('createSample', () => {
  it('type=scrap → ledger 写 scrap 流水 (changeQty 负, sourceType=sample_scrap_log)', async () => {
    const log = await createSample(
      researcherId,
      baseInput({ type: 'scrap', consumedQty: 3, disposalMethod: 'destroyed' }),
    );
    expect(log.docNo).toMatch(/^SS-\d{4}-\d{3}$/);
    expect(log.type).toBe('scrap');

    const ledger = await prisma.inventoryLedger.findMany({
      where: { sourceType: 'sample_scrap_log', sourceId: log.id },
    });
    expect(ledger).toHaveLength(1);
    expect(ledger[0].changeType).toBe('scrap');
    expect(Number(ledger[0].changeQty)).toBe(-3);
    expect(ledger[0].projectId).toBe(projId);
  });

  it('type=sample → ledger 无新增 (留样不重复扣库存)', async () => {
    const before = await prisma.inventoryLedger.count();
    const log = await createSample(researcherId, baseInput({ type: 'sample' }));
    expect(log.type).toBe('sample');
    const after = await prisma.inventoryLedger.count();
    expect(after).toBe(before);
  });

  it('disposalMethod=sold 没填 income → BusinessError', async () => {
    await expect(
      createSample(
        researcherId,
        baseInput({ disposalMethod: 'sold' }),
      ),
    ).rejects.toThrow(/出售时必须填收入/);
  });

  it('consumedQty <= 0 → BusinessError', async () => {
    await expect(
      createSample(researcherId, baseInput({ consumedQty: 0 })),
    ).rejects.toThrow(/消耗量必须 > 0/);
  });
});

describe('superviseDirectly', () => {
  it('draft → supervised, 记 supervisorId + supervisedAt', async () => {
    const log = await createSample(researcherId, baseInput());
    expect(log.status).toBe('draft');

    await superviseDirectly(log.id, supervisorId);

    const after = await prisma.sampleScrapLog.findUniqueOrThrow({
      where: { id: log.id },
    });
    expect(after.status).toBe('supervised');
    expect(after.supervisedById).toBe(supervisorId);
    expect(after.supervisedAt).not.toBeNull();
  });

  it('已 supervised 再调 → BusinessError', async () => {
    const log = await createSample(researcherId, baseInput());
    await superviseDirectly(log.id, supervisorId);
    await expect(
      superviseDirectly(log.id, supervisorId),
    ).rejects.toThrow(/已监销/);
  });
});

describe('listSamples', () => {
  it('filter projectId + type', async () => {
    await createSample(researcherId, baseInput({ type: 'sample' }));
    await createSample(researcherId, baseInput({ type: 'scrap', disposalMethod: 'destroyed' }));
    const scraps = await listSamples({ projectId: projId, type: 'scrap' });
    expect(scraps).toHaveLength(1);
    expect(scraps[0].type).toBe('scrap');
  });
});
