import { describe, it, expect } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createDepartment, listDepartments, updateDepartment, disableDepartment } from './department-service';

describe('department service', () => {
  it('create + list', async () => {
    await createDepartment({ code: 'rd', name: '研发中心' });
    const list = await listDepartments();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('研发中心');
  });

  it('code 重复抛错', async () => {
    await createDepartment({ code: 'rd', name: '研发中心' });
    await expect(createDepartment({ code: 'rd', name: 'X' })).rejects.toThrow();
  });

  it('update name', async () => {
    const d = await createDepartment({ code: 'rd', name: '研发中心' });
    await updateDepartment(d.id, { name: '技术中心' });
    const list = await listDepartments();
    expect(list[0].name).toBe('技术中心');
  });

  it('disable 软删', async () => {
    const d = await createDepartment({ code: 'rd', name: '研发中心' });
    await disableDepartment(d.id);
    const all = await listDepartments({ includeDisabled: true });
    expect(all[0].enabled).toBe(false);
    const active = await listDepartments();
    expect(active).toHaveLength(0);
  });
});
