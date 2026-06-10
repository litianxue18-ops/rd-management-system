import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import {
  createReport,
  markApproved,
  markRejected,
  setReviewing,
} from '@/modules/monthly/monthly-service';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

// 由于 vitest 模块缓存 + 测试 beforeEach 里 _resetRegistry, 内联重新注册
function registerMonthlyReportV1() {
  registerWorkflow({
    code: 'monthly_report_v1',
    entityType: 'monthly_report',
    steps: [
      { name: '财务负责人审核', role: R.FINANCE_LEAD },
      { name: '研发负责人审核', role: R.RD_DIRECTOR },
      { name: '总经理批准',     role: R.CEO },
    ],
    loadEntity: async (id, tx) => tx.monthlyReport.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => markApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) =>
        markRejected(entity.id, comments, tx),
    },
  });
}

beforeEach(async () => {
  _resetRegistry();
  registerMonthlyReportV1();

  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('月报端到端 3 步审批', () => {
  it('完整跑通: draft → 3 步 → approved + monthlyReport.status=approved', async () => {
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
    const finId = await makeUser('fin', R.FINANCE_LEAD);
    const rdId = await makeUser('rddir', R.RD_DIRECTOR);
    const ceoId = await makeUser('ceo', R.CEO);

    const project = await prisma.project.create({
      data: {
        code: 'P-MR-1',
        name: 'E2E 月报',
        projectTypeId: typeRow.id,
        departmentId: dept.id,
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
        members: {
          create: [{ userId: leadId, role: '负责人', isLead: true }],
        },
      },
    });

    // 1. lead createReport
    const report = await createReport(leadId, {
      projectId: project.id,
      reportYear: 2026,
      reportMonth: 6,
      monthPlan: '计划',
      actualCompletion: '完成',
      outputs: '样品',
      problems: '无',
      resourceUsage: '正常',
      nextMonthPlan: '继续',
    });
    expect(report.status).toBe('draft');

    // 2. submit
    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });
    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'monthly_report_v1',
      entityId: report.id,
    });
    expect(inst.status).toBe('running');
    const afterSubmit = await prisma.monthlyReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(afterSubmit.status).toBe('reviewing');

    // 3. 3 步依次 approve
    let pending = await listTodo(jwt(finId, R.FINANCE_LEAD));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('财务负责人审核');
    await approve(jwt(finId, R.FINANCE_LEAD), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(rdId, R.RD_DIRECTOR));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('研发负责人审核');
    await approve(jwt(rdId, R.RD_DIRECTOR), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(ceoId, R.CEO));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('总经理批准');
    await approve(jwt(ceoId, R.CEO), { stepId: pending[0].stepId });

    // 4. 验证 monthlyReport + approvalInstance
    const finalReport = await prisma.monthlyReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(finalReport.status).toBe('approved');

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
    expect(finalInst.finishedAt).toBeTruthy();
  });
});
