import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createInbound } from './inbound-service';
import { createOutbound, issueOutbound } from './outbound-service';
import { returnOutbound } from './return-service';
import {
  createUsage,
  listUsageByOutbound,
  computeOutboundBalance,
} from './usage-service';

let deptId: number;
let typeId: number;
let leadId: number;
let opId: number;
let outsiderId: number;
let matA: number;
let whMain: number;
let projectId: number;

beforeEach(async () => {
  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发' } }))
    .id;
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  async function makeUser(username: string) {
    return (
      await prisma.user.create({
        data: {
          username,
          employeeId: username.toUpperCase(),
          name: username,
          passwordHash: 'x',
          departmentId: deptId,
        },
      })
    ).id;
  }
  leadId = await makeUser('lead');
  opId = await makeUser('op');
  outsiderId = await makeUser('outsider');

  matA = (
    await prisma.material.create({
      data: { code: 'M-A', name: '物料 A', unit: 'kg' },
    })
  ).id;
  whMain = (
    await prisma.warehouse.create({ data: { code: 'wh-main', name: '主仓' } })
  ).id;

  projectId = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: leadId,
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 100000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        members: { create: [{ userId: leadId, role: '负责人', isLead: true }] },
      },
    })
  ).id;

  await createInbound(opId, {
    materialId: matA,
    warehouseId: whMain,
    quantity: 100,
    receivedAt: new Date(),
  });
});

/** 领料人=leadId 的已出库领料单. */
async function makeIssuedOutbound(qty = 10) {
  const o = await createOutbound(leadId, {
    projectId,
    materialId: matA,
    warehouseId: whMain,
    requestedQty: qty,
    purpose: '试制',
  });
  await prisma.inventoryOutbound.update({
    where: { id: o.id },
    data: { status: 'approved' },
  });
  return issueOutbound(opId, o.id);
}

describe('createUsage', () => {
  it('happy: 领料人登记一笔消耗 → 写 log, projectId/materialId 冗余 from outbound', async () => {
    const o = await makeIssuedOutbound(10);
    const log = await createUsage(leadId, {
      outboundId: o.id,
      usageDate: new Date('2026-06-01'),
      quantity: 3,
      eventType: 'testing',
      description: '强度测试',
    });
    expect(Number(log.quantity)).toBe(3);
    expect(log.projectId).toBe(projectId);
    expect(log.materialId).toBe(matA);
    expect(log.operatorId).toBe(leadId);

    const logs = await listUsageByOutbound(o.id);
    expect(logs).toHaveLength(1);
  });

  it('超过在手量 → BusinessError', async () => {
    const o = await makeIssuedOutbound(10);
    await createUsage(leadId, {
      outboundId: o.id,
      usageDate: new Date('2026-06-01'),
      quantity: 7,
      eventType: 'testing',
      description: 'x',
    });
    // 已消耗 7, 在手 3, 再消耗 5 → 超
    await expect(
      createUsage(leadId, {
        outboundId: o.id,
        usageDate: new Date('2026-06-02'),
        quantity: 5,
        eventType: 'loss',
        description: 'x',
      }),
    ).rejects.toThrow(/超过在手量/);
  });

  it('非领料人非成员 → BusinessError', async () => {
    const o = await makeIssuedOutbound(10);
    await expect(
      createUsage(outsiderId, {
        outboundId: o.id,
        usageDate: new Date('2026-06-01'),
        quantity: 1,
        eventType: 'other',
        description: 'x',
      }),
    ).rejects.toThrow(/仅领料人或项目成员可登记消耗/);
  });

  it('未出库领料单 → BusinessError', async () => {
    const o = await createOutbound(leadId, {
      projectId,
      materialId: matA,
      warehouseId: whMain,
      requestedQty: 5,
      purpose: 'x',
    });
    await expect(
      createUsage(leadId, {
        outboundId: o.id,
        usageDate: new Date('2026-06-01'),
        quantity: 1,
        eventType: 'other',
        description: 'x',
      }),
    ).rejects.toThrow(/仅已出库的领料单可登记消耗/);
  });
});

describe('computeOutboundBalance', () => {
  it('在手 = 已出 - 已退 - 已消耗', async () => {
    const o = await makeIssuedOutbound(10);
    await returnOutbound(opId, o.id, 2); // 退 2
    await createUsage(leadId, {
      outboundId: o.id,
      usageDate: new Date('2026-06-01'),
      quantity: 3,
      eventType: 'testing',
      description: 'x',
    }); // 消耗 3

    const bal = await computeOutboundBalance(o.id);
    expect(bal.issued).toBe(10);
    expect(bal.returned).toBe(2);
    expect(bal.consumed).toBe(3);
    expect(bal.inHand).toBe(5); // 10 - 2 - 3
  });
});
