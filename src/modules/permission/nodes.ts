export const PERMISSION_NODES = {
  // 立项
  PROJECT_CREATE:            'project_create',
  PROJECT_INITIAL_REVIEW:    'project_initial_review',
  PROJECT_TECH_REVIEW:       'project_tech_review',
  PROJECT_BUDGET_REVIEW:     'project_budget_review',
  PROJECT_FINAL_APPROVAL:    'project_final_approval',
  PROJECT_REGISTER:          'project_register',
  // 工时
  WORKHOUR_CREATE:           'workhour_create',
  WORKHOUR_WEEKLY_REVIEW:    'workhour_weekly_review',
  WORKHOUR_MONTHLY_AGGREGATE:'workhour_monthly_aggregate',
  // 月报
  MONTHLY_REPORT_SUBMIT:     'monthly_report_submit',
  PROJECT_CHANGE_APPROVAL:   'project_change_approval',
  // 领料 / 库存
  MATERIAL_REQUEST_CREATE:   'material_request_create',
  MATERIAL_REQUEST_APPROVE:  'material_request_approve',
  INVENTORY_INBOUND:         'inventory_inbound',
  INVENTORY_OUTBOUND_EXEC:   'inventory_outbound_exec',
  MATERIAL_USAGE_LOG:        'material_usage_log',
  SAMPLE_SCRAP_REGISTER:     'sample_scrap_register',
  SAMPLE_SCRAP_SUPERVISE:    'sample_scrap_supervise',
  // 试制
  TRIAL_MATERIAL_PRODUCE:    'trial_material_produce',
  TRIAL_TRANSFER_SUBMIT:     'trial_transfer_submit',
  TRIAL_TRANSFER_APPROVE:    'trial_transfer_approve',
  TRIAL_TRANSFER_SETTLE:     'trial_transfer_settle',
  // 共用资源
  SHARED_RESOURCE_CONFIG:    'shared_resource_config',
  // 委外
  OUTSOURCE_CONTRACT_REVIEW: 'outsource_contract_review',
  COMMISSIONED_RD_REVIEW:    'commissioned_rd_review',
  // 资本化 (C 期占位)
  CAPITALIZATION_EVALUATE:   'capitalization_evaluate',
  CAPITALIZATION_APPROVE:    'capitalization_approve',
  // 内审
  MONTHLY_RECONCILIATION:    'monthly_reconciliation',
  EXCEPTION_NOTE_TRIGGER:    'exception_note_trigger',
  QUARTERLY_AUDIT:           'quarterly_audit',
  // 结项 (C 期占位)
  CLOSING_REPORT_DRAFT:      'closing_report_draft',
  CLOSING_ACCEPTANCE:        'closing_acceptance',
  ARCHIVE:                   'archive',
  // 系统管理 (super_admin 专用; 默认 super_admin = R+A)
  ADMIN_VIEW:                'admin_view',
  ADMIN_USER_MANAGE:         'admin_user_manage',
  ADMIN_DEPT_MANAGE:         'admin_dept_manage',
  ADMIN_MATRIX_EDIT:         'admin_matrix_edit',
  ADMIN_DICT_MANAGE:         'admin_dict_manage',
  ADMIN_INVENTORY_MANAGE:    'admin_inventory_manage',
  ADMIN_OUTSOURCE_MANAGE:    'admin_outsource_manage',
} as const;

export type PermissionNode = typeof PERMISSION_NODES[keyof typeof PERMISSION_NODES];

export const ROLE_CODES = {
  PROJECT_LEAD:     'project_lead',
  RD_DIRECTOR:      'rd_director',
  TECH_COMMITTEE:   'tech_committee',
  RESEARCHER:       'researcher',
  PRODUCTION_LEAD:  'production_lead',
  PURCHASE_LEAD:    'purchase_lead',
  WAREHOUSE_KEEPER: 'warehouse_keeper',
  EQUIPMENT_LEAD:   'equipment_lead',
  HR_LEAD:          'hr_lead',
  FINANCE_LEAD:     'finance_lead',
  AUDIT_LEAD:       'audit_lead',
  CEO:              'ceo',
  SUPER_ADMIN:      'super_admin',  // 系统角色, 不参与业务
} as const;

export type RoleCode = typeof ROLE_CODES[keyof typeof ROLE_CODES];
