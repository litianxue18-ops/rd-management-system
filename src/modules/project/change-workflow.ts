import { registerWorkflow } from '@/modules/workflow/registry';
import { applyChange, markChangeRejected } from './change-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

registerWorkflow({
  code: 'project_change_v1',
  entityType: 'project_change',
  steps: [
    { name: '研发中心初审',   role: R.RD_DIRECTOR },
    { name: '技委会评审',     role: R.TECH_COMMITTEE },
    { name: '财务部预算审核', role: R.FINANCE_LEAD },
    { name: '总经理批准',     role: R.CEO },
  ],
  loadEntity: async (id, tx) => tx.projectChangeRequest.findUnique({ where: { id } }),
  hooks: {
    onApproved: async (entity, tx) => {
      await applyChange(entity.id, tx);
    },
    onRejected: async (entity, comments, tx) => {
      await markChangeRejected(entity.id, comments, tx);
    },
  },
});
