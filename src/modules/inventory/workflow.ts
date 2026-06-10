import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './outbound-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 领料申请 2 步审批:
 *   1. 项目负责人审核 (resolveAssignee 直接路由到 project.leadUserId, 不走候选池)
 *   2. 研发中心审批   (走 candidatesForRole RD_DIRECTOR)
 *
 * entityType = 'material_request', 与 inventory_outbound 表解耦 (M5+ 样品台账
 * 可能用别的方式产生 outbound, 不污染这层 workflow).
 */
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
      // approverId = 最后一步的 actedBy
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
