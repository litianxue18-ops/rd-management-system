import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { z } from 'zod';
import ExcelJS from 'exceljs';
import { withErrorHandler, requireAuth, requireScoped, readJson } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { rowsToExcel, type ExportColumn } from '@/shared/lib/excel-export';
import { listProjects } from '@/modules/project/project-service';
import { monthlyAggregate } from '@/modules/workhour/workhour-service';
import { listSamples } from '@/modules/sample/sample-service';
import { listTransfers } from '@/modules/trial/transfer-service';
import { listReports } from '@/modules/monthly/monthly-service';
import { listBalance } from '@/modules/inventory/balance-query';
import {
  getProjectLaborCost,
  getProjectLaborCostBreakdown,
} from '@/modules/workhour/labor-cost';

const ExportType = z.enum([
  'project_ledger',
  'workhour_stats',
  'material_outbound_stats',
  'sample_scrap',
  'trial_transfer',
  'project_cost',
  'monthly_report',
  'inventory_balance',
]);

const Input = z.object({
  type: ExportType,
  filters: z.record(z.string(), z.any()).optional(),
});

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(x.getTime())) return String(d ?? '');
  const y = x.getFullYear();
  const m = String(x.getMonth() + 1).padStart(2, '0');
  const day = String(x.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return '';
  const x = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(x.getTime())) return String(d ?? '');
  return `${fmtDate(x)} ${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '审批中',
  approved: '已批准',
  rejected: '已驳回',
  active: '进行中',
  closed: '已结项',
  cancelled: '已取消',
  issued: '已出库',
  returned: '已退库',
  supervised: '已监销',
  settled: '已结转',
  completed: '已完成',
};

const SAMPLE_TYPE_LABEL: Record<string, string> = {
  sample: '样品',
  scrap: '废料',
};

const DISPOSAL_LABEL: Record<string, string> = {
  retained: '留样',
  destroyed: '销毁',
  sold: '出售',
  internal_use: '内部使用',
};

const BALANCE_STATUS_LABEL: Record<string, string> = {
  normal: '正常',
  low: '低于安全库存',
  over: '超上限',
  stale: '呆滞 >180d',
};

function xlsxResponse(buf: Buffer, filename: string): Response {
  return new Response(buf as unknown as BodyInit, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  });
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const input = Input.parse(await readJson(req));
  const { type, filters } = input;

  // 项目/费用类报表需要 scope ctx; 库存/通用类 requireAuth 即可
  if (type === 'project_ledger') {
    const ctx = await requireScoped(req);
    const projects = await listProjects(ctx, filters as any);
    // 加载部门/负责人 lookup
    const deptIds = [...new Set(projects.map((p: any) => p.departmentId))];
    const userIds = [...new Set(projects.map((p: any) => p.leadUserId))];
    const [depts, users] = await Promise.all([
      deptIds.length
        ? prisma.department.findMany({
            where: { id: { in: deptIds as number[] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as Array<{ id: number; name: string }>),
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds as number[] } },
            select: { id: true, name: true },
          })
        : Promise.resolve([] as Array<{ id: number; name: string }>),
    ]);
    const deptMap = new Map(depts.map((d) => [d.id, d.name]));
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const cols: ExportColumn<any>[] = [
      { header: '项目编号', key: 'code', width: 20 },
      { header: '项目名称', key: 'name', width: 30 },
      {
        header: '类型',
        key: 'projectType',
        format: (v) => v?.name ?? '',
        width: 16,
      },
      {
        header: '主导部门',
        key: 'departmentId',
        format: (v) => deptMap.get(v) ?? `#${v}`,
        width: 14,
      },
      {
        header: '负责人',
        key: 'leadUserId',
        format: (v) => userMap.get(v) ?? `#${v}`,
        width: 12,
      },
      { header: '开始日期', key: 'startDate', format: fmtDate, width: 14 },
      { header: '结束日期', key: 'endDate', format: fmtDate, width: 14 },
      {
        header: '预算 (元)',
        key: 'budget',
        format: (v) => Number(v ?? 0),
        width: 16,
      },
      {
        header: '状态',
        key: 'status',
        format: (v) => STATUS_LABEL[v] ?? v,
        width: 12,
      },
    ];
    const buf = await rowsToExcel(projects, cols, '项目台账');
    return xlsxResponse(buf, `项目台账-${todayStr()}.xlsx`);
  }

  if (type === 'workhour_stats') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      year?: number;
      month?: number;
      departmentId?: number;
    };
    const year = Number(f.year ?? new Date().getFullYear());
    const month = Number(f.month ?? new Date().getMonth() + 1);
    const aggregated = await monthlyAggregate(year, month, {
      departmentId: f.departmentId,
    });
    const userIds = [...new Set(aggregated.map((a) => a.userId))];
    const projectIds = [...new Set(aggregated.map((a) => a.projectId))];
    const [users, projects] = await Promise.all([
      userIds.length
        ? prisma.user.findMany({
            where: { id: { in: userIds } },
            include: { department: true },
          })
        : Promise.resolve([] as any[]),
      projectIds.length
        ? prisma.project.findMany({ where: { id: { in: projectIds } } })
        : Promise.resolve([] as any[]),
    ]);
    const userMap = new Map(users.map((u: any) => [u.id, u]));
    const projMap = new Map(projects.map((p: any) => [p.id, p]));
    const rows = aggregated.map((a) => {
      const u: any = userMap.get(a.userId);
      const p: any = projMap.get(a.projectId);
      return {
        userName: u?.name ?? '',
        employeeId: u?.employeeId ?? '',
        departmentName: u?.department?.name ?? '',
        projectCode: p?.code ?? '',
        projectName: p?.name ?? '',
        hours: Number(a._sum.hours ?? 0),
      };
    });
    const cols: ExportColumn<any>[] = [
      { header: '员工', key: 'userName', width: 14 },
      { header: '工号', key: 'employeeId', width: 12 },
      { header: '部门', key: 'departmentName', width: 14 },
      { header: '项目编号', key: 'projectCode', width: 16 },
      { header: '项目名称', key: 'projectName', width: 30 },
      { header: '已批准工时', key: 'hours', width: 14 },
    ];
    const buf = await rowsToExcel(rows, cols, `工时统计 ${year}-${month}`);
    return xlsxResponse(buf, `工时统计-${year}-${month}-${todayStr()}.xlsx`);
  }

  if (type === 'material_outbound_stats') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      year?: number;
      projectId?: number;
      materialId?: number;
    };
    const conds: string[] = [`o.status IN ('issued','returned')`];
    const params: any[] = [];
    if (f.projectId) {
      params.push(Number(f.projectId));
      conds.push(`o.project_id = $${params.length}`);
    }
    if (f.materialId) {
      params.push(Number(f.materialId));
      conds.push(`o.material_id = $${params.length}`);
    }
    if (f.year) {
      params.push(Number(f.year));
      conds.push(`EXTRACT(YEAR FROM o.issued_at) = $${params.length}`);
    }
    const sql = `
      SELECT
        p.code AS project_code, p.name AS project_name,
        m.code AS material_code, m.name AS material_name, m.unit,
        COALESCE(SUM(o.requested_qty), 0)::text  AS requested_qty,
        COALESCE(SUM(o.issued_qty),    0)::text  AS issued_qty,
        COALESCE(SUM(o.returned_qty),  0)::text  AS returned_qty,
        COALESCE(SUM(o.issued_qty - o.returned_qty), 0)::text AS actual_qty
      FROM inventory_outbound o
      JOIN project  p ON p.id = o.project_id
      JOIN material m ON m.id = o.material_id
      WHERE ${conds.join(' AND ')}
      GROUP BY p.code, p.name, m.code, m.name, m.unit
      ORDER BY actual_qty DESC NULLS LAST
    `;
    const rows = await prisma.$queryRawUnsafe<any[]>(sql, ...params);
    const data = rows.map((r) => ({
      projectCode: r.project_code,
      projectName: r.project_name,
      materialCode: r.material_code,
      materialName: r.material_name,
      unit: r.unit,
      requestedQty: Number(r.requested_qty),
      issuedQty: Number(r.issued_qty),
      returnedQty: Number(r.returned_qty),
      actualQty: Number(r.actual_qty),
    }));
    const cols: ExportColumn<any>[] = [
      { header: '项目编号', key: 'projectCode', width: 16 },
      { header: '项目名称', key: 'projectName', width: 28 },
      { header: '物料编码', key: 'materialCode', width: 16 },
      { header: '物料名称', key: 'materialName', width: 24 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '申请量', key: 'requestedQty', width: 12 },
      { header: '出库量', key: 'issuedQty', width: 12 },
      { header: '退库量', key: 'returnedQty', width: 12 },
      { header: '实际消耗', key: 'actualQty', width: 12 },
    ];
    const buf = await rowsToExcel(data, cols, '领料统计');
    return xlsxResponse(buf, `领料统计-${todayStr()}.xlsx`);
  }

  if (type === 'sample_scrap') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      projectId?: number;
      type?: 'sample' | 'scrap';
      status?: string;
    };
    const rows = await listSamples({
      projectId: f.projectId ? Number(f.projectId) : undefined,
      type: f.type,
      status: f.status,
    });
    const cols: ExportColumn<any>[] = [
      { header: '单号', key: 'docNo', width: 18 },
      {
        header: '项目',
        key: 'project',
        format: (v) => (v ? `${v.name} (${v.code})` : ''),
        width: 28,
      },
      {
        header: '类型',
        key: 'type',
        format: (v) => SAMPLE_TYPE_LABEL[v] ?? v,
        width: 8,
      },
      {
        header: '物料',
        key: 'material',
        format: (v) => (v ? `${v.name} (${v.code})` : ''),
        width: 24,
      },
      {
        header: '消耗量',
        key: 'consumedQty',
        format: (v) => Number(v ?? 0),
        width: 12,
      },
      { header: '产出名', key: 'productName', width: 18 },
      {
        header: '产出量',
        key: 'productQty',
        format: (v) => (v == null ? '' : Number(v)),
        width: 12,
      },
      { header: '产出单位', key: 'productUnit', width: 10 },
      {
        header: '处置方式',
        key: 'disposalMethod',
        format: (v) => DISPOSAL_LABEL[v] ?? v,
        width: 12,
      },
      {
        header: '出售收入',
        key: 'disposalIncome',
        format: (v) => (v == null ? '' : Number(v)),
        width: 12,
      },
      {
        header: '状态',
        key: 'status',
        format: (v) => STATUS_LABEL[v] ?? v,
        width: 12,
      },
      {
        header: '监销时间',
        key: 'supervisedAt',
        format: fmtDateTime,
        width: 18,
      },
      { header: '登记时间', key: 'registeredAt', format: fmtDateTime, width: 18 },
    ];
    const buf = await rowsToExcel(rows, cols, '样品废料台账');
    return xlsxResponse(buf, `样品废料台账-${todayStr()}.xlsx`);
  }

  if (type === 'trial_transfer') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      projectId?: number;
      status?: string;
      trialOrderId?: number;
    };
    const rows = await listTransfers({
      projectId: f.projectId ? Number(f.projectId) : undefined,
      status: f.status,
      trialOrderId: f.trialOrderId ? Number(f.trialOrderId) : undefined,
    });
    const cols: ExportColumn<any>[] = [
      { header: '单号', key: 'docNo', width: 18 },
      {
        header: '项目',
        key: 'project',
        format: (v) => (v ? `${v.name} (${v.code})` : ''),
        width: 28,
      },
      {
        header: '试制任务',
        key: 'trialOrder',
        format: (v) => (v ? `${v.title} (${v.docNo})` : ''),
        width: 28,
      },
      {
        header: '人工费',
        key: 'laborCost',
        format: (v) => Number(v ?? 0),
        width: 12,
      },
      {
        header: '机台费',
        key: 'machineCost',
        format: (v) => Number(v ?? 0),
        width: 12,
      },
      {
        header: '材料费',
        key: 'materialCost',
        format: (v) => Number(v ?? 0),
        width: 12,
      },
      {
        header: '总额',
        key: 'totalAmount',
        format: (v) => Number(v ?? 0),
        width: 14,
      },
      {
        header: '状态',
        key: 'status',
        format: (v) => STATUS_LABEL[v] ?? v,
        width: 12,
      },
      { header: '创建时间', key: 'createdAt', format: fmtDateTime, width: 18 },
    ];
    const buf = await rowsToExcel(rows, cols, '试制转嫁单');
    return xlsxResponse(buf, `试制转嫁单-${todayStr()}.xlsx`);
  }

  if (type === 'project_cost') {
    await requireAuth(req);
    const f = (filters ?? {}) as { projectId?: number };
    const projectId = Number(f.projectId);
    if (!Number.isFinite(projectId)) {
      return Response.json(
        { error: { code: 'BAD_INPUT', message: '缺少 projectId' } },
        { status: 400 },
      );
    }
    const proj = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, name: true, budget: true },
    });
    if (!proj) {
      return Response.json(
        { error: { code: 'NOT_FOUND', message: '项目不存在' } },
        { status: 404 },
      );
    }
    const labor = await getProjectLaborCost(projectId);
    const laborBreakdown = await getProjectLaborCostBreakdown(projectId);
    const matRows = await prisma.$queryRaw<any[]>`
      SELECT
        m.code AS material_code, m.name AS material_name, m.unit,
        SUM(o.issued_qty - o.returned_qty)::text AS actual_qty,
        SUM((o.issued_qty - o.returned_qty) * COALESCE(o.unit_price, 0))::text AS sub_cost
      FROM inventory_outbound o
      JOIN material m ON m.id = o.material_id
      WHERE o.project_id = ${projectId}
        AND o.status IN ('issued', 'returned')
      GROUP BY m.code, m.name, m.unit
      ORDER BY sub_cost DESC NULLS LAST
    `;
    const trialRows = await prisma.$queryRaw<any[]>`
      SELECT
        t.doc_no, t.labor_cost::text AS labor_cost, t.machine_cost::text AS machine_cost,
        t.material_cost::text AS material_cost, t.total_amount::text AS total_amount,
        tpo.title AS order_title, tpo.doc_no AS order_doc_no
      FROM trial_cost_transfer t
      JOIN trial_production_order tpo ON tpo.id = t.trial_order_id
      WHERE t.project_id = ${projectId} AND t.status = 'settled'
      ORDER BY t.id DESC
    `;
    const outsourceRows = await prisma.$queryRaw<any[]>`
      SELECT
        oc.contract_no, oc.title,
        oc.status::text AS status,
        oc.total_amount::text AS total_amount,
        COALESCE(SUM(op.amount), 0)::text AS paid_amount,
        (oc.total_amount - COALESCE(SUM(op.amount), 0))::text AS remaining,
        s.name AS supplier_name, s.code AS supplier_code
      FROM outsource_contract oc
      LEFT JOIN outsource_payment op ON op.contract_id = oc.id
      LEFT JOIN outsource_supplier s  ON s.id = oc.supplier_id
      WHERE oc.project_id = ${projectId}
        AND oc.status IN ('active', 'completed')
      GROUP BY oc.contract_no, oc.title, oc.status, oc.total_amount, s.name, s.code
      ORDER BY oc.contract_no
    `;

    const matTotal = matRows.reduce(
      (acc, r) => acc + Number(r.sub_cost ?? 0),
      0,
    );
    const trialTotal = trialRows.reduce(
      (acc, r) => acc + Number(r.total_amount ?? 0),
      0,
    );
    const outsourceTotal = outsourceRows.reduce(
      (acc, r) => acc + Number(r.paid_amount ?? 0),
      0,
    );
    const laborTotal = labor?.laborCost ?? 0;
    const usedTotal = laborTotal + matTotal + trialTotal + outsourceTotal;
    const budget = Number(proj.budget);

    const wb = new ExcelJS.Workbook();
    // 汇总 sheet
    const sumWs = wb.addWorksheet('汇总');
    sumWs.columns = [
      { header: '项目', key: 'k', width: 18 },
      { header: '值', key: 'v', width: 36 },
    ];
    sumWs.addRows([
      { k: '项目编号', v: proj.code },
      { k: '项目名称', v: proj.name },
      { k: '预算 (元)', v: budget },
      { k: '人工费', v: laborTotal },
      { k: '物料费', v: matTotal },
      { k: '试制费', v: trialTotal },
      { k: '委外费', v: outsourceTotal },
      { k: '已使用合计', v: usedTotal },
      {
        k: '执行率',
        v: budget > 0 ? `${((usedTotal / budget) * 100).toFixed(1)}%` : '-',
      },
    ]);
    const sumHeader = sumWs.getRow(1);
    sumHeader.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' },
    };
    sumHeader.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    sumHeader.alignment = { vertical: 'middle', horizontal: 'center' };

    // 人工费明细 sheet
    const laborWs = wb.addWorksheet('人工费明细');
    laborWs.columns = [
      { header: '姓名', key: 'userName', width: 14 },
      { header: '工号', key: 'employeeId', width: 12 },
      { header: '累计工时', key: 'hours', width: 12 },
      { header: '小时成本', key: 'hourlyCost', width: 12 },
      { header: '人工费', key: 'subCost', width: 14 },
    ];
    for (const r of laborBreakdown) laborWs.addRow(r);
    const lh = laborWs.getRow(1);
    lh.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' },
    };
    lh.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    lh.alignment = { vertical: 'middle', horizontal: 'center' };

    // 物料费明细
    const matWs = wb.addWorksheet('物料费明细');
    matWs.columns = [
      { header: '物料编码', key: 'materialCode', width: 16 },
      { header: '物料名称', key: 'materialName', width: 24 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '实际消耗', key: 'actualQty', width: 12 },
      { header: '物料费', key: 'subCost', width: 14 },
    ];
    for (const r of matRows) {
      matWs.addRow({
        materialCode: r.material_code,
        materialName: r.material_name,
        unit: r.unit,
        actualQty: Number(r.actual_qty ?? 0),
        subCost: Number(r.sub_cost ?? 0),
      });
    }
    const mh = matWs.getRow(1);
    mh.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' },
    };
    mh.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    mh.alignment = { vertical: 'middle', horizontal: 'center' };

    // 试制费明细
    const trialWs = wb.addWorksheet('试制费明细');
    trialWs.columns = [
      { header: '转嫁单号', key: 'docNo', width: 18 },
      { header: '试制任务', key: 'order', width: 28 },
      { header: '人工', key: 'laborCost', width: 12 },
      { header: '机台', key: 'machineCost', width: 12 },
      { header: '材料', key: 'materialCost', width: 12 },
      { header: '小计', key: 'totalAmount', width: 14 },
    ];
    for (const r of trialRows) {
      trialWs.addRow({
        docNo: r.doc_no,
        order: `${r.order_title} (${r.order_doc_no})`,
        laborCost: Number(r.labor_cost ?? 0),
        machineCost: Number(r.machine_cost ?? 0),
        materialCost: Number(r.material_cost ?? 0),
        totalAmount: Number(r.total_amount ?? 0),
      });
    }
    const th = trialWs.getRow(1);
    th.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' },
    };
    th.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    th.alignment = { vertical: 'middle', horizontal: 'center' };

    // 委外费明细
    const ousWs = wb.addWorksheet('委外费明细');
    ousWs.columns = [
      { header: '合同号', key: 'contractNo', width: 18 },
      { header: '标题', key: 'title', width: 24 },
      { header: '供应商', key: 'supplier', width: 22 },
      { header: '状态', key: 'status', width: 10 },
      { header: '合同总额', key: 'totalAmount', width: 14 },
      { header: '已付', key: 'paidAmount', width: 14 },
      { header: '剩余', key: 'remaining', width: 14 },
    ];
    for (const r of outsourceRows) {
      ousWs.addRow({
        contractNo: r.contract_no,
        title: r.title,
        supplier: `${r.supplier_name ?? ''} (${r.supplier_code ?? ''})`,
        status: STATUS_LABEL[r.status] ?? r.status,
        totalAmount: Number(r.total_amount ?? 0),
        paidAmount: Number(r.paid_amount ?? 0),
        remaining: Number(r.remaining ?? 0),
      });
    }
    const oh = ousWs.getRow(1);
    oh.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1677FF' },
    };
    oh.font = { color: { argb: 'FFFFFFFF' }, bold: true };
    oh.alignment = { vertical: 'middle', horizontal: 'center' };

    const buf = (await wb.xlsx.writeBuffer()) as unknown as Buffer;
    return xlsxResponse(buf, `项目费用归集-${proj.code}-${todayStr()}.xlsx`);
  }

  if (type === 'monthly_report') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      projectId?: number;
      year?: number;
      month?: number;
      status?: string;
    };
    const rows = await listReports({
      projectId: f.projectId ? Number(f.projectId) : undefined,
      year: f.year ? Number(f.year) : undefined,
      month: f.month ? Number(f.month) : undefined,
      status: f.status,
    });
    const cols: ExportColumn<any>[] = [
      {
        header: '项目编号',
        key: 'project',
        format: (v) => v?.code ?? '',
        width: 18,
      },
      {
        header: '项目名称',
        key: 'project',
        format: (v) => v?.name ?? '',
        width: 28,
      },
      { header: '年', key: 'reportYear', width: 8 },
      { header: '月', key: 'reportMonth', width: 6 },
      {
        header: '状态',
        key: 'status',
        format: (v) => STATUS_LABEL[v] ?? v,
        width: 12,
      },
      { header: '创建时间', key: 'createdAt', format: fmtDateTime, width: 18 },
    ];
    // 由于两个列共用 key 'project', rowsToExcel 用 columns 设置 worksheet 列 key,
    // ExcelJS addRow 按 key 写; 这里手动构造无冲突的扁平行避免覆盖.
    const flatRows = rows.map((r: any) => ({
      projectCode: r.project?.code ?? '',
      projectName: r.project?.name ?? '',
      reportYear: r.reportYear,
      reportMonth: r.reportMonth,
      status: r.status,
      createdAt: r.createdAt,
    }));
    const flatCols: ExportColumn<any>[] = [
      { header: '项目编号', key: 'projectCode', width: 18 },
      { header: '项目名称', key: 'projectName', width: 28 },
      { header: '年', key: 'reportYear', width: 8 },
      { header: '月', key: 'reportMonth', width: 6 },
      {
        header: '状态',
        key: 'status',
        format: (v) => STATUS_LABEL[v] ?? v,
        width: 12,
      },
      { header: '创建时间', key: 'createdAt', format: fmtDateTime, width: 18 },
    ];
    const buf = await rowsToExcel(flatRows, flatCols, '月度报告');
    return xlsxResponse(buf, `月度报告-${todayStr()}.xlsx`);
  }

  if (type === 'inventory_balance') {
    await requireAuth(req);
    const f = (filters ?? {}) as {
      materialId?: number;
      warehouseId?: number;
      status?: 'normal' | 'low' | 'over' | 'stale';
    };
    const rows = await listBalance({
      materialId: f.materialId ? Number(f.materialId) : undefined,
      warehouseId: f.warehouseId ? Number(f.warehouseId) : undefined,
      status: f.status,
    });
    const cols: ExportColumn<any>[] = [
      { header: '物料编码', key: 'materialCode', width: 16 },
      { header: '物料名称', key: 'materialName', width: 24 },
      { header: '单位', key: 'unit', width: 8 },
      { header: '仓库', key: 'warehouseName', width: 16 },
      { header: '当前余量', key: 'balance', width: 12 },
      {
        header: '安全库存',
        key: 'safetyStock',
        format: (v) => (v == null ? '' : Number(v)),
        width: 12,
      },
      {
        header: '上限',
        key: 'maxStock',
        format: (v) => (v == null ? '' : Number(v)),
        width: 12,
      },
      {
        header: '状态',
        key: 'status',
        format: (v) => BALANCE_STATUS_LABEL[v] ?? v,
        width: 14,
      },
      {
        header: '最近变动',
        key: 'lastMovementAt',
        format: fmtDateTime,
        width: 18,
      },
      { header: '距今天数', key: 'daysSinceMovement', width: 12 },
    ];
    const buf = await rowsToExcel(rows, cols, '库存余量');
    return xlsxResponse(buf, `库存余量-${todayStr()}.xlsx`);
  }

  // 不可达 (zod 已校验)
  return Response.json(
    { error: { code: 'BAD_TYPE', message: '不支持的导出类型' } },
    { status: 400 },
  );
});
