import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import type { Prisma } from '@prisma/client';

export interface WorkhourInput {
  projectId: number;
  workDate: Date;
  hours: number;
  workContent: string;
}

/**
 * Upsert 一条工时 (用户 + 项目 + 日期 唯一).
 * 任何编辑都把状态拉回 draft, 清掉之前的提交/审批/驳回痕迹.
 * hours 必须 0-24, 0.5 小时步长.
 */
export async function upsertEntry(userId: number, input: WorkhourInput) {
  if (input.hours < 0 || input.hours > 24) {
    throw new BusinessError('工时必须 0-24');
  }
  // 用整数比较避开浮点精度
  if (Math.abs(input.hours * 2 - Math.round(input.hours * 2)) > 0.001) {
    throw new BusinessError('工时必须 0.5 小时为步长');
  }
  return prisma.workhourEntry.upsert({
    where: {
      userId_projectId_workDate: {
        userId,
        projectId: input.projectId,
        workDate: input.workDate,
      },
    },
    create: {
      userId,
      projectId: input.projectId,
      workDate: input.workDate,
      hours: input.hours,
      workContent: input.workContent,
      status: 'draft',
    },
    update: {
      hours: input.hours,
      workContent: input.workContent,
      status: 'draft',
      submittedAt: null,
      approvedAt: null,
      rejectedReason: null,
    },
  });
}

/** 删除一条工时 (仅本人 + 仅 draft 状态). */
export async function deleteEntry(userId: number, entryId: number) {
  const e = await prisma.workhourEntry.findUnique({ where: { id: entryId } });
  if (!e) throw new BusinessError('工时记录不存在');
  if (e.userId !== userId) throw new BusinessError('仅本人可删');
  if (e.status !== 'draft') throw new BusinessError('仅 draft 状态可删');
  await prisma.workhourEntry.delete({ where: { id: entryId } });
}

/** 取某用户某周 (周一 ~ 周日) 的所有工时, 带项目基本信息. */
export async function getWeekEntries(userId: number, weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return prisma.workhourEntry.findMany({
    where: { userId, workDate: { gte: weekStart, lt: weekEnd } },
    orderBy: [{ workDate: 'asc' }, { id: 'asc' }],
  });
  // NOTE: 不 include project, 前端 /api/projects 单独拿; 减少 join.
}

/** 项目负责人查所有"待审批" (status=reviewing) 工时, 限于其负责的项目. */
export async function listReviewing(projectLeadId: number) {
  return prisma.workhourEntry.findMany({
    where: {
      status: 'reviewing',
      project: { leadUserId: projectLeadId },
    },
    include: {
      user: { select: { id: true, name: true, employeeId: true } },
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ workDate: 'asc' }, { userId: 'asc' }],
  });
}

/** 批量提交一周给负责人 (draft → reviewing). */
export async function submitWeek(userId: number, weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  return prisma.workhourEntry.updateMany({
    where: { userId, workDate: { gte: weekStart, lt: weekEnd }, status: 'draft' },
    data: { status: 'reviewing', submittedAt: new Date() },
  });
}

/** 周审: approve 一批 (项目负责人). 所有记录必须属于 reviewer 负责的项目, 且为 reviewing 状态. */
export async function approveEntries(reviewerId: number, entryIds: number[]) {
  if (entryIds.length === 0) return { count: 0 };
  const entries = await prisma.workhourEntry.findMany({
    where: { id: { in: entryIds } },
    include: { project: true },
  });
  for (const e of entries) {
    if (e.project.leadUserId !== reviewerId) {
      throw new BusinessError(`记录 ${e.id} 非你负责的项目`);
    }
    if (e.status !== 'reviewing') {
      throw new BusinessError(`记录 ${e.id} 不在 reviewing 状态`);
    }
  }
  return prisma.workhourEntry.updateMany({
    where: { id: { in: entryIds } },
    data: { status: 'approved', approvedAt: new Date() },
  });
}

/** 周审: reject 一批 (项目负责人). 所有记录必须属于 reviewer 负责的项目. */
export async function rejectEntries(reviewerId: number, entryIds: number[], reason: string) {
  if (entryIds.length === 0) return { count: 0 };
  if (!reason || !reason.trim()) throw new BusinessError('驳回必须填原因');
  const entries = await prisma.workhourEntry.findMany({
    where: { id: { in: entryIds } },
    include: { project: true },
  });
  for (const e of entries) {
    if (e.project.leadUserId !== reviewerId) {
      throw new BusinessError(`记录 ${e.id} 非你负责的项目`);
    }
  }
  return prisma.workhourEntry.updateMany({
    where: { id: { in: entryIds } },
    data: { status: 'rejected', rejectedReason: reason },
  });
}

/** 月度按 (人 × 项目) 汇总已批准工时. 可按 user / project / department 过滤. */
export async function monthlyAggregate(
  year: number,
  month: number,
  opts: { userId?: number; projectId?: number; departmentId?: number } = {},
) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  const where: Prisma.WorkhourEntryWhereInput = {
    workDate: { gte: start, lt: end },
    status: 'approved',
    ...(opts.userId ? { userId: opts.userId } : {}),
    ...(opts.projectId ? { projectId: opts.projectId } : {}),
    ...(opts.departmentId ? { user: { departmentId: opts.departmentId } } : {}),
  };
  return prisma.workhourEntry.groupBy({
    by: ['userId', 'projectId'],
    where,
    _sum: { hours: true },
  });
}
