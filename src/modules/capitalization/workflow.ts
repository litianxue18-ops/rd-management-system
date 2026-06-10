import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './capitalization-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 资本化评估 4 步审批:
 *   1. 研发中心初评
 *   2. 技委会评审
 *   3. 财务部审核
 *   4. 总经理批准
 *
 * 最后一步 (CEO) 通过后:
 *  - capitalization.status → approved
 */
registerWorkflow({
  code: 'capitalization_v1',
  entityType: 'capitalization_report',
  steps: [
    { name: '研发中心初评', role: R.RD_DIRECTOR },
    { name: '技委会评审', role: R.TECH_COMMITTEE },
    { name: '财务部审核', role: R.FINANCE_LEAD },
    { name: '总经理批准', role: R.CEO },
  ],
  loadEntity: async (id, tx) =>
    tx.capitalizationReport.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => setApproved(entity.id, tx),
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
