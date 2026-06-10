import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { hashPassword } from '@/modules/auth/password';
import {
  _resetRegistry,
  registerWorkflow,
} from '@/modules/workflow/registry';
import { submit, approve } from '@/modules/workflow/engine';
import {
  createTrialOrder,
  updateDraft,
  completeOrder,
  setReviewing,
  setApproved,
  setRejected,
} from './production-service';

let deptId: number;
let typeId: number;
let leadId: number;
let memberId: number;
let outsiderId: number;
let productionLeadId: number;
let activeProjectId: number;
let draftProjectId: number;

beforeEach(async () => {
  _resetRegistry();
  // inline register, 与 outbound-service.test 同模式 (registry 是模块级单例)
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
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
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
        await setApproved(entity.id, lastStep?.actedBy ?? null, tx);
      },
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
  outsiderId = await makeUser('out', R.RESEARCHER);
  productionLeadId = await makeUser('prod', R.PRODUCTION_LEAD);

  const baseProj = {
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
  };
  activeProjectId = (
    await prisma.project.create({
      data: {
        ...baseProj,
        code: 'P1',
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
  draftProjectId = (
    await prisma.project.create({
      data: { ...baseProj, code: 'P2-draft', status: 'draft' },
    })
  ).id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createTrialOrder>[1]> = {},
): Parameters<typeof createTrialOrder>[1] {
  return {
    projectId: activeProjectId,
    title: '试制 A 样',
    description: '工艺要求: 高温烧结 800°C',
    plannedQty: 10,
    plannedUnit: '件',
    ...overrides,
  };
}

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

describe('createTrialOrder', () => {
  it('happy path → docNo=TPO-..., status=draft', async () => {
    const o = await createTrialOrder(leadId, baseInput());
    expect(o.docNo).toMatch(/^TPO-\d{4}-\d{3}$/);
    expect(o.status).toBe('draft');
    expect(o.requesterId).toBe(leadId);
    expect(Number(o.plannedQty)).toBe(10);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createTrialOrder(leadId, baseInput({ projectId: draftProjectId })),
    ).rejects.toThrow(/仅 active 项目可创建试制任务/);
  });

  it('非项目成员 → BusinessError', async () => {
    await expect(createTrialOrder(outsiderId, baseInput())).rejects.toThrow(
      /仅项目成员可发起试制任务/,
    );
  });

  it('plannedQty <= 0 → BusinessError', async () => {
    await expect(
      createTrialOrder(leadId, baseInput({ plannedQty: 0 })),
    ).rejects.toThrow(/计划数量必须 > 0/);
  });
});

describe('updateDraft', () => {
  it('非 draft → BusinessError', async () => {
    const o = await createTrialOrder(leadId, baseInput());
    await prisma.trialProductionOrder.update({
      where: { id: o.id },
      data: { status: 'reviewing' },
    });
    await expect(
      updateDraft(o.id, leadId, { title: '改标题' }),
    ).rejects.toThrow(/仅 draft 可编辑/);
  });
});

describe('completeOrder', () => {
  it('approved → completed, 记 actualQty + actualEnd', async () => {
    const o = await createTrialOrder(leadId, baseInput());
    await prisma.trialProductionOrder.update({
      where: { id: o.id },
      data: { status: 'approved', productionLeadId },
    });
    const end = new Date('2026-06-10');
    await completeOrder(productionLeadId, o.id, 8, end);
    const after = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after.status).toBe('completed');
    expect(Number(after.actualQty)).toBe(8);
    expect(after.actualEnd).not.toBeNull();
    expect(after.actualStart).not.toBeNull();
  });

  it('非领单生产部 → BusinessError', async () => {
    const o = await createTrialOrder(leadId, baseInput());
    await prisma.trialProductionOrder.update({
      where: { id: o.id },
      data: { status: 'approved', productionLeadId },
    });
    await expect(
      completeOrder(outsiderId, o.id, 8, new Date()),
    ).rejects.toThrow(/仅领单生产部可完成/);
  });
});

describe('trial_production_v1 workflow E2E', () => {
  it('submit → step1 lead → approve → step2 production_lead → approve → status=approved + productionLeadId 设', async () => {
    // member 申请 (不是 lead)
    const o = await createTrialOrder(memberId, baseInput());

    const inst = await submit(jwt(memberId, R.RESEARCHER), {
      workflowCode: 'trial_production_v1',
      entityId: o.id,
    });
    expect(inst.status).toBe('running');

    // order 应 reviewing (onSubmit)
    const after1 = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after1.status).toBe('reviewing');

    // step1: 项目负责人 (=leadId)
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.assignedUserId).toBe(leadId);
    expect(step1.requiredRole).toBe(R.PROJECT_LEAD);

    await approve(jwt(leadId, R.PROJECT_LEAD), {
      stepId: step1.id,
      comments: '同意',
    });

    // step2: 生产部 (= productionLeadId, 候选池里唯一)
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.assignedUserId).toBe(productionLeadId);
    expect(step2.requiredRole).toBe(R.PRODUCTION_LEAD);

    await approve(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      stepId: step2.id,
      comments: '接单',
    });

    // 最终: status=approved, productionLeadId = step2 actedBy
    const after2 = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after2.status).toBe('approved');
    expect(after2.productionLeadId).toBe(productionLeadId);

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
