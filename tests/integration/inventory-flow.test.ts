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
import { getBalance } from '@/modules/inventory/ledger';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';

/**
 * 内联注册 (跟 monthly-flow.test.ts 一样的 pattern), 因为 vitest 模块缓存让
 * `import '@/modules/inventory/workflow'` + _resetRegistry() 失效.
 */
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

beforeEach(async () => {
  _resetRegistry();
  registerMaterialRequestV1();
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('库存端到端: 入库 → 领料 → 2 步审 → 出库 → ledger 平', () => {
  it('完整链路: 100 入库 → 30 申请 → 2 步通过 → 出 30 → ledger 平 + 余 70', async () => {
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
      const r = await prisma.role.findUniqueOrThrow({
        where: { code: role },
      });
      await prisma.userRole.create({
        data: { userId: u.id, roleId: r.id, isPrimary: true },
      });
      return u.id;
    }

    const leadId = await makeUser('plead', R.PROJECT_LEAD);
    const researcherId = await makeUser('res', R.RESEARCHER);
    const rdId = await makeUser('rddir', R.RD_DIRECTOR);
    const wkId = await makeUser('wk', R.WAREHOUSE_KEEPER);

    // 仓库 + 物料
    const wh = await prisma.warehouse.create({
      data: { code: 'wh-main', name: '主仓' },
    });
    const mat = await prisma.material.create({
      data: { code: 'M-X', name: 'BOPET 切片', unit: 'kg' },
    });

    // active 项目 (researcher 是 member, lead 自动加进 leadId)
    const project = await createProject(leadId, {
      name: 'E2E 库存',
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
    // 项目需为 active 才能领料
    await prisma.project.update({
      where: { id: project.id },
      data: { status: 'active' },
    });

    // 1. 仓管员入库 100kg, unit price 20
    await createInbound(wkId, {
      materialId: mat.id,
      warehouseId: wh.id,
      quantity: 100,
      unitPrice: 20,
      supplier: 'ACME',
      receivedAt: new Date('2026-06-01'),
    });
    expect(await getBalance(mat.id, wh.id)).toBe(100);

    // 2. 研发员发起领料 30
    const out = await createOutbound(researcherId, {
      projectId: project.id,
      materialId: mat.id,
      warehouseId: wh.id,
      requestedQty: 30,
      purpose: '中试测试',
    });
    expect(out.status).toBe('draft');
    expect(Number(out.requestedQty)).toBe(30);

    // 3. submit workflow
    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });
    const inst = await submit(jwt(researcherId, R.RESEARCHER), {
      workflowCode: 'material_request_v1',
      entityId: out.id,
    });
    expect(inst.status).toBe('running');

    // 4. 验 outbound.status='reviewing' + step 1 assignedUserId === lead
    const afterSubmit = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: out.id },
    });
    expect(afterSubmit.status).toBe('reviewing');
    let pending = await listTodo(jwt(leadId, R.PROJECT_LEAD));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('项目负责人审核');

    // 5. 项目负责人 approve step 1
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: pending[0].stepId });

    // 6. 验 step 2 生成, assignedUserId === rdId (唯一 rd_director)
    pending = await listTodo(jwt(rdId, R.RD_DIRECTOR));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('研发中心审批');

    // 7. rd_director approve step 2
    await approve(jwt(rdId, R.RD_DIRECTOR), { stepId: pending[0].stepId });

    // 8. 验 outbound.status='approved'
    const afterApprove = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: out.id },
    });
    expect(afterApprove.status).toBe('approved');

    // 9. 仓管员 issueOutbound qty 30
    const issued = await issueOutbound(wkId, out.id, 30);
    expect(issued.status).toBe('issued');
    expect(Number(issued.issuedQty)).toBe(30);

    // 10. 验 ledger 2 条: inbound +100, outbound -30
    const ledgerRows = await prisma.inventoryLedger.findMany({
      where: { materialId: mat.id, warehouseId: wh.id },
      orderBy: { id: 'asc' },
    });
    expect(ledgerRows).toHaveLength(2);
    expect(ledgerRows[0].changeType).toBe('inbound');
    expect(Number(ledgerRows[0].changeQty)).toBe(100);
    expect(Number(ledgerRows[0].balanceAfter)).toBe(100);
    expect(ledgerRows[1].changeType).toBe('outbound');
    expect(Number(ledgerRows[1].changeQty)).toBe(-30);
    expect(Number(ledgerRows[1].balanceAfter)).toBe(70);

    // 11. 验 getBalance = 70
    expect(await getBalance(mat.id, wh.id)).toBe(70);
  });
});
