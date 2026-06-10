import { ROLE_CODES as R } from './nodes';

export type Scope = 'self' | 'responsible' | 'department' | 'global';
export type ModuleKey = 'user' | 'project' | 'workhour' | 'material' | 'monthly_report';

const SCOPE_ORDER: Record<Scope, number> = { self: 1, responsible: 2, department: 3, global: 4 };

const RULES: Record<ModuleKey, Partial<Record<string, Scope>>> = {
  user: {
    [R.SUPER_ADMIN]:    'global',
    [R.HR_LEAD]:        'global',
    [R.CEO]:            'global',
    [R.FINANCE_LEAD]:   'global',
    [R.AUDIT_LEAD]:     'global',
    [R.RD_DIRECTOR]:    'department',
    [R.PROJECT_LEAD]:   'department',
    [R.RESEARCHER]:     'self',
  },
  project: {
    [R.SUPER_ADMIN]:    'global',
    [R.CEO]:            'global',
    [R.FINANCE_LEAD]:   'global',
    [R.AUDIT_LEAD]:     'global',
    [R.TECH_COMMITTEE]: 'global',
    [R.PRODUCTION_LEAD]:'global',
    [R.RD_DIRECTOR]:    'department',
    [R.PROJECT_LEAD]:   'responsible',
    [R.RESEARCHER]:     'self',
  },
  workhour: {
    [R.SUPER_ADMIN]:    'global',
    [R.FINANCE_LEAD]:   'global',
    [R.AUDIT_LEAD]:     'global',
    [R.RD_DIRECTOR]:    'department',
    [R.PROJECT_LEAD]:   'responsible',
    [R.RESEARCHER]:     'self',
  },
  material: {
    [R.SUPER_ADMIN]:    'global',
    [R.FINANCE_LEAD]:   'global',
    [R.WAREHOUSE_KEEPER]:'global',
    [R.RD_DIRECTOR]:    'department',
    [R.PROJECT_LEAD]:   'responsible',
    [R.RESEARCHER]:     'self',
  },
  monthly_report: {
    [R.SUPER_ADMIN]:    'global',
    [R.CEO]:            'global',
    [R.FINANCE_LEAD]:   'global',
    [R.RD_DIRECTOR]:    'department',
    [R.PROJECT_LEAD]:   'responsible',
    [R.RESEARCHER]:     'self',
  },
};

export function resolveScope(userRoles: string[], module: ModuleKey): Scope {
  let best: Scope = 'self';
  for (const code of userRoles) {
    const s = RULES[module]?.[code];
    if (s && SCOPE_ORDER[s] > SCOPE_ORDER[best]) best = s;
  }
  return best;
}
