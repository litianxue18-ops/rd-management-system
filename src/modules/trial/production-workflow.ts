import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './production-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 试制生产任务单 2 步审批:
 *   1. 项目负责人审核  (resolveAssignee 路由到 project.leadUserId)
 *   2. 生产部接单      (走 candidatesForRole PRODUCTION_LEAD)
 *
 * 最后一步 (生产部接单) 通过后, productionLeadId = 该步 actedBy
 * 之后由生产部本人填实际产出 → status=completed (不走 workflow).
 */
registerWorkflow({
  code: 'trial_production_v1',
  entityType: 'trial_production_order',
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
    { name: '生产部接单', role: R.PRODUCTION_LEAD },
  ],
  loadEntity: async (id, tx) =>
    tx.trialProductionOrder.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => {
      const lastStep = await tx.approvalStep.findFirst({
        where: {
          instance: {
            entityType: 'trial_production_order',
            entityId: entity.id,
          },
          status: 'approved',
        },
        orderBy: { stepIndex: 'desc' },
      });
      await setApproved(entity.id, lastStep?.actedBy ?? null, tx);
    },
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
