import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import type { ScopeContext } from '@/shared/scope-where';
import {
  createProject,
  listProjects,
  updateDraftProject,
  activateProject,
  markProjectRejected,
} from './project-service';

let deptA_id: number;
let deptB_id: number;
let typeId: number;
let researcher_id: number;
let projectLead_id: number;
let rdDirector_id: number;
let financeLead_id: number;
let other_id: number;

beforeEach(async () => {
  // 部门
  deptA_id = (await prisma.department.create({ data: { code: 'rd', name: '研发中心' } })).id;
  deptB_id = (await prisma.department.create({ data: { code: 'prod', name: '生产部' } })).id;

  // 项目类型
  typeId = (
    await prisma.projectType.create({ data: { code: 'MAT', name: '新材料' } })
  ).id;
  await prisma.projectNumberRule.create({
    data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
  });

  // 4 个角色 + 用户
  async function makeUser(
    username: string,
    roleCode: string,
    departmentId: number | null = deptA_id,
  ) {
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
        passwordHash: 'x',
        departmentId,
      },
    });
    await prisma.userRole.create({
      data: { userId: u.id, roleId: role.id, isPrimary: true },
    });
    return u.id;
  }
  researcher_id = await makeUser('res', R.RESEARCHER, deptA_id);
  projectLead_id = await makeUser('plead', R.PROJECT_LEAD, deptA_id);
  rdDirector_id = await makeUser('rddir', R.RD_DIRECTOR, deptA_id);
  financeLead_id = await makeUser('fin', R.FINANCE_LEAD, deptA_id);
  other_id = await makeUser('other', R.RESEARCHER, deptB_id);
});

function ctx(userId: number, roles: string[], departmentId: number | null): ScopeContext {
  return {
    user: { userId, roles, primaryRole: roles[0] ?? '', tokenVersion: 0 },
    departmentId,
  };
}

function baseInput(overrides: Partial<Parameters<typeof createProject>[1]> = {}) {
  return {
    name: 'p',
    projectTypeId: typeId,
    departmentId: deptA_id,
    leadUserId: projectLead_id,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2027-12-31'),
    budget: 100000,
    background: 'x',
    goals: 'x',
    techPlan: 'x',
    schedule: 'x',
    budgetDetail: 'x',
    expectedOutput: 'x',
    ...overrides,
  };
}

describe('createProject', () => {
  it('happy path → 返回项目, code 以 DRAFT- 开头, members 含负责人', async () => {
    const p = await createProject(projectLead_id, baseInput());
    expect(p.code).toMatch(/^DRAFT-/);
    expect(p.status).toBe('draft');
    expect(p.members).toHaveLength(1);
    expect(p.members[0].userId).toBe(projectLead_id);
    expect(p.members[0].isLead).toBe(true);
  });
});

describe('listProjects scope 注入', () => {
  beforeEach(async () => {
    // researcher 在 deptA 创建 P1 (作为 created_by, 不是 lead)
    await createProject(
      researcher_id,
      baseInput({ name: 'P1-researcher-own', leadUserId: projectLead_id }),
    );
    // projectLead 在 deptA 创建 P2 (自己既是 created_by 又是 lead)
    await createProject(projectLead_id, baseInput({ name: 'P2-plead-own' }));
    // other 在 deptB 创建 P3
    await createProject(
      other_id,
      baseInput({ name: 'P3-other-deptB', departmentId: deptB_id, leadUserId: other_id }),
    );
  });

  it('researcher scope (self) → 仅看自己创建的', async () => {
    const list = await listProjects(ctx(researcher_id, [R.RESEARCHER], deptA_id));
    expect(list.map((p) => p.name).sort()).toEqual(['P1-researcher-own']);
  });

  it('project_lead scope (responsible) → 自己创建 + 自己负责', async () => {
    const list = await listProjects(ctx(projectLead_id, [R.PROJECT_LEAD], deptA_id));
    // P1: lead = projectLead_id; P2: lead = projectLead_id
    expect(list.map((p) => p.name).sort()).toEqual([
      'P1-researcher-own',
      'P2-plead-own',
    ]);
  });

  it('rd_director scope (department) → 看本部门所有', async () => {
    const list = await listProjects(ctx(rdDirector_id, [R.RD_DIRECTOR], deptA_id));
    expect(list.map((p) => p.name).sort()).toEqual([
      'P1-researcher-own',
      'P2-plead-own',
    ]);
  });

  it('finance_lead scope (global) → 看所有', async () => {
    const list = await listProjects(ctx(financeLead_id, [R.FINANCE_LEAD], deptA_id));
    expect(list.map((p) => p.name).sort()).toEqual([
      'P1-researcher-own',
      'P2-plead-own',
      'P3-other-deptB',
    ]);
  });
});

describe('updateDraftProject', () => {
  it('status=draft 可改 (创建人)', async () => {
    const p = await createProject(projectLead_id, baseInput());
    const updated = await updateDraftProject(p.id, projectLead_id, { name: 'new-name' });
    expect(updated.name).toBe('new-name');
  });

  it('status=active 抛 BusinessError', async () => {
    const p = await createProject(projectLead_id, baseInput());
    await prisma.$transaction(async (tx) => activateProject(p.id, tx));
    await expect(
      updateDraftProject(p.id, projectLead_id, { name: 'no' }),
    ).rejects.toThrow(/仅草稿状态可编辑/);
  });
});

describe('activateProject', () => {
  it('状态 → active, code → RD-MAT-YYYY-001', async () => {
    const p = await createProject(projectLead_id, baseInput());
    await prisma.$transaction(async (tx) => activateProject(p.id, tx));
    const reloaded = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(reloaded.status).toBe('active');
    const yyyy = new Date().getFullYear();
    expect(reloaded.code).toBe(`RD-MAT-${yyyy}-001`);
    expect(reloaded.activatedAt).toBeTruthy();
  });
});

describe('markProjectRejected', () => {
  it('status → rejected + reason 落库', async () => {
    const p = await createProject(projectLead_id, baseInput());
    await prisma.$transaction(async (tx) =>
      markProjectRejected(p.id, '预算超标', tx),
    );
    const reloaded = await prisma.project.findUniqueOrThrow({ where: { id: p.id } });
    expect(reloaded.status).toBe('rejected');
    expect(reloaded.rejectedReason).toBe('预算超标');
    expect(reloaded.rejectedAt).toBeTruthy();
  });
});
