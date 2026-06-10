import { prisma } from '@/shared/prisma';

export interface ProjectLaborCost {
  projectId: number;
  laborCost: number;
  totalHours: number;
  participantCount: number;
}

/** 查询单个项目的人工费汇总, 来自 v_project_labor_cost view. */
export async function getProjectLaborCost(projectId: number): Promise<ProjectLaborCost | null> {
  const rows = await prisma.$queryRaw<
    Array<{
      project_id: number;
      labor_cost: string;
      total_hours: string;
      participant_count: number;
    }>
  >`
    SELECT project_id, labor_cost::text, total_hours::text, participant_count::int
    FROM v_project_labor_cost
    WHERE project_id = ${projectId}
  `;
  if (rows.length === 0) return null;
  const r = rows[0];
  return {
    projectId: r.project_id,
    laborCost: Number(r.labor_cost),
    totalHours: Number(r.total_hours),
    participantCount: r.participant_count,
  };
}

export interface ParticipantBreakdown {
  userId: number;
  userName: string;
  employeeId: string;
  hours: number;
  hourlyCost: number;
  subCost: number;
}

/** 按参与人拆分人工费明细 (已批准工时), 按人工费 desc. */
export async function getProjectLaborCostBreakdown(
  projectId: number,
): Promise<ParticipantBreakdown[]> {
  const rows = await prisma.$queryRaw<
    Array<{
      user_id: number;
      user_name: string;
      employee_id: string;
      hours: string;
      hourly_cost: string | null;
      sub_cost: string | null;
    }>
  >`
    SELECT
      u.id AS user_id,
      u.name AS user_name,
      u.employee_id,
      SUM(w.hours)::text AS hours,
      u.hourly_cost::text AS hourly_cost,
      (SUM(w.hours) * COALESCE(u.hourly_cost, 0))::text AS sub_cost
    FROM workhour_entry w
    JOIN "user" u ON u.id = w.user_id
    WHERE w.project_id = ${projectId} AND w.status = 'approved'
    GROUP BY u.id, u.name, u.employee_id, u.hourly_cost
    ORDER BY sub_cost DESC NULLS LAST
  `;
  return rows.map((r) => ({
    userId: r.user_id,
    userName: r.user_name,
    employeeId: r.employee_id,
    hours: Number(r.hours),
    hourlyCost: r.hourly_cost ? Number(r.hourly_cost) : 0,
    subCost: r.sub_cost ? Number(r.sub_cost) : 0,
  }));
}
