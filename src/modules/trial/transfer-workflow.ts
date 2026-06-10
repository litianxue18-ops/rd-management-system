import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './transfer-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 试制费用转嫁单 4 步审批:
 *   1. 生产部确认
 *   2. 研发负责人确认
 *   3. 财务部审核
 *   4. 总经理批准
 *
 * 最后一步 (总经理) 通过后, status 直接 settled (简化: 跳过中间 approved
 * 等结转 状态, 一并由 hook 处理).
 */
registerWorkflow({
  code: 'trial_transfer_v1',
  entityType: 'trial_cost_transfer',
  steps: [
    { name: '生产部确认', role: R.PRODUCTION_LEAD },
    { name: '研发负责人确认', role: R.RD_DIRECTOR },
    { name: '财务部审核', role: R.FINANCE_LEAD },
    { name: '总经理批准', role: R.CEO },
  ],
  loadEntity: async (id, tx) =>
    tx.trialCostTransfer.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => setApproved(entity.id, tx),
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
