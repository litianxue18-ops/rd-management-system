import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { can, requireNode } from './engine';
import { PERMISSION_NODES as N, ROLE_CODES as R } from './nodes';
import { ForbiddenError } from '@/shared/errors';
import { seedRoles } from '../../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../../prisma/seeds/permission-matrix';

beforeEach(async () => {
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('can()', () => {
  it('研发中心负责人能做立项初审', async () => {
    expect(await can({ userId: 1, roles: [R.RD_DIRECTOR], primaryRole: R.RD_DIRECTOR, tokenVersion: 0 }, N.PROJECT_INITIAL_REVIEW)).toBe(true);
  });

  it('研发员不能做立项初审', async () => {
    expect(await can({ userId: 2, roles: [R.RESEARCHER], primaryRole: R.RESEARCHER, tokenVersion: 0 }, N.PROJECT_INITIAL_REVIEW)).toBe(false);
  });

  it('多角色 任一有权即通过', async () => {
    expect(await can({ userId: 3, roles: [R.RESEARCHER, R.RD_DIRECTOR], primaryRole: R.RESEARCHER, tokenVersion: 0 }, N.PROJECT_INITIAL_REVIEW)).toBe(true);
  });
});

describe('requireNode()', () => {
  it('无权抛 ForbiddenError', async () => {
    await expect(requireNode({ userId: 4, roles: [R.RESEARCHER], primaryRole: R.RESEARCHER, tokenVersion: 0 }, N.PROJECT_INITIAL_REVIEW))
      .rejects.toBeInstanceOf(ForbiddenError);
  });
});
