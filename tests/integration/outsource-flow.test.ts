import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { createProject } from '@/modules/project/project-service';
import { createSupplier } from '@/modules/outsource/supplier-service';
import {
  createContract,
  setReviewing,
  setActive,
  setRejected,
} from '@/modules/outsource/contract-service';
import { registerPayment } from '@/modules/outsource/payment-service';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import {
  _resetRegistry,
  registerWorkflow,
} from '@/modules/workflow/registry';

function registerOutsourceWorkflow() {
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
}

beforeEach(async () => {
  _resetRegistry();
  registerOutsourceWorkflow();
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('委外端到端: 供应商 → 合同 4 步 → 付款 → 项目费用归集', () => {
  it('合同 100000 → 4 步 active → 付 60000 仍 active → 再付 40000 → completed; outsource-cost.totalPaid=100000', async () => {
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
    const rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
    const techCommitteeId = await makeUser('tech', R.TECH_COMMITTEE);
    const financeLeadId = await makeUser('fin', R.FINANCE_LEAD);
    const ceoId = await makeUser('ceo', R.CEO);

    // active 项目
    const project = await createProject(leadId, {
      name: 'E2E 委外',
      projectTypeId: typeRow.id,
      departmentId: dept.id,
      leadUserId: leadId,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2027-01-01'),
      budget: 500000,
      background: 'x',
      goals: 'x',
      techPlan: 'x',
      schedule: 'x',
      budgetDetail: 'x',
      expectedOutput: 'x',
      members: [],
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

    // 1. 创建供应商
    const supplier = await createSupplier({
      code: 'SUP-001',
      name: '上海材料厂',
      contactPerson: '李工',
      contactPhone: '13800000000',
    });

    // 2. 创建合同 100000
    const contract = await createContract(leadId, {
      contractNo: 'CT-2026-E2E-001',
      projectId: project.id,
      supplierId: supplier.id,
      title: '高温烧结炉委外加工',
      scope: '按试制方案 A',
      ipOwnership: '所有成果归我方所有',
      totalAmount: 100000,
      signedDate: new Date('2026-06-01'),
      startDate: new Date('2026-06-05'),
      endDate: new Date('2026-08-30'),
    });
    expect(contract.status).toBe('draft');

    // 3. submit workflow
    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'outsource_contract_v1',
      entityId: contract.id,
    });
    expect(inst.status).toBe('running');

    // 4. 4 步 approve
    // step 1: rd_director
    let todos = await listTodo(jwt(rdDirectorId, R.RD_DIRECTOR));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('研发中心审核');
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), {
      stepId: todos[0].stepId,
    });

    // step 2: tech_committee
    todos = await listTodo(jwt(techCommitteeId, R.TECH_COMMITTEE));
    expect(todos).toHaveLength(1);
    expect(todos[0].stepName).toBe('技委会评审');
    await approve(jwt(techCommitteeId, R.TECH_COMMITTEE), {
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

    // 5. 验 status=active
    const afterApproval = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: contract.id },
    });
    expect(afterApproval.status).toBe('active');

    // 6. 财务登记付款 60000 → 仍 active
    await registerPayment(financeLeadId, {
      contractId: contract.id,
      amount: 60000,
      paidDate: new Date('2026-07-01'),
      installmentNo: 1,
      note: '首付',
    });
    const midContract = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: contract.id },
    });
    expect(midContract.status).toBe('active');

    // 7. 财务登记付款 40000 → completed
    await registerPayment(financeLeadId, {
      contractId: contract.id,
      amount: 40000,
      paidDate: new Date('2026-08-15'),
      installmentNo: 2,
      note: '尾款',
    });
    const finalContract = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: contract.id },
    });
    expect(finalContract.status).toBe('completed');

    // 8. 验 outsource-cost API total = 100000 (用 SQL 直接验证 API 逻辑)
    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        oc.id,
        COALESCE(SUM(op.amount), 0)::text AS paid_amount
      FROM outsource_contract oc
      LEFT JOIN outsource_payment op ON op.contract_id = oc.id
      WHERE oc.project_id = ${project.id}
        AND oc.status IN ('active', 'completed')
      GROUP BY oc.id
    `;
    const totalPaid = rows.reduce(
      (acc, r) => acc + Number(r.paid_amount),
      0,
    );
    expect(totalPaid).toBe(100000);
  });
});
