import { prisma } from '@/shared/prisma';
import { BusinessError, ForbiddenError } from '@/shared/errors';
import { getWorkflow } from './registry';
import type { JwtPayload } from '@/modules/auth/jwt';
import type { Prisma } from '@prisma/client';
import type { WorkflowStepDef } from './types';

interface SubmitInput { workflowCode: string; entityId: number; }
interface StepActionInput { stepId: number; comments?: string; }
interface TransferInput extends StepActionInput { toUserId: number; }
interface WithdrawInput { instanceId: number; }

/** 找出某角色的所有候选用户 id. */
async function candidatesForRole(roleCode: string, tx?: Prisma.TransactionClient): Promise<number[]> {
  const client = tx ?? prisma;
  const rows = await client.userRole.findMany({
    where: { role: { code: roleCode }, user: { isActive: true } },
    select: { userId: true },
  });
  return rows.map((r) => r.userId);
}

/** 解析一步的具体审批人: 优先用 resolveAssignee, 失败回落 candidatesForRole. */
async function resolveStepAssignee(
  tx: Prisma.TransactionClient,
  stepDef: WorkflowStepDef,
  entity: any,
): Promise<number | null> {
  if (stepDef.resolveAssignee) {
    const userId = await stepDef.resolveAssignee(entity, tx);
    if (userId !== null && userId !== undefined) return userId;
  }
  const candidates = await candidatesForRole(stepDef.role, tx);
  return candidates[0] ?? null;
}

/**
 * 创建 instance + step 1 (在事务内调用). 返回 instance.
 */
async function createInstanceAndFirstStep(
  tx: Prisma.TransactionClient,
  workflowCode: string,
  entityType: string,
  entityId: number,
  submitterId: number,
  steps: WorkflowStepDef[],
  entity: any,
) {
  const instance = await tx.approvalInstance.create({
    data: {
      entityType, entityId, workflowCode,
      status: 'running',
      submittedBy: submitterId,
    },
  });
  const assignedUserId = await resolveStepAssignee(tx, steps[0], entity);
  const firstStep = await tx.approvalStep.create({
    data: {
      instanceId: instance.id,
      stepIndex: 1,
      stepName: steps[0].name,
      requiredRole: steps[0].role,
      assignedUserId,
      status: 'pending',
    },
  });
  const updated = await tx.approvalInstance.update({
    where: { id: instance.id },
    data: { currentStepId: firstStep.id },
  });
  await tx.approvalLog.create({
    data: { instanceId: instance.id, stepId: firstStep.id, action: 'submit', actorId: submitterId },
  });
  return updated;
}

export async function submit(user: JwtPayload, input: SubmitInput) {
  const def = getWorkflow(input.workflowCode);
  return prisma.$transaction(async (tx) => {
    const entity = await def.loadEntity(input.entityId, tx);
    if (!entity) throw new BusinessError(`业务实体不存在: ${def.entityType}#${input.entityId}`, 'ENTITY_NOT_FOUND');
    if (def.hooks?.onSubmit) await def.hooks.onSubmit(entity, tx);
    return createInstanceAndFirstStep(tx, def.code, def.entityType, input.entityId, user.userId, def.steps, entity);
  });
}

async function loadStepOrThrow(tx: Prisma.TransactionClient, stepId: number) {
  const step = await tx.approvalStep.findUnique({
    where: { id: stepId },
    include: { instance: true },
  });
  if (!step) throw new BusinessError('审批步骤不存在', 'STEP_NOT_FOUND');
  return step;
}

function assertAssignedTo(step: { assignedUserId: number | null; requiredRole: string; status: string }, user: JwtPayload) {
  if (step.status !== 'pending') throw new BusinessError('此步骤已处理', 'STEP_NOT_PENDING');
  if (step.assignedUserId !== null && step.assignedUserId !== user.userId) {
    throw new ForbiddenError('该步骤未分配给当前用户');
  }
  if (!user.roles.includes(step.requiredRole)) {
    throw new ForbiddenError(`无权操作: 需要角色 ${step.requiredRole}`);
  }
}

export async function approve(user: JwtPayload, input: StepActionInput) {
  return prisma.$transaction(async (tx) => {
    const step = await loadStepOrThrow(tx, input.stepId);
    assertAssignedTo(step, user);
    const def = getWorkflow(step.instance.workflowCode);

    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: 'approved', actedBy: user.userId, actedAt: new Date(), comments: input.comments ?? null },
    });
    await tx.approvalLog.create({
      data: { instanceId: step.instance.id, stepId: step.id, action: 'approve', actorId: user.userId, comments: input.comments ?? null },
    });

    const hasNext = step.stepIndex < def.steps.length;
    if (hasNext) {
      const nextDef = def.steps[step.stepIndex];  // 0-indexed; step.stepIndex is 1-based current
      const entity = await def.loadEntity(step.instance.entityId, tx);
      const assignedUserId = await resolveStepAssignee(tx, nextDef, entity);
      const next = await tx.approvalStep.create({
        data: {
          instanceId: step.instance.id,
          stepIndex: step.stepIndex + 1,
          stepName: nextDef.name,
          requiredRole: nextDef.role,
          assignedUserId,
          status: 'pending',
        },
      });
      await tx.approvalInstance.update({ where: { id: step.instance.id }, data: { currentStepId: next.id } });
      return { instance: { ...step.instance }, advancedTo: next };
    } else {
      await tx.approvalInstance.update({
        where: { id: step.instance.id },
        data: { status: 'approved', finishedAt: new Date(), currentStepId: null },
      });
      const entity = await def.loadEntity(step.instance.entityId, tx);
      if (entity && def.hooks?.onApproved) await def.hooks.onApproved(entity, tx);
      return { instance: { ...step.instance, status: 'approved' as const }, advancedTo: null };
    }
  });
}

export async function reject(user: JwtPayload, input: StepActionInput) {
  return prisma.$transaction(async (tx) => {
    const step = await loadStepOrThrow(tx, input.stepId);
    assertAssignedTo(step, user);
    const def = getWorkflow(step.instance.workflowCode);

    await tx.approvalStep.update({
      where: { id: step.id },
      data: { status: 'rejected', actedBy: user.userId, actedAt: new Date(), comments: input.comments ?? null },
    });
    await tx.approvalLog.create({
      data: { instanceId: step.instance.id, stepId: step.id, action: 'reject', actorId: user.userId, comments: input.comments ?? null },
    });
    await tx.approvalInstance.update({
      where: { id: step.instance.id },
      data: { status: 'rejected', finishedAt: new Date(), currentStepId: null },
    });

    const entity = await def.loadEntity(step.instance.entityId, tx);
    if (entity && def.hooks?.onRejected) await def.hooks.onRejected(entity, input.comments ?? '', tx);
  });
}

export async function withdraw(user: JwtPayload, input: WithdrawInput) {
  return prisma.$transaction(async (tx) => {
    const inst = await tx.approvalInstance.findUnique({ where: { id: input.instanceId } });
    if (!inst) throw new BusinessError('实例不存在', 'INSTANCE_NOT_FOUND');
    if (inst.submittedBy !== user.userId) throw new ForbiddenError('只有提交人能撤回');
    if (inst.status !== 'running') throw new BusinessError('实例已结束', 'INSTANCE_FINISHED');

    const firstStep = await tx.approvalStep.findFirstOrThrow({ where: { instanceId: inst.id, stepIndex: 1 } });
    if (firstStep.status !== 'pending') throw new BusinessError('已开始审批, 无法撤回', 'STEP_ALREADY_ACTED');

    await tx.approvalInstance.update({
      where: { id: inst.id },
      data: { status: 'cancelled', finishedAt: new Date(), currentStepId: null },
    });
    await tx.approvalLog.create({ data: { instanceId: inst.id, action: 'withdraw', actorId: user.userId } });
  });
}

export async function transfer(user: JwtPayload, input: TransferInput) {
  return prisma.$transaction(async (tx) => {
    const step = await loadStepOrThrow(tx, input.stepId);
    assertAssignedTo(step, user);

    // 校验 target 是否拥有该角色
    const targetRoles = await tx.userRole.findMany({
      where: { userId: input.toUserId },
      include: { role: true },
    });
    if (!targetRoles.some((ur) => ur.role.code === step.requiredRole)) {
      throw new BusinessError('转交目标角色不匹配', 'TRANSFER_ROLE_MISMATCH');
    }

    await tx.approvalStep.update({
      where: { id: step.id },
      data: { assignedUserId: input.toUserId },
    });
    await tx.approvalLog.create({
      data: {
        instanceId: step.instance.id, stepId: step.id, action: 'transfer',
        actorId: user.userId, targetUserId: input.toUserId, comments: input.comments ?? null,
      },
    });
  });
}

export interface TodoItem {
  stepId: number;
  instanceId: number;
  entityType: string;
  entityId: number;
  workflowCode: string;
  stepName: string;
  submittedBy: number;
  submittedAt: Date;
}

export async function listTodo(user: JwtPayload): Promise<TodoItem[]> {
  const rows = await prisma.approvalStep.findMany({
    where: { assignedUserId: user.userId, status: 'pending', instance: { status: 'running' } },
    include: { instance: true },
    orderBy: { id: 'asc' },
  });
  return rows.map((s) => ({
    stepId: s.id,
    instanceId: s.instanceId,
    entityType: s.instance.entityType,
    entityId: s.instance.entityId,
    workflowCode: s.instance.workflowCode,
    stepName: s.stepName,
    submittedBy: s.instance.submittedBy,
    submittedAt: s.instance.submittedAt,
  }));
}
