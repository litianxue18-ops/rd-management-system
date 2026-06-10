import { registerWorkflow } from '@/modules/workflow/registry';
import { setReviewing, setApproved, setRejected } from './closing-service';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

/**
 * 结项报告 3 步审批:
 *   1. 项目负责人 (实际由项目 leadUserId 解析具体审批人)
 *   2. 研发中心
 *   3. 技委会
 *
 * 最后一步 (技委会) 通过后:
 *  - closing.status → approved
 *  - 同时 project.status → closed
 */
registerWorkflow({
  code: 'closing_report_v1',
  entityType: 'closing_report',
  steps: [
    {
      name: '项目负责人',
      role: R.PROJECT_LEAD,
      resolveAssignee: async (entity, tx) => {
        const proj = await tx.project.findUnique({
          where: { id: entity.projectId },
          select: { leadUserId: true },
        });
        return proj?.leadUserId ?? null;
      },
    },
    { name: '研发中心', role: R.RD_DIRECTOR },
    { name: '技委会', role: R.TECH_COMMITTEE },
  ],
  loadEntity: async (id, tx) => tx.closingReport.findUnique({ where: { id } }),
  hooks: {
    onSubmit: async (entity, tx) => setReviewing(entity.id, tx),
    onApproved: async (entity, tx) => setApproved(entity.id, tx),
    onRejected: async (entity, comments, tx) =>
      setRejected(entity.id, comments, tx),
  },
});
