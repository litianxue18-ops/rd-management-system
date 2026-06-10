import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { createProject } from '@/modules/project/project-service';
import {
  createTrialOrder,
  completeOrder,
  setReviewing as orderSetReviewing,
  setApproved as orderSetApproved,
  setRejected as orderSetRejected,
} from '@/modules/trial/production-service';
import {
  createTransfer,
  setReviewing as transferSetReviewing,
  setApproved as transferSetApproved,
  setRejected as transferSetRejected,
} from '@/modules/trial/transfer-service';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import {
  _resetRegistry,
  registerWorkflow,
} from '@/modules/workflow/registry';

/**
 * 内联注册 2 个 workflow (跟其它 E2E 一样的 pattern, 绕开 vitest 模块缓存).
 */
function registerTrialWorkflows() {
  registerWorkflow({
    code: 'trial_production_v1',
    entityType: 'trial_production_order',
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
      { name: '生产部接单', role: R.PRODUCTION_LEAD },
    ],
    loadEntity: async (id, tx) =>
      tx.trialProductionOrder.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => orderSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => {
        const lastStep = await tx.approvalStep.findFirst({
          where: {
            instance: {
              entityType: 'trial_production_order',
              entityId: entity.id,
            },
            status: 'approved',
          },
          orderBy: { stepIndex: 'desc' },
        });
        await orderSetApproved(entity.id, lastStep?.actedBy ?? null, tx);
      },
      onRejected: async (entity, comments, tx) =>
        orderSetRejected(entity.id, comments, tx),
    },
  });

  registerWorkflow({
    code: 'trial_transfer_v1',
    entityType: 'trial_cost_transfer',
    steps: [
      { name: '生产部确认', role: R.PRODUCTION_LEAD },
      { name: '研发负责人确认', role: R.RD_DIRECTOR },
      { name: '财务部审核', role: R.FINANCE_LEAD },
      { name: '总经理批准', role: R.CEO },
    ],
    loadEntity: async (id, tx) =>
      tx.trialCostTransfer.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => transferSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => transferSetApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) =>
        transferSetRejected(entity.id, comments, tx),
    },
  });
}

beforeEach(async () => {
  _resetRegistry();
  registerTrialWorkflows();
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('试制端到端: 任务 2 步 → 接单 → 完成 → 转嫁 4 步 → 项目费用归集', () => {
  it('lead 创建 → 2 步 approve → 生产完成 → transfer 4 步 → trial-cost.total=8000', async () => {
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
    const productionLeadId = await makeUser('prod', R.PRODUCTION_LEAD);
    const rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
    const financeLeadId = await makeUser('fin', R.FINANCE_LEAD);
    const ceoId = await makeUser('ceo', R.CEO);

    // active 项目
    const project = await createProject(leadId, {
      name: 'E2E 试制',
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

    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });

    // 1. 项目负责人创建试制任务
    const order = await createTrialOrder(leadId, {
      projectId: project.id,
      title: '试制 A 样 100 件',
      description: '高温烧结 + 涂层',
      plannedQty: 100,
      plannedUnit: '件',
    });
    expect(order.status).toBe('draft');

    // 2. submit 试制工作流
    const inst1 = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'trial_production_v1',
      entityId: order.id,
    });
    expect(inst1.status).toBe('running');

    // 3. 项目负责人 approve step 1
    let todos = await listTodo(jwt(leadId, R.PROJECT_LEAD));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('项目负责人审核');
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: todos[0].stepId });

    // 4. 生产部 approve step 2 → status=approved + productionLeadId 记
    todos = await listTodo(jwt(productionLeadId, R.PRODUCTION_LEAD));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('生产部接单');
    await approve(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      stepId: todos[0].stepId,
    });

    const orderAfterApproval = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(orderAfterApproval.status).toBe('approved');
    expect(orderAfterApproval.productionLeadId).toBe(productionLeadId);

    // 5. 生产部 completeOrder
    await completeOrder(
      productionLeadId,
      order.id,
      80,
      new Date('2026-07-15'),
    );
    const completedOrder = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(completedOrder.status).toBe('completed');
    expect(Number(completedOrder.actualQty)).toBe(80);

    // 6. 生产部 createTransfer (8000)
    const transfer = await createTransfer(productionLeadId, {
      trialOrderId: order.id,
      laborCost: 5000,
      machineCost: 2000,
      materialCost: 1000,
      description: '人工 5000 + 机台 2000 + 材料 1000',
    });
    expect(transfer.status).toBe('draft');
    expect(Number(transfer.totalAmount)).toBe(8000);

    // 7. submit transfer workflow
    const inst2 = await submit(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      workflowCode: 'trial_transfer_v1',
      entityId: transfer.id,
    });
    expect(inst2.status).toBe('running');

    // 8. 4 步依次 approve
    // step 1: production_lead
    todos = await listTodo(jwt(productionLeadId, R.PRODUCTION_LEAD));
    const s1 = todos.find((t) => t.entityType === 'trial_cost_transfer');
    expect(s1?.stepName).toBe('生产部确认');
    await approve(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      stepId: s1!.stepId,
    });

    // step 2: rd_director
    todos = await listTodo(jwt(rdDirectorId, R.RD_DIRECTOR));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('研发负责人确认');
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), {
      stepId: todos[0].stepId,
    });

    // step 3: finance_lead
    todos = await listTodo(jwt(financeLeadId, R.FINANCE_LEAD));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('财务部审核');
    await approve(jwt(financeLeadId, R.FINANCE_LEAD), {
      stepId: todos[0].stepId,
    });

    // step 4: ceo
    todos = await listTodo(jwt(ceoId, R.CEO));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('总经理批准');
    await approve(jwt(ceoId, R.CEO), {
      stepId: todos[0].stepId,
      comments: '同意',
    });

    // 9. 验 transfer.status='settled'
    const settled = await prisma.trialCostTransfer.findUniqueOrThrow({
      where: { id: transfer.id },
    });
    expect(settled.status).toBe('settled');
    expect(settled.settledAt).not.toBeNull();

    // 10. 验 trial-cost API total = 8000 (用 SQL 直接验证 API 逻辑)
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        t.id, t.total_amount::text AS total_amount
      FROM trial_cost_transfer t
      WHERE t.project_id = ${project.id} AND t.status = 'settled'
    `;
    const totalTrialCost = rows.reduce(
      (acc, r) => acc + Number(r.total_amount),
      0,
    );
    expect(totalTrialCost).toBe(8000);
  });
});
