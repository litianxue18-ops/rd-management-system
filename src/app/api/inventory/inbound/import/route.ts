import { NextRequest } from 'next/server';
import ExcelJS from 'exceljs';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import {
  importInitInbound,
  type InitInboundRow,
} from '@/modules/inventory/inbound-service';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

function cellToString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v.richText))
    return v.richText.map((r: any) => r.text ?? '').join('').trim();
  if ('result' in v) return cellToString(v.result);
  if ('text' in v) return cellToString(v.text);
  return String(v);
}

function toNumber(v: any): number | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'number') return v;
  const s = cellToString(v).replace(/,/g, '').trim();
  if (s === '') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.INVENTORY_INBOUND);

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file)
    return Response.json(
      { error: { code: 'NO_FILE', message: '未上传文件' } },
      { status: 400 },
    );
  if (file.size > MAX_BYTES)
    return Response.json(
      { error: { code: 'FILE_TOO_LARGE', message: '文件超过 10MB 上限' } },
      { status: 413 },
    );

  const buf = Buffer.from(await file.arrayBuffer());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws)
    return Response.json({
      data: {
        created: 0,
        skipped: 0,
        errors: [{ row: 0, message: 'Excel 没有任何工作表' }],
      },
    });

  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellToString(cell.value);
  });

  const rows: InitInboundRow[] = [];
  for (let rowNum = 2; rowNum <= ws.rowCount; rowNum++) {
    const row = ws.getRow(rowNum);
    if (!row.hasValues) continue;
    const obj: any = {};
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      obj[key] = row.getCell(col).value;
    }
    rows.push({
      materialCode: cellToString(obj['物料编码']),
      warehouseCode: cellToString(obj['仓库编码']),
      quantity: toNumber(obj['数量']) ?? 0,
      unitPrice: toNumber(obj['单价']),
      batchNo: cellToString(obj['批次号']) || undefined,
      note: cellToString(obj['备注']) || undefined,
    });
  }

  const result = await importInitInbound(jwt.userId, rows);
  return Response.json({ data: result });
});
