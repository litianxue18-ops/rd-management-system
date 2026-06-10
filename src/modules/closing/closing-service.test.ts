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
  createClosing,
  setReviewing,
  setApproved,
  setRejected,
} from './closing-service';

let deptId: number;
let typeId: number;
let leadId: number;
let otherLeadId: number;
let rdDirectorId: number;
let techCommitteeId: number;
let activeProjectId: number;
let draftProjectId: number;
let activeProjectOtherLeadId: number;

beforeEach(async () => {
  _resetRegistry();
  registerWorkflow({
    code: 'closing_report_v1',
    entityType: 'closing_report',
    steps: [
      {
        name: '项目负责人',
        role: R.PROJECT_LEAD,
        resolveAssignee: async (entity, tx) => {
          const proj = await tx.project.findUnique({
            where: { id: entity.projectId },
            select: { leadUserId: true },
          });
          return proj?.leadUserId ?? null;
        },
      },
      { name: '研发中心', role: R.RD_DIRECTOR },
      { name: '技委会', role: R.TECH_COMMITTEE },
    ],
    loadEntity: async (id, tx) =>
      tx.closingReport.findUnique({ where: { id } }),
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
  otherLeadId = await makeUser('plead2', R.PROJECT_LEAD);
  rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
  techCommitteeId = await makeUser('tech', R.TECH_COMMITTEE);

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
        budget: 200000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        status: 'active',
      },
    })
  ).id;

  draftProjectId = (
    await prisma.project.create({
      data: {
        code: 'P2',
        name: 'draft p',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: leadId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 50000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        status: 'draft',
      },
    })
  ).id;

  activeProjectOtherLeadId = (
    await prisma.project.create({
      data: {
        code: 'P3',
        name: 'p other',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: otherLeadId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 100000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: otherLeadId,
        status: 'active',
      },
    })
  ).id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createClosing>[1]> = {},
): Parameters<typeof createClosing>[1] {
  return {
    projectId: activeProjectId,
    basicSummary: '项目周期 2026-01 ~ 2027-01, 团队 5 人',
    goalReview: '目标 1/2/3 已达成, 目标 4 部分完成',
    outputs: '专利 1 项, 论文 2 篇, 试制样品 50 件',
    budgetReview: '预算 20 万, 实际 18 万, 节余 2 万',
    lessons: '前期方案验证不充分, 后期返工 2 次',
    conversionPlan: '建议 2027 Q1 启动产业化',
    ...overrides,
  };
}

describe('createClosing', () => {
  it('happy → status=draft, docNo 自动生成, project 关联正确', async () => {
    const c = await createClosing(leadId, baseInput());
    expect(c.status).toBe('draft');
    expect(c.docNo).toMatch(/^CL-\d{4}-\d{3}$/);
    expect(c.projectId).toBe(activeProjectId);
    expect(c.createdById).toBe(leadId);
  });

  it('非 leadUser 创建 → BusinessError', async () => {
    await expect(
      createClosing(otherLeadId, baseInput({ projectId: activeProjectId })),
    ).rejects.toThrow(/项目负责人/);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createClosing(leadId, baseInput({ projectId: draftProjectId })),
    ).rejects.toThrow(/active/);
  });

  it('重复创建 → BusinessError DUPLICATE', async () => {
    await createClosing(leadId, baseInput());
    await expect(createClosing(leadId, baseInput())).rejects.toThrow(
      /已有结项报告/,
    );
  });
});

describe('closing_report_v1 workflow E2E', () => {
  it('submit → 3 步 approve → closing=approved, project.status=closed', async () => {
    const c = await createClosing(leadId, baseInput());

    function jwt(userId: number, role: string) {
      return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
    }

    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'closing_report_v1',
      entityId: c.id,
    });
    expect(inst.status).toBe('running');

    const after1 = await prisma.closingReport.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after1.status).toBe('reviewing');

    // step1: project_lead (assignee = leadId via resolveAssignee)
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.requiredRole).toBe(R.PROJECT_LEAD);
    expect(step1.assignedUserId).toBe(leadId);
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: step1.id });

    // step2: rd_director
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.requiredRole).toBe(R.RD_DIRECTOR);
    expect(step2.assignedUserId).toBe(rdDirectorId);
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), { stepId: step2.id });

    // step3: tech_committee
    const step3 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 3 },
    });
    expect(step3.requiredRole).toBe(R.TECH_COMMITTEE);
    expect(step3.assignedUserId).toBe(techCommitteeId);
    await approve(jwt(techCommitteeId, R.TECH_COMMITTEE), {
      stepId: step3.id,
      comments: '同意结项',
    });

    const after = await prisma.closingReport.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after.status).toBe('approved');
    expect(after.approvedAt).not.toBeNull();

    const proj = await prisma.project.findUniqueOrThrow({
      where: { id: activeProjectId },
    });
    expect(proj.status).toBe('closed');

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
