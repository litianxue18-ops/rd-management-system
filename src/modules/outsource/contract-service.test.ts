import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { hashPassword } from '@/modules/auth/password';
import {
  _resetRegistry,
  registerWorkflow,
} from '@/modules/workflow/registry';
import { submit, approve } from '@/modules/workflow/engine';
import { createSupplier } from './supplier-service';
import {
  createContract,
  updateDraft,
  listContracts,
  setReviewing,
  setActive,
  setRejected,
} from './contract-service';

let deptId: number;
let typeId: number;
let leadId: number;
let rdDirectorId: number;
let techCommitteeId: number;
let financeLeadId: number;
let ceoId: number;
let activeProjectId: number;
let draftProjectId: number;
let supplierId: number;

beforeEach(async () => {
  _resetRegistry();
  registerWorkflow({
    code: 'outsource_contract_v1',
    entityType: 'outsource_contract',
    steps: [
      { name: '研发中心审核', role: R.RD_DIRECTOR },
      { name: '技委会评审', role: R.TECH_COMMITTEE },
      { name: '财务部审核', role: R.FINANCE_LEAD },
      { name: '总经理批准', role: R.CEO },
    ],
    loadEntity: async (id, tx) =>
      tx.outsourceContract.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => setActive(entity.id, tx),
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

  supplierId = (
    await createSupplier({
      code: 'SUP-001',
      name: '上海材料厂',
      contactPerson: '李工',
      contactPhone: '13800000000',
    })
  ).id;
});

function baseInput(
  overrides: Partial<Parameters<typeof createContract>[1]> = {},
): Parameters<typeof createContract>[1] {
  return {
    contractNo: 'CT-2026-001',
    projectId: activeProjectId,
    supplierId,
    title: '高温烧结炉委外加工',
    scope: '按试制方案 A 进行 100kg 烧结加工',
    ipOwnership: '本次加工形成的工艺、数据、模具等成果归我方所有',
    totalAmount: 100000,
    signedDate: new Date('2026-06-01'),
    startDate: new Date('2026-06-05'),
    endDate: new Date('2026-08-30'),
    ...overrides,
  };
}

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

describe('createContract', () => {
  it('happy → status=draft, contractNo 唯一', async () => {
    const c = await createContract(leadId, baseInput());
    expect(c.contractNo).toBe('CT-2026-001');
    expect(c.status).toBe('draft');
    expect(Number(c.totalAmount)).toBe(100000);
    expect(c.projectId).toBe(activeProjectId);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createContract(leadId, baseInput({ projectId: draftProjectId })),
    ).rejects.toThrow(/active/);
  });

  it('amount <= 0 → BusinessError', async () => {
    await expect(
      createContract(leadId, baseInput({ totalAmount: 0 })),
    ).rejects.toThrow(/合同金额/);
  });

  it('contractNo 重复 → BusinessError', async () => {
    await createContract(leadId, baseInput());
    await expect(
      createContract(leadId, baseInput({ contractNo: 'CT-2026-001' })),
    ).rejects.toThrow(/合同号已存在/);
  });
});

describe('updateDraft + listContracts', () => {
  it('updateDraft 改 totalAmount; 非 draft → 拒绝', async () => {
    const c = await createContract(leadId, baseInput());
    const u = await updateDraft(c.id, leadId, { totalAmount: 200000 });
    expect(Number(u.totalAmount)).toBe(200000);

    await prisma.outsourceContract.update({
      where: { id: c.id },
      data: { status: 'reviewing' },
    });
    await expect(
      updateDraft(c.id, leadId, { title: 'x' }),
    ).rejects.toThrow(/仅 draft 可编辑/);
  });

  it('listContracts filter projectId', async () => {
    await createContract(leadId, baseInput());
    const list = await listContracts({ projectId: activeProjectId });
    expect(list).toHaveLength(1);
  });
});

describe('outsource_contract_v1 workflow E2E', () => {
  it('submit → 4 步 approve → status=active', async () => {
    const c = await createContract(leadId, baseInput());

    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'outsource_contract_v1',
      entityId: c.id,
    });
    expect(inst.status).toBe('running');

    const after1 = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after1.status).toBe('reviewing');

    // step1: rd_director
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.requiredRole).toBe(R.RD_DIRECTOR);
    expect(step1.assignedUserId).toBe(rdDirectorId);
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), { stepId: step1.id });

    // step2: tech_committee
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.requiredRole).toBe(R.TECH_COMMITTEE);
    expect(step2.assignedUserId).toBe(techCommitteeId);
    await approve(jwt(techCommitteeId, R.TECH_COMMITTEE), {
      stepId: step2.id,
    });

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

    const after = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: c.id },
    });
    expect(after.status).toBe('active');

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
