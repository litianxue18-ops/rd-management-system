import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 报表 1.3 (领料统计) 数据源.
 * ?view=project | material | month
 *
 * - project: 按项目汇总 (项目 / 物料数 / 申请 / 出库 / 退库 / 实际消耗)
 * - material: 按物料汇总 + Top 5 项目使用占比
 * - month: 按月份汇总 (月份 / 出库次数 / 出库总金额)
 *
 * 全部仅聚合 status IN ('issued','returned') 的领料单, 草稿/审批中不计入.
 */
const ALLOWED_VIEWS = new Set(['project', 'material', 'month']);

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const sp = req.nextUrl.searchParams;
  const view = sp.get('view') ?? 'project';
  if (!ALLOWED_VIEWS.has(view)) {
    return Response.json(
      { error: { code: 'BAD_VIEW', message: '不支持的视角' } },
      { status: 400 },
    );
  }
  const year = sp.get('year') ? Number(sp.get('year')) : undefined;
  const month = sp.get('month') ? Number(sp.get('month')) : undefined;
  const projectId = sp.get('projectId') ? Number(sp.get('projectId')) : undefined;
  const materialId = sp.get('materialId') ? Number(sp.get('materialId')) : undefined;

  const conds: string[] = [`o.status IN ('issued','returned')`];
  const params: any[] = [];
  if (projectId) {
    params.push(projectId);
    conds.push(`o.project_id = $${params.length}`);
  }
  if (materialId) {
    params.push(materialId);
    conds.push(`o.material_id = $${params.length}`);
  }
  if (year) {
    params.push(year);
    conds.push(`EXTRACT(YEAR FROM o.issued_at) = $${params.length}`);
  }
  if (month) {
    params.push(month);
    conds.push(`EXTRACT(MONTH FROM o.issued_at) = $${params.length}`);
  }
  const where = `WHERE ${conds.join(' AND ')}`;

  if (view === 'project') {
    const sql = `
      SELECT
        o.project_id, p.code AS project_code, p.name AS project_name,
        COUNT(DISTINCT o.material_id)::int AS material_count,
        COALESCE(SUM(o.requested_qty), 0)::text AS requested_qty,
        COALESCE(SUM(o.issued_qty), 0)::text AS issued_qty,
        COALESCE(SUM(o.returned_qty), 0)::text AS returned_qty,
        COALESCE(SUM(o.issued_qty - o.returned_qty), 0)::text AS actual_qty
      FROM inventory_outbound o
      JOIN project p ON p.id = o.project_id
      ${where}
      GROUP BY o.project_id, p.code, p.name
      ORDER BY actual_qty DESC NULLS LAST
    `;
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    return Response.json({
      data: rows.map((r) => ({
        projectId: r.project_id,
        projectCode: r.project_code,
        projectName: r.project_name,
        materialCount: r.material_count,
        requestedQty: Number(r.requested_qty),
        issuedQty: Number(r.issued_qty),
        returnedQty: Number(r.returned_qty),
        actualQty: Number(r.actual_qty),
      })),
    });
  }

  if (view === 'material') {
    // 1. 按物料聚合总消耗
    const matSql = `
      SELECT
        o.material_id, m.code AS material_code, m.name AS material_name, m.unit,
        COALESCE(SUM(o.issued_qty - o.returned_qty), 0)::text AS actual_qty
      FROM inventory_outbound o
      JOIN material m ON m.id = o.material_id
      ${where}
      GROUP BY o.material_id, m.code, m.name, m.unit
      ORDER BY actual_qty DESC NULLS LAST
    `;
    const matRows = await prisma.$queryRawUnsafe<any[]>(matSql, ...params);

    // 2. 按 (material, project) 聚合用于 Top 5 项目占比
    const breakdownSql = `
      SELECT
        o.material_id, o.project_id,
        p.code AS project_code, p.name AS project_name,
        COALESCE(SUM(o.issued_qty - o.returned_qty), 0)::text AS sub_qty
      FROM inventory_outbound o
      JOIN project p ON p.id = o.project_id
      ${where}
      GROUP BY o.material_id, o.project_id, p.code, p.name
    `;
    const bdRows = await prisma.$queryRawUnsafe<any[]>(breakdownSql, ...params);

    const bdByMat = new Map<number, Array<{ projectId: number; projectCode: string; projectName: string; subQty: number }>>();
    for (const r of bdRows) {
      const arr = bdByMat.get(r.material_id) ?? [];
      arr.push({
        projectId: r.project_id,
        projectCode: r.project_code,
        projectName: r.project_name,
        subQty: Number(r.sub_qty),
      });
      bdByMat.set(r.material_id, arr);
    }

    const data = matRows.map((r) => {
      const total = Number(r.actual_qty);
      const all = (bdByMat.get(r.material_id) ?? []).sort((a, b) => b.subQty - a.subQty);
      const top = all.slice(0, 5);
      const otherQty = all.slice(5).reduce((acc, x) => acc + x.subQty, 0);
      const breakdown = top.map((t) => ({
        ...t,
        ratio: total > 0 ? t.subQty / total : 0,
      }));
      if (otherQty > 0) {
        breakdown.push({
          projectId: 0,
          projectCode: '',
          projectName: '其他',
          subQty: otherQty,
          ratio: total > 0 ? otherQty / total : 0,
        });
      }
      return {
        materialId: r.material_id,
        materialCode: r.material_code,
        materialName: r.material_name,
        unit: r.unit,
        actualQty: total,
        breakdown,
      };
    });
    return Response.json({ data });
  }

  // view === 'month'
  const sql = `
    SELECT
      EXTRACT(YEAR FROM o.issued_at)::int AS year,
      EXTRACT(MONTH FROM o.issued_at)::int AS month,
      COUNT(*)::int AS issue_count,
      COALESCE(SUM(o.issued_qty * COALESCE(o.unit_price, 0)), 0)::text AS issue_amount
    FROM inventory_outbound o
    ${where}
      AND o.issued_at IS NOT NULL
    GROUP BY EXTRACT(YEAR FROM o.issued_at), EXTRACT(MONTH FROM o.issued_at)
    ORDER BY year DESC, month DESC
  `;
  const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
  return Response.json({
    data: rows.map((r) => ({
      year: r.year,
      month: r.month,
      issueCount: r.issue_count,
      issueAmount: Number(r.issue_amount),
    })),
  });
});
