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
  createCapitalization,
  setReviewing,
  setApproved,
  setRejected,
} from './capitalization-service';

let deptId: number;
let typeId: number;
let leadId: number;
let rdDirectorId: number;
let techCommitteeId: number;
let financeLeadId: number;
let ceoId: number;
let activeProjectId: number;
let draftProjectId: number;

beforeEach(async () => {
  _resetRegistry();
  registerWorkflow({
    code: 'capitalization_v1',
    entityType: 'capitalization_report',
    steps: [
      { name: '研发中心初评', role: R.RD_DIRECTOR },
      { name: '技委会评审', role: R.TECH_COMMITTEE },
      { name: '财务部审核', role: R.FINANCE_LEAD },
      { name: '总经理批准', role: R.CEO },
    ],
    loadEntity: async (id, tx) =>
      tx.capitalizationReport.findUnique({ where: { id } }),
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
  rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
  techCommitteeId = await makeUser('tech', R.TECH_COMMITTEE);
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
        name: 'p2',
        projectTypeId: typeId,
        departmentId: deptId,
        leadUserId: leadId,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 80000,
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
});

function baseInput(
  overrides: Partial<Parameters<typeof createCapitalization>[1]> = {},
): Parameters<typeof createCapitalization>[1] {
  return {
    projectId: activeProjectId,
    condTechnical: true,
    condIntent: true,
    condUsability: true,
    condMarket: true,
    condResource: true,
    evidenceTechnical: '技术评审纪要 2026-03-15, 试制良率 92%',
    evidenceMarket: '客户 A 已签 LOI, 意向采购 1000 万',
    evidenceResource: '预算批复 200 万, 团队 5 人',
    evidenceCost: '',
    capitalizationAmount: 150000,
    ...overrides,
  };
}

describe('createCapitalization', () => {
  it('happy → status=draft, docNo 自动生成, project 关联正确', async () => {
    const c = await createCapitalization(leadId, baseInput());
    expect(c.status).toBe('draft');
    expect(c.docNo).toMatch(/^CAP-\d{4}-\d{3}$/);
    expect(c.projectId).toBe(activeProjectId);
    expect(c.createdById).toBe(leadId);
    expect(Number(c.capitalizationAmount)).toBe(150000);
  });

  it('5 个条件未全部满足 → BusinessError', async () => {
    await expect(
      createCapitalization(leadId, baseInput({ condMarket: false })),
    ).rejects.toThrow(/5 个资本化条件/);
  });

  it('必备材料 < 3 项 → BusinessError', async () => {
    await expect(
      createCapitalization(
        leadId,
        baseInput({
          evidenceTechnical: '只有这一项',
          evidenceMarket: '',
          evidenceResource: '   ', // 仅空白
          evidenceCost: '',
        }),
      ),
    ).rejects.toThrow(/必备支撑材料/);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createCapitalization(leadId, baseInput({ projectId: draftProjectId })),
    ).rejects.toThrow(/active/);
  });

  it('capitalizationAmount <= 0 → BusinessError', async () => {
    await expect(
      createCapitalization(leadId, baseInput({ capitalizationAmount: 0 })),
    ).rejects.toThrow(/金额/);
  });
});

describe('capitalization_v1 workflow E2E', () => {
  it('submit → 4 步 approve → capitalization=approved', async () => {
    const c = await createCapitalization(leadId, baseInput());

    function jwt(userId: number, role: string) {
      return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
    }

    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'capitalization_v1',
      entityId: c.id,
    });
    expect(inst.status).toBe('running');

    const after1 = await prisma.capitalizationReport.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after1.status).toBe('reviewing');

    // step1: rd_director
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.requiredRole).toBe(R.RD_DIRECTOR);
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), { stepId: step1.id });

    // step2: tech_committee
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.requiredRole).toBe(R.TECH_COMMITTEE);
    await approve(jwt(techCommitteeId, R.TECH_COMMITTEE), { stepId: step2.id });

    // step3: finance_lead
    const step3 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 3 },
    });
    expect(step3.requiredRole).toBe(R.FINANCE_LEAD);
    await approve(jwt(financeLeadId, R.FINANCE_LEAD), { stepId: step3.id });

    // step4: ceo
    const step4 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 4 },
    });
    expect(step4.requiredRole).toBe(R.CEO);
    await approve(jwt(ceoId, R.CEO), {
      stepId: step4.id,
      comments: '同意资本化',
    });

    const after = await prisma.capitalizationReport.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after.status).toBe('approved');
    expect(after.approvedAt).not.toBeNull();

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
