import { describe, it, expect } from 'vitest';
import { prisma } from '@/shared/prisma';

describe('schema 基本完整性', () => {
  it('能创建一个部门', async () => {
    const d = await prisma.department.create({ data: { code: 'rd_center', name: '研发中心' } });
    expect(d.id).toBeGreaterThan(0);
    expect(d.enabled).toBe(true);
  });
});
