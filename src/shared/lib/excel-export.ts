import ExcelJS from 'exceljs';

export interface ExportColumn<T> {
  header: string;
  key: keyof T | string;
  width?: number;
  format?: (v: any, row: T) => any;
}

/**
 * 把行 + 列定义渲染成 xlsx Buffer.
 * - 表头 DingTalk 蓝 (#1677FF) 底白字加粗, 居中
 * - 每列默认宽 15
 * - format(raw, row) 用于把 Date / 嵌套对象 / Decimal 字符串化
 */
export async function rowsToExcel<T>(
  rows: T[],
  columns: ExportColumn<T>[],
  sheetName = 'Sheet1',
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = columns.map((c) => ({
    header: c.header,
    key: String(c.key),
    width: c.width ?? 15,
  }));
  const headerRow = ws.getRow(1);
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1677FF' },
  };
  headerRow.font = { color: { argb: 'FFFFFFFF' }, bold: true };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  for (const row of rows) {
    const renderRow: any = {};
    for (const col of columns) {
      const raw = (row as any)[col.key];
      renderRow[String(col.key)] = col.format ? col.format(raw, row) : raw;
    }
    ws.addRow(renderRow);
  }
  return (await wb.xlsx.writeBuffer()) as unknown as Buffer;
}
