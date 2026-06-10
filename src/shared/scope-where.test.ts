import { describe, it, expect } from 'vitest';
import { scopeWhere } from './scope-where';
import { ROLE_CODES as R } from '@/modules/permission/nodes';

const ctx = (roles: string[], departmentId: number | null = 1) => ({
  user: { userId: 99, roles, primaryRole: roles[0] ?? '', tokenVersion: 0 },
  departmentId,
});

describe('scopeWhere', () => {
  it('global → {}', () => {
    expect(scopeWhere(ctx([R.FINANCE_LEAD]), 'project', {
      self:        () => ({ createdById: 99 }),
      responsible: () => ({ leadUserId: 99 }),
      department:  () => ({ departmentId: 1 }),
    })).toEqual({});
  });

  it('responsible → leadUserId 注入', () => {
    expect(scopeWhere(ctx([R.PROJECT_LEAD]), 'project', {
      self:        () => ({ createdById: 99 }),
      responsible: () => ({ leadUserId: 99 }),
      department:  () => ({ departmentId: 1 }),
    })).toEqual({ leadUserId: 99 });
  });

  it('researcher → self', () => {
    expect(scopeWhere(ctx([R.RESEARCHER]), 'project', {
      self:        () => ({ createdById: 99 }),
      responsible: () => ({ leadUserId: 99 }),
    })).toEqual({ createdById: 99 });
  });
});
