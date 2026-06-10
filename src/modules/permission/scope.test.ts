import { describe, it, expect } from 'vitest';
import { resolveScope } from './scope';
import { ROLE_CODES as R } from './nodes';

describe('resolveScope', () => {
  it('researcher 看 user 模块 = self', () => {
    expect(resolveScope([R.RESEARCHER], 'user')).toBe('self');
  });

  it('rd_director 看 user 模块 = department', () => {
    expect(resolveScope([R.RD_DIRECTOR], 'user')).toBe('department');
  });

  it('finance_lead 看 user 模块 = global', () => {
    expect(resolveScope([R.FINANCE_LEAD], 'user')).toBe('global');
  });

  it('super_admin 永远 = global', () => {
    expect(resolveScope([R.SUPER_ADMIN], 'user')).toBe('global');
  });

  it('多角色取最宽', () => {
    expect(resolveScope([R.RESEARCHER, R.RD_DIRECTOR], 'user')).toBe('department');
  });
});
