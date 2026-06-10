import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { hashPassword } from '@/modules/auth/password';
import {
  _resetRegistry,
  registerWorkflow,
} from '@/modules/workflow/registry';
import { submit, approve } from '@/modules/workflow/engine';
import { createTrialOrder } from './production-service';
import {
  createTransfer,
  updateDraft,
  listTransfers,
  setReviewing,
  setApproved,
  setRejected,
  statsByProject,
} from './transfer-service';

let deptId: number;
let typeId: number;
let leadId: number;
let memberId: number;
let productionLeadId: number;
let rdDirectorId: number;
let financeLeadId: number;
let ceoId: number;
let activeProjectId: number;
let completedOrderId: number;

beforeEach(async () => {
  _resetRegistry();
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
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => setApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) =>
        setRejected(entity.id, comments, tx),
    },
  });

  deptId = (
    await prisma.department.create({ data: { code: 'rd', name: '研发' } })
  ).id;
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  async function makeUser(username: string, roleCode: string) {
    const role = await prisma.role.upsert({
      where: { code: roleCode },
      update: {},
      create: { code: roleCode, name: roleCode },
    });
    const u = await prisma.user.create({
      data: {
        username,
        employeeId: username.toUpperCase(),
        name: username,
        passwordHash: await hashPassword('p'),
        departmentId: deptId,
      },
    });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: role.id, isPrimary: true },
    });
    return u.id;
  }
  leadId = await makeUser('plead', R.PROJECT_LEAD);
  memberId = await makeUser('member', R.RESEARCHER);
  productionLeadId = await makeUser('prod', R.PRODUCTION_LEAD);
  rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
  financeLeadId = await makeUser('fin', R.FINANCE_LEAD);
  ceoId = await makeUser('ceo', R.CEO);

  activeProjectId = (
    await prisma.project.create({
      data: {
        code: 'P1',
        name: 'p',
        projectTypeId: typeId,
        departmentId: deptId,
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
        createdById: leadId,
        status: 'active',
        members: {
          create: [
            { userId: leadId, role: '负责人', isLead: true },
            { userId: memberId, role: '主研' },
          ],
        },
      },
    })
  ).id;

  // 准备 1 个 completed 试制任务
  const o = await createTrialOrder(leadId, {
    projectId: activeProjectId,
    title: '试制 A 样',
    description: '高温烧结',
    plannedQty: 10,
    plannedUnit: '件',
  });
  await prisma.trialProductionOrder.update({
    where: { id: o.id },
    data: { status: 'completed', productionLeadId, actualQty: 8 },
  });
  completedOrderId = o.id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createTransfer>[1]> = {},
): Parameters<typeof createTransfer>[1] {
  return {
    trialOrderId: completedOrderId,
    laborCost: 1000,
    machineCost: 500,
    materialCost: 300,
    description: '附原始工时 8h + 机台 2h',
    ...overrides,
  };
}

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

describe('createTransfer', () => {
  it('happy → docNo=TCT-..., totalAmount 自动算', async () => {
    const t = await createTransfer(memberId, baseInput());
    expect(t.docNo).toMatch(/^TCT-\d{4}-\d{3}$/);
    expect(t.status).toBe('draft');
    expect(Number(t.totalAmount)).toBe(1800);
    expect(t.projectId).toBe(activeProjectId);
  });

  it('trial_order 非 completed → BusinessError', async () => {
    await prisma.trialProductionOrder.update({
      where: { id: completedOrderId },
      data: { status: 'approved' },
    });
    await expect(createTransfer(memberId, baseInput())).rejects.toThrow(
      /仅完成的试制任务可发起转嫁单/,
    );
  });

  it('负金额 → BusinessError', async () => {
    await expect(
      createTransfer(memberId, baseInput({ laborCost: -1 })),
    ).rejects.toThrow(/金额不能为负/);
  });
});

describe('updateDraft', () => {
  it('总额自动重算', async () => {
    const t = await createTransfer(memberId, baseInput());
    const u = await updateDraft(t.id, memberId, { laborCost: 2000 });
    expect(Number(u.totalAmount)).toBe(2000 + 500 + 300);
  });

  it('非 draft → BusinessError', async () => {
    const t = await createTransfer(memberId, baseInput());
    await prisma.trialCostTransfer.update({
      where: { id: t.id },
      data: { status: 'reviewing' },
    });
    await expect(
      updateDraft(t.id, memberId, { description: '改' }),
    ).rejects.toThrow(/仅 draft 可编辑/);
  });
});

describe('listTransfers + statsByProject', () => {
  it('list filter projectId, stats 按项目聚合', async () => {
    await createTransfer(memberId, baseInput());
    await createTransfer(memberId, baseInput({ laborCost: 100 }));
    const list = await listTransfers({ projectId: activeProjectId });
    expect(list).toHaveLength(2);

    const stats = await statsByProject();
    const ours = stats.find((s) => s.projectId === activeProjectId);
    expect(ours).toBeDefined();
    expect(ours!.count).toBe(2);
    expect(ours!.totalAmount).toBe(1800 + (100 + 500 + 300));
    expect(ours!.settledAmount).toBe(0);
  });
});

describe('trial_transfer_v1 workflow E2E', () => {
  it('submit → 4 步 approve → status=settled + settledAt', async () => {
    const t = await createTransfer(memberId, baseInput());

    const inst = await submit(jwt(memberId, R.RESEARCHER), {
      workflowCode: 'trial_transfer_v1',
      entityId: t.id,
    });
    expect(inst.status).toBe('running');

    const after1 = await prisma.trialCostTransfer.findUniqueOrThrow({
      where: { id: t.id },
    });
    expect(after1.status).toBe('reviewing');

    // step1: production_lead
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.requiredRole).toBe(R.PRODUCTION_LEAD);
    expect(step1.assignedUserId).toBe(productionLeadId);
    await approve(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      stepId: step1.id,
    });

    // step2: rd_director
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.requiredRole).toBe(R.RD_DIRECTOR);
    expect(step2.assignedUserId).toBe(rdDirectorId);
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), { stepId: step2.id });

    // step3: finance_lead
    const step3 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 3 },
    });
    expect(step3.requiredRole).toBe(R.FINANCE_LEAD);
    expect(step3.assignedUserId).toBe(financeLeadId);
    await approve(jwt(financeLeadId, R.FINANCE_LEAD), { stepId: step3.id });

    // step4: ceo
    const step4 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 4 },
    });
    expect(step4.requiredRole).toBe(R.CEO);
    expect(step4.assignedUserId).toBe(ceoId);
    await approve(jwt(ceoId, R.CEO), { stepId: step4.id, comments: '同意' });

    const after = await prisma.trialCostTransfer.findUniqueOrThrow({
      where: { id: t.id },
    });
    expect(after.status).toBe('settled');
    expect(after.settledAt).not.toBeNull();

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
