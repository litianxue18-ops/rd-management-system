import { registerWorkflow } from '@/modules/workflow/registry';
import { activateProject, markProjectRejected } from './project-service';
import { notifyRoles } from '@/modules/workflow/notify';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

registerWorkflow({
  code: 'project_approval_v1',
  entityType: 'project',
  steps: [
    { name: '研发中心初审',   role: R.RD_DIRECTOR },
    { name: '技委会评审',     role: R.TECH_COMMITTEE },
    { name: '财务部预算审核', role: R.FINANCE_LEAD },
    { name: '总经理批准',     role: R.CEO },
  ],
  loadEntity: async (id, tx) => tx.project.findUnique({ where: { id } }),
  hooks: {
    onApproved: async (entity, tx) => {
      await activateProject(entity.id, tx);
      await notifyRoles(
        [R.PRODUCTION_LEAD, R.PURCHASE_LEAD],
        {
          eventType: 'project_approved',
          entityType: 'project',
          entityId: entity.id,
          message: `项目 ${entity.name} 立项通过`,
        },
        tx,
      );
    },
    onRejected: async (entity, comments, tx) => {
      await markProjectRejected(entity.id, comments, tx);
    },
  },
});
