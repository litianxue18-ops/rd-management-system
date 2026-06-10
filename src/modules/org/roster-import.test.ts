import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import ExcelJS from 'exceljs';
import { importRoster } from './roster-import';

beforeEach(async () => {
  await prisma.department.create({ data: { code: 'rd', name: '研发中心' } });
  await prisma.role.create({ data: { code: 'researcher', name: '研发员' } });
  await prisma.role.create({ data: { code: 'project_lead', name: '项目负责人' } });
});

async function buildXlsx(rows: any[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('roster');
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe('importRoster', () => {
  it('正常 3 行', async () => {
    const buf = await buildXlsx([
      ['工号','姓名','用户名','部门编码','角色编码','主角色编码','初始密码','邮箱','手机','小时成本'],
      ['E001','张三','',     'rd',       'researcher',         '',           '',         '',     '', 80],
      ['E002','李四','lisi', 'rd',       'researcher,project_lead', 'project_lead', '', '', '', 120],
      ['E003','王五','',     'rd',       'researcher',         '',           'CustomPwd1', '', '', 75],
    ]);
    const result = await importRoster(buf);
    expect(result.created).toBe(3);
    expect(result.errors).toHaveLength(0);
    const all = await prisma.user.findMany();
    expect(all).toHaveLength(3);
    expect(all.find((u) => u.username === 'E001')).toBeTruthy();
    expect(all.find((u) => u.username === 'lisi')).toBeTruthy();
  });

  it('部门编码不存在 → 该行报错, 其他行不影响', async () => {
    const buf = await buildXlsx([
      ['工号','姓名','用户名','部门编码','角色编码','主角色编码','初始密码','邮箱','手机','小时成本'],
      ['E001','张三','','rd_unknown','researcher','','','','',''],
      ['E002','李四','','rd',        'researcher','','','','',''],
    ]);
    const result = await importRoster(buf);
    expect(result.created).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toContain('部门编码不存在');
  });

  it('工号重复 → 跳过', async () => {
    await prisma.user.create({ data: { username: 'E001', employeeId: 'E001', name: '已存在', passwordHash: 'x' } });
    const buf = await buildXlsx([
      ['工号','姓名','用户名','部门编码','角色编码','主角色编码','初始密码','邮箱','手机','小时成本'],
      ['E001','张三','','rd','researcher','','','','',''],
    ]);
    const result = await importRoster(buf);
    expect(result.skipped).toBe(1);
  });
});
