import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import { tryCreateUnique } from '@/shared/prisma-helpers';
import { generateDocNo } from '@/modules/inventory/doc-no-generator';
import type { Prisma } from '@prisma/client';

export interface ClosingInput {
  projectId: number;
  basicSummary: string;
  goalReview: string;
  outputs: string;
  budgetReview: string;
  lessons: string;
  conversionPlan: string;
}

/**
 * 创建结项报告 (status=draft).
 * 校验:
 *  - 项目存在 + status=active
 *  - 创建者必须是 project.leadUserId
 *  - 每个项目仅一份结项报告 (DB @@unique(projectId) + tryCreateUnique 兜底)
 */
export async function createClosing(creatorId: number, input: ClosingInput) {
  const proj = await prisma.project.findUnique({
    where: { id: input.projectId },
  });
  if (!proj) throw new BusinessError('项目不存在');
  if (proj.status !== 'active') {
    throw new BusinessError('仅 active 项目可发起结项');
  }
  if (proj.leadUserId !== creatorId) {
    throw new BusinessError('仅项目负责人可发起结项');
  }

  return tryCreateUnique(
    () =>
      prisma.$transaction(async (tx) => {
        const docNo = await generateDocNo(tx, 'cl');
        return tx.closingReport.create({
          data: {
            docNo,
            projectId: input.projectId,
            basicSummary: input.basicSummary,
            goalReview: input.goalReview,
            outputs: input.outputs,
            budgetReview: input.budgetReview,
            lessons: input.lessons,
            conversionPlan: input.conversionPlan,
            createdById: creatorId,
            status: 'draft',
          },
          include: {
            project: { select: { id: true, code: true, name: true } },
          },
        });
      }),
    '该项目已有结项报告',
  );
}

export async function listClosings(
  opts: { projectId?: number; status?: string } = {},
) {
  return prisma.closingReport.findMany({
    where: {
      ...(opts.projectId ? { projectId: opts.projectId } : {}),
      ...(opts.status ? { status: opts.status as any } : {}),
    },
    include: {
      project: { select: { id: true, code: true, name: true } },
    },
    orderBy: { id: 'desc' },
  });
}

export async function getClosing(id: number) {
  return prisma.closingReport.findUnique({
    where: { id },
    include: { project: true },
  });
}

export async function updateDraft(
  id: number,
  userId: number,
  patch: Partial<Omit<ClosingInput, 'projectId'>>,
) {
  const c = await prisma.closingReport.findUnique({ where: { id } });
  if (!c) throw new BusinessError('结项报告不存在');
  if (c.status !== 'draft') throw new BusinessError('仅 draft 可编辑');
  if (c.createdById !== userId) throw new BusinessError('仅创建人可编辑');
  const data: Prisma.ClosingReportUpdateInput = {};
  if (patch.basicSummary !== undefined) data.basicSummary = patch.basicSummary;
  if (patch.goalReview !== undefined) data.goalReview = patch.goalReview;
  if (patch.outputs !== undefined) data.outputs = patch.outputs;
  if (patch.budgetReview !== undefined) data.budgetReview = patch.budgetReview;
  if (patch.lessons !== undefined) data.lessons = patch.lessons;
  if (patch.conversionPlan !== undefined) data.conversionPlan = patch.conversionPlan;
  return prisma.closingReport.update({ where: { id }, data });
}

// ===== workflow hooks =====

/** workflow hook (onSubmit): draft → reviewing. */
export async function setReviewing(id: number, tx: Prisma.TransactionClient) {
  await tx.closingReport.update({
    where: { id },
    data: { status: 'reviewing' },
  });
}

/**
 * workflow hook (onApproved 最后一步=技委会):
 *  - closing.status → approved
 *  - 同时项目 project.status → closed
 */
export async function setApproved(id: number, tx: Prisma.TransactionClient) {
  const c = await tx.closingReport.update({
    where: { id },
    data: { status: 'approved', approvedAt: new Date() },
  });
  await tx.project.update({
    where: { id: c.projectId },
    data: { status: 'closed' },
  });
}

/** workflow hook (onRejected): → rejected + 存原因. */
export async function setRejected(
  id: number,
  reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.closingReport.update({
    where: { id },
    data: { status: 'rejected', rejectedReason: reason },
  });
}

/** 标记档案已生成. archivedAt 独立于 status, 可多次重新归档下载. */
export async function markArchived(id: number) {
  return prisma.closingReport.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
}
