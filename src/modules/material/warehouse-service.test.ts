import { describe, it, expect } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createWarehouse, listWarehouses, updateWarehouse } from './warehouse-service';

describe('warehouse service', () => {
  it('create + list', async () => {
    await createWarehouse({ code: 'rd-warehouse', name: 'R&D 主仓', location: '研发楼 1F' });
    const list = await listWarehouses();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('R&D 主仓');
    expect(list[0].location).toBe('研发楼 1F');
  });

  it('code 重复抛错', async () => {
    await createWarehouse({ code: 'rd-warehouse', name: 'A' });
    await expect(createWarehouse({ code: 'rd-warehouse', name: 'B' })).rejects.toThrow();
  });

  it('update 字段', async () => {
    const w = await createWarehouse({ code: 'rd-warehouse', name: '原名' });
    await updateWarehouse(w.id, { name: '新名', enabled: false });
    const all = await prisma.warehouse.findMany();
    expect(all[0].name).toBe('新名');
    expect(all[0].enabled).toBe(false);
  });
});
