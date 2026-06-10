import { registerWorkflow } from '@/modules/workflow/registry';
import { markApproved, markRejected, setReviewing } from './monthly-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

registerWorkflow({
  code: 'monthly_report_v1',
  entityType: 'monthly_report',
  steps: [
    { name: '财务负责人审核', role: R.FINANCE_LEAD },
    { name: '研发负责人审核', role: R.RD_DIRECTOR },
    { name: '总经理批准',     role: R.CEO },
  ],
  loadEntity: async (id, tx) => tx.monthlyReport.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => markApproved(entity.id, tx),
    onRejected: async (entity, comments, tx) => markRejected(entity.id, comments, tx),
  },
});
