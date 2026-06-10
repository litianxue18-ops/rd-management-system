import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { seedProjectTypes } from '../../prisma/seeds/project-types';
import { seedNumberRules } from '../../prisma/seeds/number-rules';
import { createProject, activateProject, markProjectRejected } from '@/modules/project/project-service';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';
import { notifyRoles } from '@/modules/workflow/notify';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

// 由于 vitest 模块缓存, workflow.ts 的副作用 register 只会在首次 import 时跑.
// 测试 beforeEach 里调用 _resetRegistry() 后, 直接内联调用 registerWorkflow 重新注册,
// 行为与 src/modules/project/workflow.ts 保持一致.
function registerProjectApprovalV1() {
  registerWorkflow({
    code: 'project_approval_v1',
    entityType: 'project',
    steps: [
      { name: '研发中心初审',   role: R.RD_DIRECTOR },
      { name: '技委会评审',     role: R.TECH_COMMITTEE },
      { name: '财务部预算审核', role: R.FINANCE_LEAD },
      { name: '总经理批准',     role: R.CEO },
    ],
    loadEntity: async (id, tx) => tx.project.findUnique({ where: { id } }),
    hooks: {
      onApproved: async (entity, tx) => {
        await activateProject(entity.id, tx);
        await notifyRoles(
          [R.PRODUCTION_LEAD, R.PURCHASE_LEAD],
          {
            eventType: 'project_approved',
            entityType: 'project',
            entityId: entity.id,
            message: `项目 ${entity.name} 立项通过`,
          },
          tx,
        );
      },
      onRejected: async (entity, comments, tx) => {
        await markProjectRejected(entity.id, comments, tx);
      },
    },
  });
}

beforeEach(async () => {
  _resetRegistry();
  registerProjectApprovalV1();

  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
  await seedProjectTypes(prisma);
  await seedNumberRules(prisma);
});

describe('立项端到端 4 步审批', () => {
  it('完整跑通: draft → 4 步 → active + 自动编号', async () => {
    // 准备 5 个用户对应 5 个审批角色
    async function makeUser(name: string, role: string) {
      const u = await prisma.user.create({
        data: {
          username: name,
          employeeId: name.toUpperCase(),
          name,
          passwordHash: await hashPassword('p'),
        },
      });
      const r = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({ data: { userId: u.id, roleId: r.id, isPrimary: true } });
      return u.id;
    }
    const dept = await prisma.department.create({ data: { code: 'rd', name: '研发中心' } });
    const leadId = await makeUser('lead', R.PROJECT_LEAD);
    const rddir = await makeUser('rddir', R.RD_DIRECTOR);
    const tech = await makeUser('tech', R.TECH_COMMITTEE);
    const fin = await makeUser('fin', R.FINANCE_LEAD);
    const ceo = await makeUser('ceo', R.CEO);
    const typeId = (await prisma.projectType.findUniqueOrThrow({ where: { code: 'MAT' } })).id;

    // 1. 项目负责人创建草稿
    const proj = await createProject(leadId, {
      name: '高性能阻燃膜中试',
      projectTypeId: typeId,
      departmentId: dept.id,
      leadUserId: leadId,
      startDate: new Date('2026-07-01'),
      endDate: new Date('2027-12-31'),
      budget: 2500000,
      background: 'x',
      goals: 'x',
      techPlan: 'x',
      schedule: 'x',
      budgetDetail: 'x',
      expectedOutput: 'x',
    });
    expect(proj.code).toMatch(/^DRAFT-/);

    // 2. 提交审批
    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });
    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'project_approval_v1',
      entityId: proj.id,
    });
    expect(inst.status).toBe('running');

    // 3. 4 步依次审批
    let pending = await listTodo(jwt(rddir, R.RD_DIRECTOR));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('研发中心初审');
    await approve(jwt(rddir, R.RD_DIRECTOR), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(tech, R.TECH_COMMITTEE));
    expect(pending).toHaveLength(1);
    expect(pending[0].stepName).toBe('技委会评审');
    await approve(jwt(tech, R.TECH_COMMITTEE), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(fin, R.FINANCE_LEAD));
    await approve(jwt(fin, R.FINANCE_LEAD), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(ceo, R.CEO));
    await approve(jwt(ceo, R.CEO), { stepId: pending[0].stepId });

    // 4. 验证项目已激活 + 编号生成
    const final = await prisma.project.findUniqueOrThrow({ where: { id: proj.id } });
    expect(final.status).toBe('active');
    expect(final.code).toMatch(new RegExp('^RD-MAT-' + new Date().getFullYear() + '-001$'));
    expect(final.activatedAt).toBeTruthy();

    // 5. 验证通知推给生产部/采购部 (各 0 个用户, 应 0 条)
    const notifs = await prisma.notification.findMany({
      where: { eventType: 'project_approved' },
    });
    expect(notifs.length).toBe(0);
  });
});
