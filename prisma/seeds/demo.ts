/**
 * demo 数据 seed: 8 用户 + 6 部门 + 5 物料 + 1 active 项目 + 期初库存
 *
 * 用法: pnpm seed:demo
 *
 * 幂等: 全程 upsert + try/catch unique violation, 重复跑不爆.
 * super_admin 不在此处建, 走 pnpm seed:admin (交互式).
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { seedRoles } from './roles';
import { seedPermissionMatrix } from './permission-matrix';
import { seedProjectTypes } from './project-types';
import { seedNumberRules } from './number-rules';
import { seedWarehouses } from './warehouses';
import { hashPassword } from '../../src/modules/auth/password';
import { ROLE_CODES } from '../../src/modules/permission/nodes';

const DEMO_PASSWORD = '1234';

const DEPARTMENTS = [
  { code: 'rd_center',  name: '研发中心' },
  { code: 'finance',    name: '财务部' },
  { code: 'production', name: '生产部' },
  { code: 'purchase',   name: '采购部' },
  { code: 'hr',         name: '人力资源部' },
  { code: 'audit',      name: '审计部' },
];

const USERS: Array<{
  username: string;
  employeeId: string;
  name: string;
  role: string;
  deptCode: string;
  hourlyCost?: number;
}> = [
  { username: 'plead',      employeeId: 'PLEAD',  name: '陈项目', role: ROLE_CODES.PROJECT_LEAD,     deptCode: 'rd_center',  hourlyCost: 150 },
  { username: 'researcher', employeeId: 'RES01',  name: '李研发', role: ROLE_CODES.RESEARCHER,       deptCode: 'rd_center',  hourlyCost: 80 },
  { username: 'rddir',      employeeId: 'RDDIR',  name: '王中心', role: ROLE_CODES.RD_DIRECTOR,      deptCode: 'rd_center' },
  { username: 'tech',       employeeId: 'TECH',   name: '张技委', role: ROLE_CODES.TECH_COMMITTEE,   deptCode: 'rd_center' },
  { username: 'prod',       employeeId: 'PROD',   name: '赵生产', role: ROLE_CODES.PRODUCTION_LEAD,  deptCode: 'production' },
  { username: 'fin',        employeeId: 'FIN',    name: '钱财务', role: ROLE_CODES.FINANCE_LEAD,     deptCode: 'finance' },
  { username: 'ceo',        employeeId: 'CEO',    name: '总经理', role: ROLE_CODES.CEO,              deptCode: 'finance' },
  { username: 'wh',         employeeId: 'WH',     name: '孙仓管', role: ROLE_CODES.WAREHOUSE_KEEPER, deptCode: 'production' },
];

const MATERIALS = [
  { code: 'M-BOPET-12', name: 'BOPET 基材',     spec: '12μm',  unit: 'kg', category: '基材',   safetyStock: 50, maxStock: 500 },
  { code: 'M-FLAME',    name: '阻燃剂 X-1',     spec: '工业级', unit: 'L',  category: '助剂',   safetyStock: 20, maxStock: 200 },
  { code: 'M-GLUE-A',   name: '高附着力胶水',   spec: 'A 型',  unit: 'kg', category: '胶粘剂', safetyStock: 10, maxStock: 100 },
  { code: 'M-COAT',     name: '环保涂层液',     spec: '通用',  unit: 'L',  category: '涂层',   safetyStock: 30, maxStock: 300 },
  { code: 'M-TEST-P',   name: '测试纸',         spec: 'A4',    unit: '包', category: '辅料' },
];

async function main() {
  const prisma = new PrismaClient();
  try {
    // 1. 复用已有基础 seed (幂等)
    await seedRoles(prisma);
    await seedPermissionMatrix(prisma);
    await seedProjectTypes(prisma);
    await seedNumberRules(prisma);
    await seedWarehouses(prisma);

    // 2. 6 部门
    const depts: Record<string, number> = {};
    for (const d of DEPARTMENTS) {
      const r = await prisma.department.upsert({
        where: { code: d.code },
        update: { name: d.name },
        create: d,
      });
      depts[d.code] = r.id;
    }
    console.log(`seeded ${DEPARTMENTS.length} departments`);

    // 3. 8 用户 + 角色绑定
    const pwd = await hashPassword(DEMO_PASSWORD);
    const users: Record<string, number> = {};
    for (const u of USERS) {
      const role = await prisma.role.findUniqueOrThrow({ where: { code: u.role } });
      const user = await prisma.user.upsert({
        where: { username: u.username },
        update: {
          name: u.name,
          departmentId: depts[u.deptCode],
          hourlyCost: u.hourlyCost ?? null,
        },
        create: {
          username: u.username,
          employeeId: u.employeeId,
          name: u.name,
          passwordHash: pwd,
          departmentId: depts[u.deptCode],
          hourlyCost: u.hourlyCost ?? null,
        },
      });
      await prisma.userRole.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        update: { isPrimary: true },
        create: { userId: user.id, roleId: role.id, isPrimary: true },
      });
      users[u.username] = user.id;
    }
    console.log(`seeded ${USERS.length} demo users (password: ${DEMO_PASSWORD})`);

    // 4. 5 物料
    const materials: Record<string, number> = {};
    for (const m of MATERIALS) {
      const r = await prisma.material.upsert({
        where: { code: m.code },
        update: m,
        create: m,
      });
      materials[m.code] = r.id;
    }
    console.log(`seeded ${MATERIALS.length} materials`);

    // 5. 期初入库 (每个物料 100 单位 @ unitPrice 20) — 调 createInbound 走 'init' 通道
    const { createInbound } = await import('../../src/modules/inventory/inbound-service');
    const whId = (
      await prisma.warehouse.findUniqueOrThrow({ where: { code: 'rd-warehouse' } })
    ).id;
    let initCount = 0;
    for (const mc of Object.keys(materials)) {
      // 已 init 过的物料检测: 查 ledger 是否已有 init 流水
      const existed = await prisma.inventoryLedger.findFirst({
        where: {
          materialId: materials[mc],
          warehouseId: whId,
          changeType: 'init',
        },
      });
      if (existed) continue;
      try {
        await createInbound(users.wh, {
          materialId: materials[mc],
          warehouseId: whId,
          quantity: 100,
          unitPrice: 20,
          changeType: 'init',
          receivedAt: new Date(),
          note: 'demo 期初导入',
        });
        initCount++;
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        if (!msg.includes('unique') && !msg.includes('期初')) throw e;
      }
    }
    console.log(`seeded ${initCount} initial inbound records (each 100 @ unit price 20)`);

    // 6. 1 active 项目 (跳过审批: 直接 create + status=active)
    const projType = await prisma.projectType.findUniqueOrThrow({ where: { code: 'MAT' } });
    const existing = await prisma.project.findFirst({ where: { code: 'DEMO-MAT-2026-001' } });
    if (!existing) {
      const proj = await prisma.project.create({
        data: {
          code: 'DEMO-MAT-2026-001',
          name: '高性能阻燃膜中试',
          isTest: true,
          projectTypeId: projType.id,
          departmentId: depts.rd_center,
          leadUserId: users.plead,
          status: 'active',
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          budget: 500000,
          background: 'demo: 行业背景与市场需求 — 新能源电池组阻燃材料需求快速增长',
          goals: 'demo: 量产 UL94 V-0 + 氧指数 ≥32% 阻燃膜',
          techPlan: 'demo: 配方研发 → 小试 → 中试 → 第三方认证',
          schedule: 'demo: Q1 配方 / Q2 小试 / Q3 中试 / Q4 认证',
          budgetDetail: 'demo: 人工 200k + 材料 200k + 试制 50k + 其他 50k',
          expectedOutput: 'demo: 1 项发明专利 + 量产配方 + 客户认证报告',
          createdById: users.plead,
          activatedAt: new Date(),
        },
      });
      await prisma.projectMember.createMany({
        data: [
          { projectId: proj.id, userId: users.plead,      role: '项目负责人', isLead: true },
          { projectId: proj.id, userId: users.researcher, role: '主要研究员' },
        ],
        skipDuplicates: true,
      });
      console.log(`seeded active project: DEMO-MAT-2026-001 (id=${proj.id})`);
    } else {
      console.log(`active project DEMO-MAT-2026-001 already exists, skipped`);
    }

    console.log('\n=== demo data seeded ===');
    console.log(`login with password: ${DEMO_PASSWORD}`);
    console.log('users: plead / researcher / rddir / tech / prod / fin / ceo / wh');
    console.log('project: DEMO-MAT-2026-001 (active)');
    console.log('materials: 5 (each 100 init in rd-warehouse @ unit price 20)');
    console.log('\n注意: super_admin 请用 `pnpm seed:admin` 单独创建.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
