import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import {
  createClosing,
  setReviewing,
  setApproved,
  setRejected,
} from '@/modules/closing/closing-service';
import { generateArchiveMetadata } from '@/modules/closing/archive-service';
import { submit, approve, listTodo } from '@/modules/workflow/engine';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';

function registerClosingReportV1() {
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
    loadEntity: async (id, tx) => tx.closingReport.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
      onApproved: async (entity, tx) => setApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) =>
        setRejected(entity.id, comments, tx),
    },
  });
}

beforeEach(async () => {
  _resetRegistry();
  registerClosingReportV1();

  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('结项端到端 3 步审批 + 归档', () => {
  it('createClosing → 3 步 approve → project.status=closed → archive 完整', async () => {
    const dept = await prisma.department.create({
      data: { code: 'rd', name: '研发' },
    });
    const typeRow = await prisma.projectType.create({
      data: { code: 'MAT', name: '新材料' },
    });
    await prisma.projectNumberRule.create({
      data: { code: 'default', pattern: 'RD-{TYPE}-{YYYY}-{NNN}' },
    });

    async function makeUser(name: string, role: string) {
      const u = await prisma.user.create({
        data: {
          username: name,
          employeeId: name.toUpperCase(),
          name,
          passwordHash: await hashPassword('p'),
          departmentId: dept.id,
          hourlyCost: 100,
        },
      });
      const r = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({
        data: { userId: u.id, roleId: r.id, isPrimary: true },
      });
      return u.id;
    }
    const leadId = await makeUser('plead', R.PROJECT_LEAD);
    const rdId = await makeUser('rddir', R.RD_DIRECTOR);
    const techId = await makeUser('tech', R.TECH_COMMITTEE);

    const project = await prisma.project.create({
      data: {
        code: 'P-CL-1',
        name: 'E2E 结项项目',
        projectTypeId: typeRow.id,
        departmentId: dept.id,
        leadUserId: leadId,
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-01'),
        budget: 200000,
        background: '产业升级',
        goals: 'A/B/C 三项目标',
        techPlan: '工艺方案 v3',
        schedule: '12 月',
        budgetDetail: '材料 8 + 人工 10 + 委外 2',
        expectedOutput: '专利 1 / 样品 50',
        activatedAt: new Date('2026-01-15'),
        createdById: leadId,
        members: {
          create: [{ userId: leadId, role: '负责人', isLead: true }],
        },
      },
    });

    // 准备一些归档关键素材: 1 月报 + 2 工时
    await prisma.monthlyReport.create({
      data: {
        projectId: project.id,
        reportYear: 2026,
        reportMonth: 3,
        monthPlan: '3 月计划',
        actualCompletion: '完成',
        outputs: '原型 1',
        problems: '无',
        resourceUsage: '正常',
        nextMonthPlan: '4 月继续',
        status: 'approved',
        createdById: leadId,
      },
    });
    await prisma.workhourEntry.createMany({
      data: [
        {
          userId: leadId,
          projectId: project.id,
          workDate: new Date('2026-03-10'),
          hours: 8,
          workContent: '原型设计',
          status: 'approved',
        },
        {
          userId: leadId,
          projectId: project.id,
          workDate: new Date('2026-03-11'),
          hours: 8,
          workContent: '原型实现',
          status: 'approved',
        },
      ],
    });

    // 1. createClosing happy
    const closing = await createClosing(leadId, {
      projectId: project.id,
      basicSummary: '项目 2026-01 ~ 2026-12, 团队 1 人',
      goalReview: 'A/B/C 三项达成',
      outputs: '专利 1 / 样品 50',
      budgetReview: '预算 20 万, 实际 18 万',
      lessons: '方案验证应提前',
      conversionPlan: '2027 Q1 启动产业化',
    });
    expect(closing.status).toBe('draft');
    expect(closing.docNo).toMatch(/^CL-\d{4}-\d{3}$/);

    // 2. submit → 3 步 approve
    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });

    const inst = await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'closing_report_v1',
      entityId: closing.id,
    });
    expect(inst.status).toBe('running');

    let pending = await listTodo(jwt(leadId, R.PROJECT_LEAD));
    expect(pending).toHaveLength(1);
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(rdId, R.RD_DIRECTOR));
    expect(pending).toHaveLength(1);
    await approve(jwt(rdId, R.RD_DIRECTOR), { stepId: pending[0].stepId });

    pending = await listTodo(jwt(techId, R.TECH_COMMITTEE));
    expect(pending).toHaveLength(1);
    await approve(jwt(techId, R.TECH_COMMITTEE), {
      stepId: pending[0].stepId,
      comments: '同意结项',
    });

    // 3. 验证 closing.status=approved + project.status=closed
    const finalClosing = await prisma.closingReport.findUniqueOrThrow({
      where: { id: closing.id },
    });
    expect(finalClosing.status).toBe('approved');
    expect(finalClosing.approvedAt).toBeTruthy();

    const finalProject = await prisma.project.findUniqueOrThrow({
      where: { id: project.id },
    });
    expect(finalProject.status).toBe('closed');

    // 4. archive: 验有立项/过程/结项 sections + 关键字段存在
    const archive = await generateArchiveMetadata(project.id);
    expect(archive.project.code).toBe('P-CL-1');
    expect(archive.project.name).toBe('E2E 结项项目');
    expect(archive.project.background).toBe('产业升级');
    expect(archive.project.goals).toBe('A/B/C 三项目标');
    expect(archive.members.length).toBe(1);
    expect(archive.monthlyReports.length).toBe(1);
    expect(archive.workhours.length).toBe(2);
    expect(archive.closingReport).not.toBeNull();
    expect(archive.closingReport!.conversionPlan).toBe('2027 Q1 启动产业化');
    expect(archive.generatedAt).toBeTruthy();
  });
});
