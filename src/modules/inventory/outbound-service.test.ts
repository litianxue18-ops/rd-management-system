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
  createOutbound,
  updateDraftOutbound,
  setReviewing,
  setApproved,
  setRejected,
} from './outbound-service';

let deptId: number;
let typeId: number;
let lead_id: number;
let lead2_id: number;
let member_id: number;
let outsider_id: number;
let rd_director_id: number;
let matA: number;
let whMain: number;
let activeProject_id: number;
let draftProject_id: number;

beforeEach(async () => {
  // workflow registry 是模块级单例, tests/setup.ts TRUNCATE 不会清它. 而
  // `import '@/modules/inventory/workflow'` 仅首次执行 (Node 模块缓存), 所以
  // 在 _resetRegistry() 后重 import 不会再次 register. 这里直接在测试里手动
  // register, 与 engine.test.ts 模式一致.
  _resetRegistry();
  registerWorkflow({
    code: 'material_request_v1',
    entityType: 'material_request',
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
      { name: '研发中心审批', role: R.RD_DIRECTOR },
    ],
    loadEntity: async (id, tx) =>
      tx.inventoryOutbound.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => {
        const lastStep = await tx.approvalStep.findFirst({
          where: {
            instance: {
              entityType: 'material_request',
              entityId: entity.id,
            },
            status: 'approved',
          },
          orderBy: { stepIndex: 'desc' },
        });
        await setApproved(
          entity.id,
          tx,
          lastStep?.actedBy ?? entity.requesterId,
        );
      },
      onRejected: async (entity, comments, tx) =>
        setRejected(entity.id, comments, tx),
    },
  });

  deptId = (await prisma.department.create({ data: { code: 'rd', name: '研发' } }))
    .id;
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
  lead_id = await makeUser('plead', R.PROJECT_LEAD);
  lead2_id = await makeUser('plead2', R.PROJECT_LEAD);
  member_id = await makeUser('member', R.RESEARCHER);
  outsider_id = await makeUser('out', R.RESEARCHER);
  rd_director_id = await makeUser('rddir', R.RD_DIRECTOR);

  matA = (
    await prisma.material.create({
      data: { code: 'M-A', name: '物料 A', unit: 'kg' },
    })
  ).id;
  whMain = (
    await prisma.warehouse.create({ data: { code: 'wh-main', name: '主仓' } })
  ).id;

  const baseProj = {
    name: 'p',
    projectTypeId: typeId,
    departmentId: deptId,
    leadUserId: lead_id,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2027-01-01'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    createdById: lead_id,
  };
  activeProject_id = (
    await prisma.project.create({
      data: {
        ...baseProj,
        code: 'P1',
        status: 'active',
        members: {
          create: [
            { userId: lead_id, role: '负责人', isLead: true },
            { userId: member_id, role: '主研' },
          ],
        },
      },
    })
  ).id;
  draftProject_id = (
    await prisma.project.create({
      data: { ...baseProj, code: 'P2-draft', status: 'draft' },
    })
  ).id;
});

function baseInput(overrides: Partial<Parameters<typeof createOutbound>[1]> = {}) {
  return {
    projectId: activeProject_id,
    materialId: matA,
    warehouseId: whMain,
    requestedQty: 10,
    purpose: '试制样品 A',
    ...overrides,
  };
}

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

describe('createOutbound', () => {
  it('happy path → 申请人 = lead, status=draft, docNo OUT-', async () => {
    const o = await createOutbound(lead_id, baseInput());
    expect(o.status).toBe('draft');
    expect(o.docNo).toMatch(/^OUT-\d{4}-\d{3}$/);
    expect(o.requesterId).toBe(lead_id);
    expect(Number(o.requestedQty)).toBe(10);
  });

  it('非 active 项目 → BusinessError', async () => {
    await expect(
      createOutbound(lead_id, baseInput({ projectId: draftProject_id })),
    ).rejects.toThrow(/仅 active 项目可领料/);
  });

  it('非项目成员 → BusinessError', async () => {
    await expect(createOutbound(outsider_id, baseInput())).rejects.toThrow(
      /仅项目成员可领料/,
    );
  });

  it('自动从最近 inbound 取 unitPrice (M6-T4)', async () => {
    // 入库两笔, 价 10 然后 价 20, outbound 应取 20
    await prisma.inventoryInbound.create({
      data: {
        docNo: 'IN-2026-001',
        materialId: matA,
        warehouseId: whMain,
        quantity: 100,
        unitPrice: 10,
        receivedAt: new Date('2026-01-10'),
        operatorId: lead_id,
        changeType: 'inbound',
      },
    });
    await prisma.inventoryInbound.create({
      data: {
        docNo: 'IN-2026-002',
        materialId: matA,
        warehouseId: whMain,
        quantity: 50,
        unitPrice: 20,
        receivedAt: new Date('2026-02-15'),
        operatorId: lead_id,
        changeType: 'inbound',
      },
    });
    const o = await createOutbound(lead_id, baseInput());
    expect(Number(o.unitPrice)).toBe(20);
  });

  it('没有 inbound 时 unitPrice=null (M6-T4)', async () => {
    const o = await createOutbound(lead_id, baseInput());
    expect(o.unitPrice).toBeNull();
  });

  it('updateDraftOutbound 非 draft → BusinessError', async () => {
    const o = await createOutbound(lead_id, baseInput());
    await prisma.inventoryOutbound.update({
      where: { id: o.id },
      data: { status: 'reviewing' },
    });
    await expect(
      updateDraftOutbound(o.id, lead_id, { requestedQty: 20 }),
    ).rejects.toThrow(/仅 draft 可编辑/);
  });
});

describe('material_request_v1 workflow E2E', () => {
  it('submit → step 1 路由到 projectLead → approve → step 2 RD_DIRECTOR 候选 → approve → outbound approved', async () => {
    // member 申请, project lead 是 lead_id (不是 member_id), step 1 应分给 lead_id
    const o = await createOutbound(member_id, baseInput());

    const inst = await submit(jwt(member_id, R.RESEARCHER), {
      workflowCode: 'material_request_v1',
      entityId: o.id,
    });
    expect(inst.status).toBe('running');

    // outbound 应已 reviewing (onSubmit)
    const after1 = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after1.status).toBe('reviewing');

    // step 1 分给 lead_id (resolveAssignee 路由), 不是 lead2_id
    const step1 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 1 },
    });
    expect(step1.assignedUserId).toBe(lead_id);
    expect(step1.requiredRole).toBe(R.PROJECT_LEAD);

    // lead2 不能审批 (resolveAssignee 钉死到 lead_id)
    await expect(
      approve(jwt(lead2_id, R.PROJECT_LEAD), { stepId: step1.id }),
    ).rejects.toThrow();

    // lead 审批 → step 2 生成, 分给 rd_director (走候选)
    await approve(jwt(lead_id, R.PROJECT_LEAD), {
      stepId: step1.id,
      comments: '同意',
    });
    const step2 = await prisma.approvalStep.findFirstOrThrow({
      where: { instanceId: inst.id, stepIndex: 2 },
    });
    expect(step2.assignedUserId).toBe(rd_director_id);
    expect(step2.requiredRole).toBe(R.RD_DIRECTOR);

    // rd_director 审批 → instance approved, outbound approved, approvedById 设
    await approve(jwt(rd_director_id, R.RD_DIRECTOR), {
      stepId: step2.id,
      comments: '通过',
    });
    const after2 = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: o.id },
    });
    expect(after2.status).toBe('approved');
    expect(after2.approvedById).toBe(rd_director_id);
    expect(after2.approvedAt).not.toBeNull();

    const finalInst = await prisma.approvalInstance.findUniqueOrThrow({
      where: { id: inst.id },
    });
    expect(finalInst.status).toBe('approved');
  });
});
