import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setActive, setRejected } from './contract-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 委外合同 4 步审批:
 *   1. 研发中心审核
 *   2. 技委会评审
 *   3. 财务部审核
 *   4. 总经理批准
 *
 * 最后一步 (总经理) 通过后, status → active. 之后由财务通过
 * payment-service.registerPayment 登记付款; 累计 == totalAmount 时
 * 自动 → completed.
 */
registerWorkflow({
  code: 'outsource_contract_v1',
  entityType: 'outsource_contract',
  steps: [
    { name: '研发中心审核', role: R.RD_DIRECTOR },
    { name: '技委会评审', role: R.TECH_COMMITTEE },
    { name: '财务部审核', role: R.FINANCE_LEAD },
    { name: '总经理批准', role: R.CEO },
  ],
  loadEntity: async (id, tx) =>
    tx.outsourceContract.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => setActive(entity.id, tx),
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
