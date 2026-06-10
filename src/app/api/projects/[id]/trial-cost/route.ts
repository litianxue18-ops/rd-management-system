import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 项目费用归集: 试制费聚合 (M5-T6).
 *
 * 聚合规则:
 * - 只算 trial_cost_transfer.status='settled' (4 步走完后由 hook 标 settled)
 * - breakdown 每行 = 1 张转嫁单 (含 labor / machine / material 三细项)
 * - total = SUM(total_amount)
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
        t.id,
        t.doc_no,
        t.labor_cost::text    AS labor_cost,
        t.machine_cost::text  AS machine_cost,
        t.material_cost::text AS material_cost,
        t.total_amount::text  AS total_amount,
        t.settled_at,
        tpo.title    AS order_title,
        tpo.doc_no   AS order_doc_no
      FROM trial_cost_transfer t
      JOIN trial_production_order tpo ON tpo.id = t.trial_order_id
      WHERE t.project_id = ${projectId} AND t.status = 'settled'
      ORDER BY t.id DESC
    `;

    const breakdown = rows.map((r) => ({
      id: r.id,
      docNo: r.doc_no,
      laborCost: Number(r.labor_cost),
      machineCost: Number(r.machine_cost),
      materialCost: Number(r.material_cost),
      totalAmount: Number(r.total_amount),
      settledAt: r.settled_at,
      orderTitle: r.order_title,
      orderDocNo: r.order_doc_no,
    }));
    const total = breakdown.reduce((acc, r) => acc + r.totalAmount, 0);

    return Response.json({ data: { total, breakdown } });
  },
);
