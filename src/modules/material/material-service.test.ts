import { describe, it, expect } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createMaterial, listMaterials, updateMaterial } from './material-service';

describe('material service', () => {
  it('create + list', async () => {
    await createMaterial({ code: 'BOPET-01', name: 'BOPET 双向拉伸聚酯', unit: 'kg', spec: '12μm', category: '原材料', safetyStock: 100 });
    const list = await listMaterials();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('BOPET 双向拉伸聚酯');
    expect(Number(list[0].safetyStock)).toBe(100);
  });

  it('code 重复抛错', async () => {
    await createMaterial({ code: 'BOPET-01', name: 'A', unit: 'kg' });
    await expect(createMaterial({ code: 'BOPET-01', name: 'B', unit: 'kg' })).rejects.toThrow();
  });

  it('update 字段', async () => {
    const m = await createMaterial({ code: 'BOPET-01', name: '原名', unit: 'kg' });
    await updateMaterial(m.id, { name: '新名', enabled: false });
    const all = await prisma.material.findMany();
    expect(all[0].name).toBe('新名');
    expect(all[0].enabled).toBe(false);
  });
});
