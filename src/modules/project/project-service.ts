import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { scopeWhere, type ScopeContext } from '@/shared/scope-where';
import { generateProjectCode } from './number-generator';
import type { Prisma, ProjectStatus } from '@prisma/client';

export interface CreateProjectInput {
  name: string;
  projectTypeId: number;
  departmentId: number;
  leadUserId: number;
  startDate: Date;
  endDate: Date;
  budget: number;
  background: string;
  goals: string;
  techPlan: string;
  schedule: string;
  budgetDetail: string;
  expectedOutput: string;
  attachmentsNote?: string;
  members?: Array<{ userId: number; role: string }>;
}

export async function createProject(creatorId: number, input: CreateProjectInput) {
  return prisma.$transaction(async (tx) => {
    const proj = await tx.project.create({
      data: {
        code: `DRAFT-${Date.now()}`, // 占位, 通过审批时改成真实编号
        name: input.name,
        projectTypeId: input.projectTypeId,
        departmentId: input.departmentId,
        leadUserId: input.leadUserId,
        startDate: input.startDate,
        endDate: input.endDate,
        budget: input.budget,
        background: input.background,
        goals: input.goals,
        techPlan: input.techPlan,
        schedule: input.schedule,
        budgetDetail: input.budgetDetail,
        expectedOutput: input.expectedOutput,
        attachmentsNote: input.attachmentsNote ?? null,
        createdById: creatorId,
        members: {
          create: [
            { userId: input.leadUserId, role: '项目负责人', isLead: true },
            ...(input.members ?? []).map((m) => ({
              userId: m.userId,
              role: m.role,
              isLead: false,
            })),
          ],
        },
      },
      include: { members: true, projectType: true },
    });
    return proj;
  });
}

export async function listProjects(
  ctx: ScopeContext,
  opts: { status?: string; departmentId?: number; typeCode?: string } = {},
) {
  const scopeW = scopeWhere<Prisma.ProjectWhereInput>(ctx, 'project', {
    self: () => ({ createdById: ctx.user.userId }),
    responsible: () => ({
      OR: [{ leadUserId: ctx.user.userId }, { createdById: ctx.user.userId }],
    }),
    department: () => ({ departmentId: ctx.departmentId ?? -1 }),
  });
  const where: Prisma.ProjectWhereInput = {
    ...scopeW,
    ...(opts.status ? { status: opts.status as ProjectStatus } : {}),
    ...(opts.departmentId ? { departmentId: opts.departmentId } : {}),
    ...(opts.typeCode ? { projectType: { code: opts.typeCode } } : {}),
  };
  return prisma.project.findMany({
    where,
    include: { projectType: true, members: { include: { project: false } } },
    orderBy: { id: 'desc' },
  });
}

export async function getProject(id: number) {
  return prisma.project.findUnique({
    where: { id },
    include: {
      projectType: true,
      members: true,
      changes: { orderBy: { id: 'desc' } },
    },
  });
}

export async function updateDraftProject(
  id: number,
  userId: number,
  patch: Partial<CreateProjectInput>,
) {
  const proj = await prisma.project.findUnique({ where: { id } });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'draft') throw new BusinessError('仅草稿状态可编辑');
  if (proj.createdById !== userId && proj.leadUserId !== userId) {
    throw new BusinessError('仅创建人/负责人可编辑');
  }
  // 只允许传 schema 已存在的字段, 排除 members 等关系字段
  const { members: _members, ...scalar } = patch;
  return prisma.project.update({ where: { id }, data: scalar });
}

/** 立项审批通过时调用 (在 workflow tx 内). */
export async function activateProject(projectId: number, tx: Prisma.TransactionClient) {
  const proj = await tx.project.findUniqueOrThrow({
    where: { id: projectId },
    include: { projectType: true },
  });
  const code = await generateProjectCode(tx, proj.projectType.code);
  await tx.project.update({
    where: { id: projectId },
    data: { code, status: 'active', activatedAt: new Date() },
  });
}

/** 立项审批驳回时调用. */
export async function markProjectRejected(
  projectId: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.project.update({
    where: { id: projectId },
    data: { status: 'rejected', rejectedAt: new Date(), rejectedReason: reason },
  });
}
