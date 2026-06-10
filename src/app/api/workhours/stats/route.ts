import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { monthlyAggregate } from '@/modules/workhour/workhour-service';

function countWorkdays(year: number, month: number): number {
  const lastDay = new Date(year, month, 0).getDate();
  let count = 0;
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(year, month - 1, d).getDay();
    if (day !== 0 && day !== 6) count++;
  }
  return count;
}

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const year = Number(sp.get('year') ?? new Date().getFullYear());
  const month = Number(sp.get('month') ?? new Date().getMonth() + 1);
  const view = sp.get('view') ?? 'user';
  const departmentId = sp.get('departmentId') ? Number(sp.get('departmentId')) : undefined;

  const aggregated = await monthlyAggregate(year, month, { departmentId });
  const userIds = [...new Set(aggregated.map((a) => a.userId))];
  const projectIds = [...new Set(aggregated.map((a) => a.projectId))];
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { department: true },
      })
    : [];
  const projects = projectIds.length
    ? await prisma.project.findMany({
        where: { id: { in: projectIds } },
        include: { projectType: true },
      })
    : [];

  const workdays = countWorkdays(year, month);
  const standardHours = workdays * 8;

  if (view === 'user') {
    const map = new Map<number, { user: any; totalHours: number }>();
    for (const row of aggregated) {
      const cur = map.get(row.userId) ?? {
        user: users.find((u) => u.id === row.userId),
        totalHours: 0,
      };
      cur.totalHours += Number(row._sum.hours ?? 0);
      map.set(row.userId, cur);
    }
    const rows = [...map.values()].map((r) => ({
      userId: r.user?.id,
      userName: r.user?.name,
      employeeId: r.user?.employeeId,
      departmentName: r.user?.department?.name ?? '-',
      totalHours: r.totalHours,
      ratio: standardHours > 0 ? r.totalHours / standardHours : 0,
      belowRedline: standardHours > 0 ? r.totalHours / standardHours < 0.5 : false,
    }));
    rows.sort((a, b) => b.totalHours - a.totalHours);
    return Response.json({ data: { rows, standardHours, workdays, year, month } });
  }

  if (view === 'project') {
    const map = new Map<
      number,
      { project: any; totalHours: number; participants: Set<number> }
    >();
    for (const row of aggregated) {
      const cur = map.get(row.projectId) ?? {
        project: projects.find((p) => p.id === row.projectId),
        totalHours: 0,
        participants: new Set<number>(),
      };
      cur.totalHours += Number(row._sum.hours ?? 0);
      cur.participants.add(row.userId);
      map.set(row.projectId, cur);
    }
    const rows = [...map.values()].map((r) => ({
      projectId: r.project?.id,
      projectCode: r.project?.code,
      projectName: r.project?.name,
      typeName: r.project?.projectType?.name,
      totalHours: r.totalHours,
      participantCount: r.participants.size,
    }));
    rows.sort((a, b) => b.totalHours - a.totalHours);
    return Response.json({ data: { rows, year, month } });
  }

  // view === 'month' — 全公司本月汇总
  const totalHours = aggregated.reduce(
    (acc, r) => acc + Number(r._sum.hours ?? 0),
    0,
  );
  const usersCount = userIds.length;
  const allUsers = await prisma.user.count({ where: { isActive: true } });
  return Response.json({
    data: {
      rows: [
        {
          year,
          month,
          totalHours,
          activeUsers: usersCount,
          totalUsers: allUsers,
          coverage: allUsers > 0 ? usersCount / allUsers : 0,
          standardHours,
        },
      ],
      year,
      month,
    },
  });
});
