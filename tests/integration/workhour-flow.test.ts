import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import {
  upsertEntry,
  submitWeek,
  approveEntries,
} from '@/modules/workhour/workhour-service';
import { getProjectLaborCost } from '@/modules/workhour/labor-cost';

beforeEach(async () => {
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('工时端到端', () => {
  it('researcher 填一周 → submit → lead approve → labor_cost view 汇总正确', async () => {
    // 1. 准备用户 / 部门 / 项目 / 成员关系
    const dept = await prisma.department.create({
      data: { code: 'rd', name: '研发' },
    });
    const typeRow = await prisma.projectType.create({
      data: { code: 'MAT', name: '新材料' },
    });

    async function makeUser(name: string, role: string, hourlyCost: number) {
      const u = await prisma.user.create({
        data: {
          username: name,
          employeeId: name.toUpperCase(),
          name,
          passwordHash: await hashPassword('p'),
          departmentId: dept.id,
          hourlyCost,
        },
      });
      const r = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({
        data: { userId: u.id, roleId: r.id, isPrimary: true },
      });
      return u.id;
    }
    const leadId = await makeUser('plead', R.PROJECT_LEAD, 150);
    const researcherId = await makeUser('res', R.RESEARCHER, 100);

    const project = await prisma.project.create({
      data: {
        code: 'P-E2E-1',
        name: 'E2E 工时',
        projectTypeId: typeRow.id,
        departmentId: dept.id,
        leadUserId: leadId,
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 100000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        members: {
          create: [
            { userId: leadId, role: '负责人', isLead: true },
            { userId: researcherId, role: '主研' },
          ],
        },
      },
    });

    // 2. researcher 填周一-周五 5 条
    const monday = new Date('2026-06-01'); // 2026-06-01 是周一
    const days = [0, 1, 2, 3, 4]; // Mon-Fri
    const hoursPerDay = [8, 8, 8, 8, 4]; // 总 36h
    const ids: number[] = [];
    for (let i = 0; i < days.length; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + days[i]);
      const e = await upsertEntry(researcherId, {
        projectId: project.id,
        workDate: d,
        hours: hoursPerDay[i],
        workContent: `day ${i + 1}`,
      });
      ids.push(e.id);
      expect(e.status).toBe('draft');
    }

    // 3. submitWeek → status='reviewing'
    const submitted = await submitWeek(researcherId, monday);
    expect(submitted.count).toBe(5);
    const afterSubmit = await prisma.workhourEntry.findMany({
      where: { id: { in: ids } },
    });
    expect(afterSubmit.every((e) => e.status === 'reviewing')).toBe(true);

    // 4. lead approveEntries(all)
    const approvedRes = await approveEntries(leadId, ids);
    expect(approvedRes.count).toBe(5);
    const afterApprove = await prisma.workhourEntry.findMany({
      where: { id: { in: ids } },
    });
    expect(afterApprove.every((e) => e.status === 'approved')).toBe(true);

    // 5. v_project_labor_cost view: SUM(36) * 100 = 3600
    const cost = await getProjectLaborCost(project.id);
    expect(cost).not.toBeNull();
    expect(cost!.totalHours).toBe(36);
    expect(cost!.laborCost).toBe(3600);
    expect(cost!.participantCount).toBe(1);
  });
});
