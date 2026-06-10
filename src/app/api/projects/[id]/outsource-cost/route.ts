import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';

/**
 * 项目费用归集: 委外费聚合 (M5-T6).
 *
 * 聚合规则:
 * - 只算 status IN ('active', 'completed') 的合同 (审批通过, 进入或完成执行)
 * - paid = SUM(outsource_payment.amount) 按合同 group
 * - remaining = total_amount - paid
 * - total 卡片 = SUM(paid) (实际已付的钱才是当期已发生费用)
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
        oc.id,
        oc.contract_no,
        oc.title,
        oc.status::text                              AS status,
        oc.total_amount::text                        AS total_amount,
        COALESCE(SUM(op.amount), 0)::text            AS paid_amount,
        (oc.total_amount - COALESCE(SUM(op.amount), 0))::text AS remaining,
        s.name                                       AS supplier_name,
        s.code                                       AS supplier_code
      FROM outsource_contract oc
      LEFT JOIN outsource_payment op ON op.contract_id = oc.id
      LEFT JOIN outsource_supplier s ON s.id = oc.supplier_id
      WHERE oc.project_id = ${projectId}
        AND oc.status IN ('active', 'completed')
      GROUP BY oc.id, oc.contract_no, oc.title, oc.status, oc.total_amount, s.name, s.code
      ORDER BY oc.id DESC
    `;

    const breakdown = rows.map((r) => ({
      id: r.id,
      contractNo: r.contract_no,
      title: r.title,
      status: r.status,
      totalAmount: Number(r.total_amount),
      paidAmount: Number(r.paid_amount),
      remaining: Number(r.remaining),
      supplierName: r.supplier_name,
      supplierCode: r.supplier_code,
    }));
    // total = 已实际支付的钱
    const total = breakdown.reduce((acc, r) => acc + r.paidAmount, 0);

    return Response.json({ data: { total, breakdown } });
  },
);
