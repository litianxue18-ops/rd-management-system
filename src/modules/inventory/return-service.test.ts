import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createInbound } from './inbound-service';
import { createOutbound, issueOutbound } from './outbound-service';
import { returnOutbound } from './return-service';
import { getBalance } from './ledger';

let deptId: number;
let typeId: number;
let leadId: number;
let opId: number;
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

  // 入库 + 领料(approved) + 出库 → 状态机走到 issued, 准备退库
  await createInbound(opId, {
    materialId: matA,
    warehouseId: whMain,
    quantity: 100,
    receivedAt: new Date(),
  });
});

async function makeIssuedOutbound(qty = 10) {
  const o = await createOutbound(leadId, {
    projectId,
    materialId: matA,
    warehouseId: whMain,
    requestedQty: qty,
    purpose: '试制',
  });
  // 直接置 approved 跳过 workflow (本测试聚焦 return)
  await prisma.inventoryOutbound.update({
    where: { id: o.id },
    data: { status: 'approved' },
  });
  return issueOutbound(opId, o.id);
}

describe('returnOutbound', () => {
  it('部分退库 → returnedQty 增加 + status 保持 issued + ledger 写 +qty', async () => {
    const o = await makeIssuedOutbound(10);
    expect(o.status).toBe('issued');
    expect(await getBalance(matA, whMain)).toBe(90); // 100 - 10

    const ret = await returnOutbound(opId, o.id, 3, '少用了');
    expect(Number(ret.quantity)).toBe(3);

    const after = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after.status).toBe('issued');
    expect(Number(after.returnedQty)).toBe(3);

    expect(await getBalance(matA, whMain)).toBe(93); // 90 + 3

    const ledger = await prisma.inventoryLedger.findFirstOrThrow({
      where: { sourceType: 'return', sourceId: ret.id },
    });
    expect(Number(ledger.changeQty)).toBe(3);
    expect(ledger.changeType).toBe('return');
  });

  it('全退 → status=returned + 余量恢复到出库前', async () => {
    const o = await makeIssuedOutbound(10);
    await returnOutbound(opId, o.id, 4);
    await returnOutbound(opId, o.id, 6); // 累积 10 = issued

    const after = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after.status).toBe('returned');
    expect(Number(after.returnedQty)).toBe(10);
    expect(await getBalance(matA, whMain)).toBe(100); // 完全还原
  });

  it('超退 → BusinessError', async () => {
    const o = await makeIssuedOutbound(10);
    await returnOutbound(opId, o.id, 7);
    await expect(returnOutbound(opId, o.id, 5)).rejects.toThrow(
      /退库数量超过可退余量/,
    );
    // 数量 0 / 负数
    await expect(returnOutbound(opId, o.id, 0)).rejects.toThrow(
      /退库数量必须 > 0/,
    );
    // 状态非 issued
    const o2 = await createOutbound(leadId, {
      projectId,
      materialId: matA,
      warehouseId: whMain,
      requestedQty: 1,
      purpose: 'x',
    });
    await expect(returnOutbound(opId, o2.id, 1)).rejects.toThrow(
      /仅已出库的领料单可退库/,
    );
  });
});
