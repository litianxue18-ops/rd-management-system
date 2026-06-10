import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 项目费用归集: 物料费聚合 (M4-T6).
 *
 * 聚合规则:
 * - 只算 outbound.status IN ('issued','returned') 的领料单
 * - actualQty = SUM(issued_qty - returned_qty)
 * - subCost = SUM((issued_qty - returned_qty) * COALESCE(unit_price, 0))
 *
 * 当前 M4 阶段 outbound.unit_price 默认 0 (createOutbound 没填), 所以 subCost
 * 大概率全 0. M6 完善时按"最近 inbound 价"自动填. UI 显示 ¥0.00 是预期行为.
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const projectId = Number(id);
    if (!Number.isFinite(projectId)) {
      return Response.json(
        { error: { code: 'BAD_ID', message: '项目 id 非法' } },
        { status: 400 },
      );
    }

    const rows = await prisma.$queryRaw<any[]>`
      SELECT
        m.id AS material_id,
        m.code AS material_code,
        m.name AS material_name,
        m.unit,
        SUM(o.issued_qty - o.returned_qty)::text AS actual_qty,
        SUM((o.issued_qty - o.returned_qty) * COALESCE(o.unit_price, 0))::text AS sub_cost
      FROM inventory_outbound o
      JOIN material m ON m.id = o.material_id
      WHERE o.project_id = ${projectId}
        AND o.status IN ('issued', 'returned')
      GROUP BY m.id, m.code, m.name, m.unit
      ORDER BY sub_cost DESC NULLS LAST
    `;

    const breakdown = rows.map((r) => ({
      materialId: r.material_id,
      materialCode: r.material_code,
      materialName: r.material_name,
      unit: r.unit,
      actualQty: Number(r.actual_qty),
      subCost: Number(r.sub_cost),
    }));
    const total = breakdown.reduce((acc, r) => acc + r.subCost, 0);

    return Response.json({ data: { total, breakdown } });
  },
);
