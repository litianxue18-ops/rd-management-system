import type { Prisma } from '@prisma/client';

export interface WorkflowStepDef {
  name: string;           // 显示给用户看的步骤名
  role: string;           // role code, 决定 next_approver 候选池
  /** 可选: 自定义该步骤的具体审批人. 优先于 role-based 候选池. 返回 null 时回落到候选池. */
  resolveAssignee?: (entity: any, tx: Prisma.TransactionClient) => Promise<number | null>;
}

export interface WorkflowHooks<Entity> {
  /** 全部步骤批准后触发. 在事务内调用, 返回的 Promise 必须 await. */
  onApproved?: (entity: Entity, tx: Prisma.TransactionClient) => Promise<void>;
  /** 任一步驳回后触发. */
  onRejected?: (entity: Entity, comments: string, tx: Prisma.TransactionClient) => Promise<void>;
  /** 提交时触发 (在第一步生成前). */
  onSubmit?: (entity: Entity, tx: Prisma.TransactionClient) => Promise<void>;
}

export interface WorkflowDefinition<Entity = any> {
  code: string;           // 唯一标识, 如 'project_approval_v1'
  entityType: string;     // 与 approval_instance.entity_type 对齐
  steps: WorkflowStepDef[];
  /** 加载业务实体. 引擎在 onApproved/onRejected 之前调用. */
  loadEntity: (entityId: number, tx: Prisma.TransactionClient) => Promise<Entity | null>;
  hooks?: WorkflowHooks<Entity>;
}
