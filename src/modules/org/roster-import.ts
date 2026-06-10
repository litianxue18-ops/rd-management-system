import ExcelJS from 'exceljs';
import { Prisma } from '@prisma/client';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';

interface ImportRow {
  工号: string; 姓名: string; 用户名?: string;
  部门编码: string; 角色编码: string; 主角色编码?: string;
  初始密码?: string; 邮箱?: string; 手机?: string; 小时成本?: number | string;
}

interface RowError { row: number; employeeId?: string; message: string; }

const DEFAULT_PWD = 'Init@2026';

/**
 * 把 ExcelJS row 转成 Record<headerName, cellValue>.
 * cell.value 可能是 string / number / null / { richText: [...] } / { result, formula },
 * 这里只兼容 M1 花名册模板可能出现的类型, 其它一律 toString().
 */
function cellToString(v: any): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (v instanceof Date) return v.toISOString();
  // richText: { richText: [{text: ...}, ...] }
  if (Array.isArray(v.richText)) return v.richText.map((r: any) => r.text ?? '').join('').trim();
  // formula: { result, formula }
  if ('result' in v) return cellToString(v.result);
  // hyperlink: { text, hyperlink }
  if ('text' in v) return cellToString(v.text);
  return String(v);
}

export async function importRoster(buf: Buffer): Promise<{ created: number; skipped: number; errors: RowError[] }> {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as any);
  const ws = wb.worksheets[0];
  if (!ws) return { created: 0, skipped: 0, errors: [{ row: 0, message: 'Excel 没有任何工作表' }] };

  // 第 1 行视为表头
  const headerRow = ws.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    headers[colNumber] = cellToString(cell.value);
  });

  const rows: ImportRow[] = [];
  const dataStart = 2;
  for (let rowNum = dataStart; rowNum <= ws.rowCount; rowNum++) {
    const row = ws.getRow(rowNum);
    if (!row.hasValues) continue;
    const obj: any = {};
    for (let col = 1; col < headers.length; col++) {
      const key = headers[col];
      if (!key) continue;
      obj[key] = cellToString(row.getCell(col).value);
    }
    rows.push(obj);
  }

  const errors: RowError[] = [];
  let created = 0, skipped = 0;

  const depts = new Map((await prisma.department.findMany()).map((d) => [d.code, d.id]));
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.code, r.id]));

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;
    try {
      if (!row.工号 || !row.姓名 || !row.部门编码 || !row.角色编码) {
        errors.push({ row: rowNum, employeeId: row.工号, message: '工号/姓名/部门编码/角色编码 必填' });
        continue;
      }
      const username = String(row.用户名 || row.工号);
      const employeeId = String(row.工号);

      const dup = await prisma.user.findFirst({ where: { OR: [{ username }, { employeeId }] } });
      if (dup) { skipped++; continue; }

      const departmentId = depts.get(row.部门编码);
      if (!departmentId) { errors.push({ row: rowNum, employeeId: row.工号, message: `部门编码不存在: ${row.部门编码}` }); continue; }

      const roleCodes = String(row.角色编码).split(',').map((s) => s.trim()).filter(Boolean);
      const roleIds = roleCodes.map((c) => roles.get(c)).filter((x): x is number => !!x);
      if (roleIds.length !== roleCodes.length) {
        const missing = roleCodes.filter((c) => !roles.get(c));
        errors.push({ row: rowNum, employeeId: row.工号, message: `角色编码不存在: ${missing.join(',')}` });
        continue;
      }
      const primaryCode = row.主角色编码 || roleCodes[0];
      const primaryRoleId = roles.get(String(primaryCode));

      const passwordHash = await hashPassword(String(row.初始密码 || DEFAULT_PWD));

      try {
        await prisma.user.create({
          data: {
            username,
            employeeId,
            name: row.姓名,
            email: row.邮箱 || null,
            phone: row.手机 || null,
            passwordHash,
            departmentId,
            hourlyCost: row.小时成本 ? Number(row.小时成本) : null,
            roles: { create: roleIds.map((rid) => ({ roleId: rid, isPrimary: rid === primaryRoleId })) },
          },
        });
        created++;
      } catch (e: any) {
        // 兜底: 与上一行 findFirst 之间被并发请求抢先插入, 仍按"跳过"处理
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
          skipped++;
          continue;
        }
        throw e;
      }
    } catch (e: any) {
      errors.push({ row: rowNum, employeeId: row.工号, message: e.message ?? String(e) });
    }
  }

  return { created, skipped, errors };
}
