import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';
import type { Prisma } from '@prisma/client';

export interface CreateChangeInput {
  reason: string;
  scope: string;
  details: string;
  newBudget?: number;
  newEndDate?: Date;
}

export async function createChangeRequest(
  projectId: number,
  userId: number,
  input: CreateChangeInput,
) {
  const proj = await prisma.project.findUnique({ where: { id: projectId } });
  if (!proj) throw new BusinessError('项目不存在', 'PROJECT_NOT_FOUND');
  if (proj.status !== 'active') {
    throw new BusinessError('仅 active 项目可发起变更', 'PROJECT_NOT_ACTIVE');
  }
  return prisma.projectChangeRequest.create({
    data: {
      projectId,
      createdById: userId,
      reason: input.reason,
      scope: input.scope,
      details: input.details,
      newBudget: input.newBudget ?? null,
      newEndDate: input.newEndDate ?? null,
    },
  });
}

export async function listChanges(projectId: number) {
  return prisma.projectChangeRequest.findMany({
    where: { projectId },
    orderBy: { id: 'desc' },
  });
}

export async function getChange(id: number) {
  return prisma.projectChangeRequest.findUnique({ where: { id } });
}

/** workflow onApproved hook: 套用变更到主表. */
export async function applyChange(changeId: number, tx: Prisma.TransactionClient) {
  const change = await tx.projectChangeRequest.findUniqueOrThrow({
    where: { id: changeId },
  });
  const patch: Prisma.ProjectUpdateInput = {};
  if (change.newBudget !== null) patch.budget = change.newBudget;
  if (change.newEndDate !== null) patch.endDate = change.newEndDate;
  if (Object.keys(patch).length > 0) {
    await tx.project.update({ where: { id: change.projectId }, data: patch });
  }
  await tx.projectChangeRequest.update({
    where: { id: changeId },
    data: { status: 'active', appliedAt: new Date() },
  });
}

export async function markChangeRejected(
  changeId: number,
  _reason: string,
  tx: Prisma.TransactionClient,
) {
  await tx.projectChangeRequest.update({
    where: { id: changeId },
    data: { status: 'rejected' },
  });
}
