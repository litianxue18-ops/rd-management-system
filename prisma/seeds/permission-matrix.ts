import { PrismaClient } from '@prisma/client';
import { PERMISSION_NODES as N, ROLE_CODES as R } from '../../src/modules/permission/nodes';

type RaciEntry = { node: string; role: string; raci: 'R' | 'A' };

const MATRIX: RaciEntry[] = [
  // 立项
  { node: N.PROJECT_CREATE,         role: R.PROJECT_LEAD,    raci: 'R' },
  { node: N.PROJECT_CREATE,         role: R.PROJECT_LEAD,    raci: 'A' },
  { node: N.PROJECT_INITIAL_REVIEW, role: R.RD_DIRECTOR,     raci: 'R' },
  { node: N.PROJECT_INITIAL_REVIEW, role: R.RD_DIRECTOR,     raci: 'A' },
  { node: N.PROJECT_TECH_REVIEW,    role: R.TECH_COMMITTEE,  raci: 'R' },
  { node: N.PROJECT_TECH_REVIEW,    role: R.TECH_COMMITTEE,  raci: 'A' },
  { node: N.PROJECT_BUDGET_REVIEW,  role: R.FINANCE_LEAD,    raci: 'R' },
  { node: N.PROJECT_BUDGET_REVIEW,  role: R.FINANCE_LEAD,    raci: 'A' },
  { node: N.PROJECT_FINAL_APPROVAL, role: R.CEO,             raci: 'R' },
  { node: N.PROJECT_FINAL_APPROVAL, role: R.CEO,             raci: 'A' },
  { node: N.PROJECT_REGISTER,       role: R.RD_DIRECTOR,     raci: 'R' },
  { node: N.PROJECT_REGISTER,       role: R.RD_DIRECTOR,     raci: 'A' },
  // 工时
  { node: N.WORKHOUR_CREATE,            role: R.RESEARCHER,   raci: 'R' },
  { node: N.WORKHOUR_CREATE,            role: R.RESEARCHER,   raci: 'A' },
  { node: N.WORKHOUR_WEEKLY_REVIEW,     role: R.PROJECT_LEAD, raci: 'R' },
  { node: N.WORKHOUR_WEEKLY_REVIEW,     role: R.PROJECT_LEAD, raci: 'A' },
  { node: N.WORKHOUR_MONTHLY_AGGREGATE, role: R.FINANCE_LEAD, raci: 'R' },
  { node: N.WORKHOUR_MONTHLY_AGGREGATE, role: R.FINANCE_LEAD, raci: 'A' },
  // 月报 + 变更
  { node: N.MONTHLY_REPORT_SUBMIT,   role: R.PROJECT_LEAD, raci: 'R' },
  { node: N.MONTHLY_REPORT_SUBMIT,   role: R.PROJECT_LEAD, raci: 'A' },
  { node: N.PROJECT_CHANGE_APPROVAL, role: R.CEO,          raci: 'R' },
  { node: N.PROJECT_CHANGE_APPROVAL, role: R.CEO,          raci: 'A' },
  // 领料 / 库存
  { node: N.MATERIAL_REQUEST_CREATE,  role: R.RESEARCHER,       raci: 'R' },
  { node: N.MATERIAL_REQUEST_CREATE,  role: R.RESEARCHER,       raci: 'A' },
  { node: N.MATERIAL_REQUEST_APPROVE, role: R.RD_DIRECTOR,      raci: 'R' },
  { node: N.MATERIAL_REQUEST_APPROVE, role: R.RD_DIRECTOR,      raci: 'A' },
  { node: N.INVENTORY_INBOUND,        role: R.WAREHOUSE_KEEPER, raci: 'R' },
  { node: N.INVENTORY_INBOUND,        role: R.WAREHOUSE_KEEPER, raci: 'A' },
  { node: N.INVENTORY_OUTBOUND_EXEC,  role: R.WAREHOUSE_KEEPER, raci: 'R' },
  { node: N.INVENTORY_OUTBOUND_EXEC,  role: R.WAREHOUSE_KEEPER, raci: 'A' },
  { node: N.MATERIAL_USAGE_LOG,       role: R.RESEARCHER,       raci: 'R' },
  { node: N.MATERIAL_USAGE_LOG,       role: R.RESEARCHER,       raci: 'A' },
  { node: N.SAMPLE_SCRAP_REGISTER,    role: R.RESEARCHER,       raci: 'R' },
  { node: N.SAMPLE_SCRAP_REGISTER,    role: R.RESEARCHER,       raci: 'A' },
  { node: N.SAMPLE_SCRAP_SUPERVISE,   role: R.FINANCE_LEAD,     raci: 'R' },
  { node: N.SAMPLE_SCRAP_SUPERVISE,   role: R.FINANCE_LEAD,     raci: 'A' },
  // 试制
  { node: N.TRIAL_MATERIAL_PRODUCE,  role: R.PRODUCTION_LEAD, raci: 'R' },
  { node: N.TRIAL_MATERIAL_PRODUCE,  role: R.PRODUCTION_LEAD, raci: 'A' },
  { node: N.TRIAL_TRANSFER_SUBMIT,   role: R.PROJECT_LEAD,    raci: 'R' },
  { node: N.TRIAL_TRANSFER_SUBMIT,   role: R.PROJECT_LEAD,    raci: 'A' },
  { node: N.TRIAL_TRANSFER_APPROVE,  role: R.CEO,             raci: 'R' },
  { node: N.TRIAL_TRANSFER_APPROVE,  role: R.CEO,             raci: 'A' },
  { node: N.TRIAL_TRANSFER_SETTLE,   role: R.FINANCE_LEAD,    raci: 'R' },
  { node: N.TRIAL_TRANSFER_SETTLE,   role: R.FINANCE_LEAD,    raci: 'A' },
  // 共用资源 / 委外
  { node: N.SHARED_RESOURCE_CONFIG,    role: R.FINANCE_LEAD,   raci: 'R' },
  { node: N.SHARED_RESOURCE_CONFIG,    role: R.FINANCE_LEAD,   raci: 'A' },
  { node: N.OUTSOURCE_CONTRACT_REVIEW, role: R.FINANCE_LEAD,   raci: 'R' },
  { node: N.OUTSOURCE_CONTRACT_REVIEW, role: R.FINANCE_LEAD,   raci: 'A' },
  { node: N.COMMISSIONED_RD_REVIEW,    role: R.FINANCE_LEAD,   raci: 'R' },
  { node: N.COMMISSIONED_RD_REVIEW,    role: R.FINANCE_LEAD,   raci: 'A' },
  // 资本化 + 结项 + 内审 (C 期占位)
  { node: N.CAPITALIZATION_EVALUATE, role: R.TECH_COMMITTEE, raci: 'R' },
  { node: N.CAPITALIZATION_EVALUATE, role: R.TECH_COMMITTEE, raci: 'A' },
  { node: N.CAPITALIZATION_APPROVE,  role: R.CEO,            raci: 'R' },
  { node: N.CAPITALIZATION_APPROVE,  role: R.CEO,            raci: 'A' },
  { node: N.MONTHLY_RECONCILIATION,  role: R.FINANCE_LEAD,   raci: 'R' },
  { node: N.MONTHLY_RECONCILIATION,  role: R.FINANCE_LEAD,   raci: 'A' },
  { node: N.EXCEPTION_NOTE_TRIGGER,  role: R.FINANCE_LEAD,   raci: 'R' },
  { node: N.EXCEPTION_NOTE_TRIGGER,  role: R.FINANCE_LEAD,   raci: 'A' },
  { node: N.QUARTERLY_AUDIT,         role: R.AUDIT_LEAD,     raci: 'R' },
  { node: N.QUARTERLY_AUDIT,         role: R.AUDIT_LEAD,     raci: 'A' },
  { node: N.CLOSING_REPORT_DRAFT,    role: R.PROJECT_LEAD,   raci: 'R' },
  { node: N.CLOSING_REPORT_DRAFT,    role: R.PROJECT_LEAD,   raci: 'A' },
  { node: N.CLOSING_ACCEPTANCE,      role: R.TECH_COMMITTEE, raci: 'R' },
  { node: N.CLOSING_ACCEPTANCE,      role: R.TECH_COMMITTEE, raci: 'A' },
  { node: N.ARCHIVE,                 role: R.RD_DIRECTOR,    raci: 'R' },
  { node: N.ARCHIVE,                 role: R.RD_DIRECTOR,    raci: 'A' },
  // 系统管理: 只给 super_admin (R+A)
  { node: N.ADMIN_VIEW,         role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_VIEW,         role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_USER_MANAGE,  role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_USER_MANAGE,  role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_DEPT_MANAGE,  role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_DEPT_MANAGE,  role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_MATRIX_EDIT,  role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_MATRIX_EDIT,  role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_DICT_MANAGE,  role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_DICT_MANAGE,  role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_INVENTORY_MANAGE, role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_INVENTORY_MANAGE, role: R.SUPER_ADMIN, raci: 'A' },
  { node: N.ADMIN_OUTSOURCE_MANAGE, role: R.SUPER_ADMIN, raci: 'R' },
  { node: N.ADMIN_OUTSOURCE_MANAGE, role: R.SUPER_ADMIN, raci: 'A' },
];

export async function seedPermissionMatrix(prisma: PrismaClient) {
  const roles = await prisma.role.findMany();
  const roleMap = new Map(roles.map((r) => [r.code, r.id]));

  for (const m of MATRIX) {
    const roleId = roleMap.get(m.role);
    if (!roleId) throw new Error(`role not found: ${m.role}`);
    await prisma.rolePermissionNode.upsert({
      where: { roleId_nodeCode_raci: { roleId, nodeCode: m.node, raci: m.raci } },
      update: {},
      create: { roleId, nodeCode: m.node, raci: m.raci },
    });
  }
  console.log(`seeded ${MATRIX.length} permission entries`);
}
