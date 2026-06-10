import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';
import type { Prisma } from '@prisma/client';

export interface CreateReportInput {
  projectId: number;
  reportYear: number;
  reportMonth: number; // 1-12
  monthPlan: string;
  actualCompletion: string;
  outputs: string;
  problems: string;
  resourceUsage: string;
  nextMonthPlan: string;
}

export async function createReport(creatorId: number, input: CreateReportInput) {
  if (input.reportMonth < 1 || input.reportMonth > 12) {
    throw new BusinessError('月份必须 1-12');
  }
  // 仅 active 项目可建
  const proj = await prisma.project.findUnique({ where: { id: input.projectId } });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active') throw new BusinessError('仅 active 项目可建月报');
  // 仅 lead 或 member 可建
  const isLead = proj.leadUserId === creatorId;
  const isMember = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId: input.projectId, userId: creatorId } },
  });
  if (!isLead && !isMember) throw new BusinessError('仅项目成员可建月报');

  return tryCreateUnique(
    () =>
      prisma.monthlyReport.create({
        data: { ...input, createdById: creatorId },
      }),
    `${input.reportYear}-${input.reportMonth} 月报已存在`,
  );
}

export async function listReports(
  opts: { projectId?: number; year?: number; month?: number; status?: string } = {},
) {
  return prisma.monthlyReport.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.year ? { reportYear: opts.year } : {}),
      ...(opts.month ? { reportMonth: opts.month } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: { project: { select: { id: true, code: true, name: true } } },
    orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }, { id: 'desc' }],
  });
}

export async function getReport(id: number) {
  return prisma.monthlyReport.findUnique({
    where: { id },
    include: { project: { include: { projectType: true } } },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<CreateReportInput>,
) {
  const r = await prisma.monthlyReport.findUnique({ where: { id } });
  if (!r) throw new BusinessError('月报不存在');
  if (r.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (r.createdById !== userId) throw new BusinessError('仅创建人可编辑');
  // 不允许改 projectId/reportYear/reportMonth (唯一约束)
  const { projectId: _pid, reportYear: _ry, reportMonth: _rm, ...safe } = patch;
  return prisma.monthlyReport.update({ where: { id }, data: safe });
}

export async function markApproved(id: number, tx: Prisma.TransactionClient) {
  await tx.monthlyReport.update({ where: { id }, data: { status: 'approved' } });
}

export async function markRejected(
  id: number,
  _reason: string,
  tx: Prisma.TransactionClient,
) {
  // 不存 rejected reason 到 monthly_report 表 (在 approval_step.comments 已有)
  await tx.monthlyReport.update({ where: { id }, data: { status: 'rejected' } });
}

/** 工作流提交时由 API 调用, 把 status 从 draft 改为 reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.monthlyReport.update({ where: { id }, data: { status: 'reviewing' } });
}
