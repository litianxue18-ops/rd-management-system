import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { _resetRegistry, registerWorkflow } from './registry';
import { submit, approve, reject, withdraw, transfer, listTodo } from './engine';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { seedRoles } from '../../../prisma/seeds/roles';

let proj_lead_id: number, rd_director_id: number, tech_committee_id: number, finance_lead_id: number, ceo_id: number;

beforeEach(async () => {
  await seedRoles(prisma);
  _resetRegistry();
  // 5 个用户对应 5 个审批角色
  async function makeUser(username: string, roleCode: string) {
    const u = await prisma.user.create({
      data: { username, employeeId: username.toUpperCase(), name: username, passwordHash: await hashPassword('p') },
    });
    const r = await prisma.role.findUniqueOrThrow({ where: { code: roleCode } });
    await prisma.userRole.create({ data: { userId: u.id, roleId: r.id, isPrimary: true } });
    return u.id;
  }
  proj_lead_id     = await makeUser('plead',  R.PROJECT_LEAD);
  rd_director_id   = await makeUser('rddir',  R.RD_DIRECTOR);
  tech_committee_id= await makeUser('tech',   R.TECH_COMMITTEE);
  finance_lead_id  = await makeUser('fin',    R.FINANCE_LEAD);
  ceo_id           = await makeUser('ceo',    R.CEO);

  // 注册一个测试 workflow (4 步, 跟立项一样的形状)
  registerWorkflow({
    code: 'test_proj_v1',
    entityType: 'test_entity',
    steps: [
      { name: '研发中心初审', role: R.RD_DIRECTOR },
      { name: '技委会评审',  role: R.TECH_COMMITTEE },
      { name: '财务审核',    role: R.FINANCE_LEAD },
      { name: '总经理批准',  role: R.CEO },
    ],
    loadEntity: async () => ({ id: 1, code: 'TEST-001' }),
    hooks: {
      onApproved: async () => {},
      onRejected: async () => {},
    },
  });
});

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

describe('workflow.submit', () => {
  it('draft 实例 → running + 生成 step 1', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    expect(inst.status).toBe('running');
    const steps = await prisma.approvalStep.findMany({ where: { instanceId: inst.id }, orderBy: { stepIndex: 'asc' } });
    expect(steps).toHaveLength(1);
    expect(steps[0].stepName).toBe('研发中心初审');
    expect(steps[0].status).toBe('pending');
  });
});

describe('workflow.approve', () => {
  it('approve step 1 → 自动生成 step 2', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await approve(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step1.id, comments: 'ok' });
    const allSteps = await prisma.approvalStep.findMany({ where: { instanceId: inst.id }, orderBy: { stepIndex: 'asc' } });
    expect(allSteps).toHaveLength(2);
    expect(allSteps[1].stepName).toBe('技委会评审');
    expect(allSteps[0].status).toBe('approved');
  });

  it('approve 最后一步 → instance approved + 触发 onApproved', async () => {
    let onApprovedCalled = false;
    _resetRegistry();
    registerWorkflow({
      code: 'test_proj_v1',
      entityType: 'test_entity',
      steps: [{ name: '唯一步', role: R.RD_DIRECTOR }],
      loadEntity: async () => ({ id: 1 }),
      hooks: { onApproved: async () => { onApprovedCalled = true; } },
    });
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id } });
    await approve(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step.id });
    const updated = await prisma.approvalInstance.findUniqueOrThrow({ where: { id: inst.id } });
    expect(updated.status).toBe('approved');
    expect(onApprovedCalled).toBe(true);
  });

  it('错误的人尝试审批 → 抛 ForbiddenError', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await expect(
      approve(jwt(ceo_id, R.CEO), { stepId: step1.id })
    ).rejects.toThrow(/无权|该步骤未分配/);
  });
});

describe('workflow.reject', () => {
  it('reject 任意一步 → instance rejected + 触发 onRejected', async () => {
    let onRejectedCalled = false;
    _resetRegistry();
    registerWorkflow({
      code: 'test_proj_v1',
      entityType: 'test_entity',
      steps: [
        { name: '初审', role: R.RD_DIRECTOR },
        { name: '终审', role: R.CEO },
      ],
      loadEntity: async () => ({ id: 1 }),
      hooks: { onRejected: async () => { onRejectedCalled = true; } },
    });
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await reject(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step1.id, comments: '预算不合理' });
    const updated = await prisma.approvalInstance.findUniqueOrThrow({ where: { id: inst.id } });
    expect(updated.status).toBe('rejected');
    expect(onRejectedCalled).toBe(true);
  });
});

describe('workflow.withdraw', () => {
  it('提交人在 step 1 未操作前可撤回', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    await withdraw(jwt(proj_lead_id, R.PROJECT_LEAD), { instanceId: inst.id });
    const updated = await prisma.approvalInstance.findUniqueOrThrow({ where: { id: inst.id } });
    expect(updated.status).toBe('cancelled');
  });

  it('step 1 已通过 → 撤回抛错', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await approve(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step1.id });
    await expect(withdraw(jwt(proj_lead_id, R.PROJECT_LEAD), { instanceId: inst.id })).rejects.toThrow();
  });
});

describe('workflow.transfer', () => {
  it('审批人转交给同角色他人', async () => {
    // 再造一个 rd_director
    const rddir2 = await prisma.user.create({
      data: { username: 'rddir2', employeeId: 'RDDIR2', name: 'X', passwordHash: 'x' },
    });
    const role = await prisma.role.findUniqueOrThrow({ where: { code: R.RD_DIRECTOR } });
    await prisma.userRole.create({ data: { userId: rddir2.id, roleId: role.id, isPrimary: true } });

    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await transfer(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step1.id, toUserId: rddir2.id, comments: '请假' });
    const updated = await prisma.approvalStep.findUniqueOrThrow({ where: { id: step1.id } });
    expect(updated.assignedUserId).toBe(rddir2.id);
  });

  it('转交目标不具备所需角色 → 抛错', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const step1 = await prisma.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    await expect(
      transfer(jwt(rd_director_id, R.RD_DIRECTOR), { stepId: step1.id, toUserId: ceo_id })
    ).rejects.toThrow(/角色不匹配/);
  });
});

describe('workflow.listTodo', () => {
  it('返回 assigned_user = me AND status = pending 的所有步骤', async () => {
    const inst = await submit(jwt(proj_lead_id, R.PROJECT_LEAD), { workflowCode: 'test_proj_v1', entityId: 1 });
    const list = await listTodo(jwt(rd_director_id, R.RD_DIRECTOR));
    expect(list).toHaveLength(1);
    expect(list[0].entityType).toBe('test_entity');
    expect(list[0].stepName).toBe('研发中心初审');
  });
});
