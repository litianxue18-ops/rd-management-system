import { describe, it, expect } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createProjectType, listProjectTypes, updateProjectType } from './project-type-service';
import { BusinessError } from '@/shared/errors';

describe('project-type service', () => {
  it('create + list', async () => {
    await createProjectType({ code: 'MAT', name: '新材料' });
    const list = await listProjectTypes();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('新材料');
  });

  it('重复编码 → BusinessError', async () => {
    await createProjectType({ code: 'MAT', name: '新材料' });
    await expect(createProjectType({ code: 'MAT', name: 'X' })).rejects.toBeInstanceOf(BusinessError);
  });

  it('disable', async () => {
    const t = await createProjectType({ code: 'MAT', name: '新材料' });
    await updateProjectType(t.id, { enabled: false });
    const active = await listProjectTypes();
    expect(active).toHaveLength(0);
  });
});
