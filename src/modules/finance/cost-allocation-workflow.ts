import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './cost-allocation-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 研发支出分摊计算表 (form 4) 3 步签批:
 *   1. 财务负责人审核
 *   2. 研发负责人审核
 *   3. 总经理批准
 *
 * 最后一步 (总经理) 通过后 status → approved, 该月该项目分摊进入财务勾稽口径
 * (Task D computeFinanceBusiness 用 approved 分摊总额作 expected).
 */
registerWorkflow({
  code: 'cost_allocation_v1',
  entityType: 'cost_allocation',
  steps: [
    { name: '财务负责人审核', role: R.FINANCE_LEAD },
    { name: '研发负责人审核', role: R.RD_DIRECTOR },
    { name: '总经理批准', role: R.CEO },
  ],
  loadEntity: async (id, tx) => tx.costAllocation.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => setApproved(entity.id, tx),
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
