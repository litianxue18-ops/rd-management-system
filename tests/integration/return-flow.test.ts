import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { createProject } from '@/modules/project/project-service';
import { createInbound } from '@/modules/inventory/inbound-service';
import {
  createOutbound,
  issueOutbound,
  setReviewing,
  setApproved,
  setRejected,
} from '@/modules/inventory/outbound-service';
import { returnOutbound } from '@/modules/inventory/return-service';
import { getBalance } from '@/modules/inventory/ledger';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';

function registerMaterialRequestV1() {
  registerWorkflow({
    code: 'material_request_v1',
    entityType: 'material_request',
    steps: [
      {
        name: '项目负责人审核',
        role: R.PROJECT_LEAD,
        resolveAssignee: async (entity, tx) => {
          if (!entity?.projectId) return null;
          const proj = await tx.project.findUnique({
            where: { id: entity.projectId },
          });
          return proj?.leadUserId ?? null;
        },
      },
      { name: '研发中心审批', role: R.RD_DIRECTOR },
    ],
    loadEntity: async (id, tx) =>
      tx.inventoryOutbound.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => {
        const lastStep = await tx.approvalStep.findFirst({
          where: {
            instance: {
              entityType: 'material_request',
              entityId: entity.id,
            },
            status: 'approved',
          },
          orderBy: { stepIndex: 'desc' },
        });
        await setApproved(entity.id, tx, lastStep?.actedBy ?? entity.requesterId);
      },
      onRejected: async (entity, comments, tx) =>
        setRejected(entity.id, comments, tx),
    },
  });
}

/** seed 一整套: 角色 + 矩阵 + 部门 + 4 用户 + 仓库 + 物料 + active 项目, 返回所有 id. */
async function seedFullStack() {
  _resetRegistry();
  registerMaterialRequestV1();
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);

  const dept = await prisma.department.create({
    data: { code: 'rd', name: '研发' },
  });
  const typeRow = await prisma.projectType.create({
    data: { code: 'MAT', name: '新材料' },
  });

  async function makeUser(name: string, role: string) {
    const u = await prisma.user.create({
      data: {
        username: name,
        employeeId: name.toUpperCase(),
        name,
        passwordHash: await hashPassword('p'),
        departmentId: dept.id,
      },
    });
    const r = await prisma.role.findUniqueOrThrow({ where: { code: role } });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: r.id, isPrimary: true },
    });
    return u.id;
  }

  const leadId = await makeUser('plead', R.PROJECT_LEAD);
  const researcherId = await makeUser('res', R.RESEARCHER);
  const rdId = await makeUser('rddir', R.RD_DIRECTOR);
  const wkId = await makeUser('wk', R.WAREHOUSE_KEEPER);

  const wh = await prisma.warehouse.create({
    data: { code: 'wh-main', name: '主仓' },
  });
  const mat = await prisma.material.create({
    data: { code: 'M-X', name: 'BOPET 切片', unit: 'kg' },
  });

  const project = await createProject(leadId, {
    name: 'E2E 退库',
    projectTypeId: typeRow.id,
    departmentId: dept.id,
    leadUserId: leadId,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2027-01-01'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    members: [{ userId: researcherId, role: '主研' }],
  });
  await prisma.project.update({
    where: { id: project.id },
    data: { status: 'active' },
  });

  return { leadId, researcherId, rdId, wkId, projectId: project.id, matId: mat.id, whId: wh.id };
}

/** Helper: 走完入库 + 申请 + 2 步审 + 出库 30, 返回 outboundId. */
async function setupIssuedOutbound(ids: Awaited<ReturnType<typeof seedFullStack>>) {
  await createInbound(ids.wkId, {
    materialId: ids.matId,
    warehouseId: ids.whId,
    quantity: 100,
    receivedAt: new Date('2026-06-01'),
  });
  const out = await createOutbound(ids.researcherId, {
    projectId: ids.projectId,
    materialId: ids.matId,
    warehouseId: ids.whId,
    requestedQty: 30,
    purpose: '中试测试',
  });
  const jwt = (id: number, role: string) => ({
    userId: id,
    roles: [role],
    primaryRole: role,
    tokenVersion: 0,
  });
  await submit(jwt(ids.researcherId, R.RESEARCHER), {
    workflowCode: 'material_request_v1',
    entityId: out.id,
  });
  let pending = await listTodo(jwt(ids.leadId, R.PROJECT_LEAD));
  await approve(jwt(ids.leadId, R.PROJECT_LEAD), { stepId: pending[0].stepId });
  pending = await listTodo(jwt(ids.rdId, R.RD_DIRECTOR));
  await approve(jwt(ids.rdId, R.RD_DIRECTOR), { stepId: pending[0].stepId });
  await issueOutbound(ids.wkId, out.id, 30);
  return out.id;
}

describe('退库端到端: 部分退 → 全退 状态机', () => {
  beforeEach(async () => {
    // seedFullStack 自己处理 reset + seed, beforeEach 留空即可
  });

  it('issued → 退 10 (仍 issued) → 再退 20 (returned 全退), ledger / balance 同步', async () => {
    const ids = await seedFullStack();
    const outboundId = await setupIssuedOutbound(ids);

    expect(await getBalance(ids.matId, ids.whId)).toBe(70);

    // 1. 第一次退 10
    await returnOutbound(ids.wkId, outboundId, 10, '没用完');

    const afterFirst = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: outboundId },
    });
    expect(Number(afterFirst.returnedQty)).toBe(10);
    expect(afterFirst.status).toBe('issued'); // 未全退保持 issued

    // ledger 加一条 return +10
    const ledgerAfter1 = await prisma.inventoryLedger.findMany({
      where: { materialId: ids.matId, warehouseId: ids.whId, changeType: 'return' },
    });
    expect(ledgerAfter1).toHaveLength(1);
    expect(Number(ledgerAfter1[0].changeQty)).toBe(10);

    expect(await getBalance(ids.matId, ids.whId)).toBe(80);

    // 2. 第二次退 20 (累计 30 = issued, 全退)
    await returnOutbound(ids.wkId, outboundId, 20);

    const afterSecond = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: outboundId },
    });
    expect(Number(afterSecond.returnedQty)).toBe(30);
    expect(afterSecond.status).toBe('returned'); // 全退转 returned

    expect(await getBalance(ids.matId, ids.whId)).toBe(100);

    // 3. 验所有 ledger: inbound +100 / outbound -30 / return +10 / return +20 = 4 条
    const all = await prisma.inventoryLedger.findMany({
      where: { materialId: ids.matId, warehouseId: ids.whId },
      orderBy: { id: 'asc' },
    });
    expect(all).toHaveLength(4);
    expect(all.map((r) => r.changeType)).toEqual([
      'inbound',
      'outbound',
      'return',
      'return',
    ]);
    expect(all.map((r) => Number(r.balanceAfter))).toEqual([100, 70, 80, 100]);
  });

  it('已 returned 状态不可再退库', async () => {
    const ids = await seedFullStack();
    const outboundId = await setupIssuedOutbound(ids);

    await returnOutbound(ids.wkId, outboundId, 30); // 全退
    const o = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: outboundId },
    });
    expect(o.status).toBe('returned');

    // 再退应抛错 (仅 issued 可退)
    await expect(returnOutbound(ids.wkId, outboundId, 1)).rejects.toThrow(
      /仅已出库.*可退库/,
    );
  });
});
