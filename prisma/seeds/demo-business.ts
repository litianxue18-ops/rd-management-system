/**
 * 全业务全角色演示数据 seed.
 *
 * 在 `pnpm seed:demo` 之后跑: `pnpm seed:demo-business`.
 * 把 demo.ts 留下的"空业务" 补满:
 *  - 4 个项目 (active×2 / reviewing×1 / closed×1)
 *  - 12+ 工时 (含 reviewing 让 plead 周审有数)
 *  - 5 个领料单 (draft/reviewing/approved/issued/returned 各 1)
 *  - 3 个样品/废料 (含 draft 给 finance 监销)
 *  - 2 个试制任务 + 1 个 settled 转嫁单
 *  - 1 个委外合同 active + 2 笔付款
 *  - 2 个月报 (approved + reviewing)
 *  - 月度勾稽 + 异常单 + 季度内审 + 资本化 approved + 结项 approved
 *  - 通知若干 (含未读, AppTopBar 红点)
 *
 * 幂等: 每段创建前查 unique 字段是否已落库, 已存在直接跳.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// 触发所有 workflow 副作用注册
import '../../src/modules/project/workflow';
import '../../src/modules/project/change-workflow';
import '../../src/modules/monthly/workflow';
import '../../src/modules/inventory/workflow';
import '../../src/modules/trial/production-workflow';
import '../../src/modules/trial/transfer-workflow';
import '../../src/modules/outsource/contract-workflow';
import '../../src/modules/capitalization/workflow';
import '../../src/modules/closing/workflow';

import { submit, approve, listTodo } from '../../src/modules/workflow/engine';
import { ROLE_CODES as R } from '../../src/modules/permission/nodes';

import {
  upsertEntry,
  submitWeek,
  approveEntries,
} from '../../src/modules/workhour/workhour-service';
import {
  createOutbound,
  issueOutbound,
} from '../../src/modules/inventory/outbound-service';
import { returnOutbound } from '../../src/modules/inventory/return-service';
import { createSample, superviseDirectly } from '../../src/modules/sample/sample-service';
import {
  createTrialOrder,
  completeOrder,
} from '../../src/modules/trial/production-service';
import { createTransfer } from '../../src/modules/trial/transfer-service';
import { createSupplier } from '../../src/modules/outsource/supplier-service';
import { createContract } from '../../src/modules/outsource/contract-service';
import { registerPayment } from '../../src/modules/outsource/payment-service';
import { createReport } from '../../src/modules/monthly/monthly-service';
import { runMonthlyReconciliation } from '../../src/modules/reconciliation/reconciliation-service';
import { createExceptionNote } from '../../src/modules/reconciliation/exception-service';
import { createAudit } from '../../src/modules/audit/audit-service';
import { createCapitalization } from '../../src/modules/capitalization/capitalization-service';
import { createClosing } from '../../src/modules/closing/closing-service';

type Users = {
  admin?: number;
  plead: number;
  researcher: number;
  rddir: number;
  tech: number;
  prod: number;
  fin: number;
  ceo: number;
  wh: number;
};

function jwt(userId: number, role: string) {
  return { userId, roles: [role], primaryRole: role, tokenVersion: 0 };
}

/** 找一周的周一 (传入任何日期都返回该周周一 00:00). */
function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  r.setDate(r.getDate() + diff);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

async function getUserMap(prisma: PrismaClient): Promise<Users> {
  const need = ['plead', 'researcher', 'rddir', 'tech', 'prod', 'fin', 'ceo', 'wh'];
  const rows = await prisma.user.findMany({ where: { username: { in: need } } });
  const map = Object.fromEntries(rows.map((u) => [u.username, u.id]));
  for (const n of need) {
    if (!map[n]) throw new Error(`demo user '${n}' 不存在, 请先 \`pnpm seed:demo\``);
  }
  return map as unknown as Users;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    // ============ 0. 前置 ============
    const users = await getUserMap(prisma);
    const projType = await prisma.projectType.findUniqueOrThrow({ where: { code: 'MAT' } });
    const dept = await prisma.department.findUniqueOrThrow({ where: { code: 'rd_center' } });
    const wh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'rd-warehouse' } });
    const materials = Object.fromEntries(
      (await prisma.material.findMany({})).map((m) => [m.code, m.id]),
    );
    const demoProj = await prisma.project.findFirstOrThrow({
      where: { code: 'DEMO-MAT-2026-001' },
    });

    // ============ 1. 项目矩阵 ============
    console.log('[1/12] 项目矩阵...');
    async function ensureProject(opts: {
      code: string;
      name: string;
      leadUserId: number;
      status: 'active' | 'reviewing' | 'closed';
      members?: number[];
    }) {
      const exists = await prisma.project.findFirst({ where: { code: opts.code } });
      if (exists) return exists;
      const p = await prisma.project.create({
        data: {
          code: opts.code,
          name: opts.name,
          isTest: true,
          projectTypeId: projType.id,
          departmentId: dept.id,
          leadUserId: opts.leadUserId,
          status: opts.status,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          budget: 500000,
          background: `demo: ${opts.name} 行业背景`,
          goals: `demo: ${opts.name} 目标`,
          techPlan: 'demo: 配方 → 小试 → 中试',
          schedule: 'demo: Q1 / Q2 / Q3 / Q4',
          budgetDetail: 'demo: 人工 + 材料 + 试制',
          expectedOutput: 'demo: 1 项专利 + 量产配方',
          createdById: opts.leadUserId,
          activatedAt: opts.status === 'active' || opts.status === 'closed' ? new Date() : null,
          members: {
            create: [
              { userId: opts.leadUserId, role: '项目负责人', isLead: true },
              ...(opts.members ?? []).map((uid) => ({ userId: uid, role: '研究员' })),
            ],
          },
        },
      });
      return p;
    }
    const demoNew = await ensureProject({
      code: 'DEMO-NEW-2026-001',
      name: '智能调光汽车膜',
      leadUserId: users.plead,
      status: 'active',
      members: [users.researcher],
    });
    const demoPrc = await ensureProject({
      code: 'DEMO-PRC-2026-002',
      name: '涂布工艺优化',
      leadUserId: users.plead,
      status: 'reviewing',
      members: [users.researcher],
    });
    const demoEqp = await ensureProject({
      code: 'DEMO-EQP-2026-001',
      name: '分切机张力控制',
      leadUserId: users.plead,
      status: 'closed',
      members: [users.researcher],
    });
    console.log(`  → DEMO-MAT (id=${demoProj.id}) / DEMO-NEW (id=${demoNew.id}) / DEMO-PRC (id=${demoPrc.id}) / DEMO-EQP (id=${demoEqp.id})`);

    // ============ 2. 工时 ============
    console.log('[2/12] 工时填报 + 审批...');
    const today = new Date();
    const thisWeekMon = startOfWeek(today);
    const lastWeekMon = addDays(thisWeekMon, -7);

    // researcher 上周 周一~周五 8h × 5 → submitted → approved
    const lastWeekIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const e = await upsertEntry(users.researcher, {
        projectId: demoProj.id,
        workDate: addDays(lastWeekMon, i),
        hours: 8,
        workContent: `上周 day${i + 1}: 配方测试 / 阻燃剂浓度调整`,
      });
      lastWeekIds.push(e.id);
    }
    await submitWeek(users.researcher, lastWeekMon);
    await approveEntries(users.plead, lastWeekIds);

    // researcher 本周 周一~周三 8h × 3 → reviewing (待 plead 周审)
    const thisWeekIds: number[] = [];
    const dow = today.getDay();
    const thisWeekDays = Math.min(3, dow === 0 ? 5 : dow); // 至少 3 天, 不超过周五
    for (let i = 0; i < thisWeekDays; i++) {
      const e = await upsertEntry(users.researcher, {
        projectId: demoProj.id,
        workDate: addDays(thisWeekMon, i),
        hours: 8,
        workContent: `本周 day${i + 1}: 涂布工艺试验 / 数据记录`,
      });
      thisWeekIds.push(e.id);
    }
    await submitWeek(users.researcher, thisWeekMon);

    // rddir 上周 周一~周三 6h × 3 → submitted → approved
    const rddirIds: number[] = [];
    for (let i = 0; i < 3; i++) {
      const e = await upsertEntry(users.rddir, {
        projectId: demoProj.id,
        workDate: addDays(lastWeekMon, i),
        hours: 6,
        workContent: `上周 day${i + 1}: 技术评审 / 配方方案讨论`,
      });
      rddirIds.push(e.id);
    }
    await submitWeek(users.rddir, lastWeekMon);
    await approveEntries(users.plead, rddirIds);

    console.log(
      `  → 工时: researcher 上周 5×8h approved, 本周 ${thisWeekDays}×8h reviewing; rddir 上周 3×6h approved`,
    );

    // ============ 3. 物料流转 (5 个 outbound) ============
    console.log('[3/12] 领料 5 种状态...');
    async function ensureOutboundByPurpose(
      purpose: string,
      mkInput: () => Promise<{ id: number } | null>,
    ): Promise<{ id: number } | null> {
      const exists = await prisma.inventoryOutbound.findFirst({
        where: { projectId: demoProj.id, purpose },
      });
      if (exists) return exists;
      return mkInput();
    }

    // #1 draft
    await ensureOutboundByPurpose('demo#1 阻燃剂草稿', async () =>
      createOutbound(users.researcher, {
        projectId: demoProj.id,
        materialId: materials['M-FLAME'],
        warehouseId: wh.id,
        requestedQty: 10,
        purpose: 'demo#1 阻燃剂草稿',
      }),
    );

    // #2 reviewing: submit → step 1 等 plead 审
    const out2 = await ensureOutboundByPurpose('demo#2 胶水待审', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: demoProj.id,
        materialId: materials['M-GLUE-A'],
        warehouseId: wh.id,
        requestedQty: 5,
        purpose: 'demo#2 胶水待审',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), {
        workflowCode: 'material_request_v1',
        entityId: o.id,
      });
      return o;
    });

    // #3 approved: 2 步全批
    const out3 = await ensureOutboundByPurpose('demo#3 涂层液已批待出', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: demoProj.id,
        materialId: materials['M-COAT'],
        warehouseId: wh.id,
        requestedQty: 8,
        purpose: 'demo#3 涂层液已批待出',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), {
        workflowCode: 'material_request_v1',
        entityId: o.id,
      });
      // 走 2 步
      const t1 = await listTodo(jwt(users.plead, R.PROJECT_LEAD));
      const s1 = t1.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s1) await approve(jwt(users.plead, R.PROJECT_LEAD), { stepId: s1.stepId });
      const t2 = await listTodo(jwt(users.rddir, R.RD_DIRECTOR));
      const s2 = t2.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s2) await approve(jwt(users.rddir, R.RD_DIRECTOR), { stepId: s2.stepId });
      return o;
    });

    // #4 issued: 全流程通过 + 出库
    await ensureOutboundByPurpose('demo#4 基材已出库', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: demoProj.id,
        materialId: materials['M-BOPET-12'],
        warehouseId: wh.id,
        requestedQty: 20,
        purpose: 'demo#4 基材已出库',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), {
        workflowCode: 'material_request_v1',
        entityId: o.id,
      });
      const t1 = await listTodo(jwt(users.plead, R.PROJECT_LEAD));
      const s1 = t1.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s1) await approve(jwt(users.plead, R.PROJECT_LEAD), { stepId: s1.stepId });
      const t2 = await listTodo(jwt(users.rddir, R.RD_DIRECTOR));
      const s2 = t2.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s2) await approve(jwt(users.rddir, R.RD_DIRECTOR), { stepId: s2.stepId });
      await issueOutbound(users.wh, o.id, 20);
      return o;
    });

    // #5 returned: 全流程通过 + 出库 + 全退
    await ensureOutboundByPurpose('demo#5 阻燃剂全退', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: demoProj.id,
        materialId: materials['M-FLAME'],
        warehouseId: wh.id,
        requestedQty: 15,
        purpose: 'demo#5 阻燃剂全退',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), {
        workflowCode: 'material_request_v1',
        entityId: o.id,
      });
      const t1 = await listTodo(jwt(users.plead, R.PROJECT_LEAD));
      const s1 = t1.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s1) await approve(jwt(users.plead, R.PROJECT_LEAD), { stepId: s1.stepId });
      const t2 = await listTodo(jwt(users.rddir, R.RD_DIRECTOR));
      const s2 = t2.find((x) => x.entityType === 'material_request' && x.entityId === o.id);
      if (s2) await approve(jwt(users.rddir, R.RD_DIRECTOR), { stepId: s2.stepId });
      await issueOutbound(users.wh, o.id, 15);
      await returnOutbound(users.wh, o.id, 15, '工艺调整, 全退');
      return o;
    });

    const obByStatus = await prisma.inventoryOutbound.groupBy({
      by: ['status'],
      where: { projectId: demoProj.id },
      _count: { _all: true },
    });
    console.log(
      `  → outbound by status: ${obByStatus.map((g) => `${g.status}=${g._count._all}`).join(' / ')}`,
    );

    // ============ 4. 样品 / 废料 ============
    console.log('[4/12] 样品 / 废料 ...');
    const existingSamples = await prisma.sampleScrapLog.findMany({
      where: { projectId: demoProj.id },
    });
    if (existingSamples.length === 0) {
      // sample #1 draft (待 fin 监销)
      await createSample(users.researcher, {
        projectId: demoProj.id,
        type: 'sample',
        materialId: materials['M-BOPET-12'],
        warehouseId: wh.id,
        consumedQty: 5,
        productName: '阻燃膜样品 A',
        productQty: 3,
        productUnit: '片',
        disposalMethod: 'retained',
        note: 'demo: 留样备查',
      });
      // sample #2 supervised
      const s2 = await createSample(users.researcher, {
        projectId: demoProj.id,
        type: 'sample',
        materialId: materials['M-COAT'],
        warehouseId: wh.id,
        consumedQty: 2,
        productName: '涂层样块',
        productQty: 1,
        productUnit: '块',
        disposalMethod: 'destroyed',
        note: 'demo: 不合格销毁',
      });
      await superviseDirectly(s2.id, users.fin);
      // scrap → ledger 自动写 -1
      const sc = await createSample(users.researcher, {
        projectId: demoProj.id,
        type: 'scrap',
        materialId: materials['M-FLAME'],
        warehouseId: wh.id,
        consumedQty: 1,
        disposalMethod: 'destroyed',
        note: 'demo: 过期阻燃剂废料',
      });
      await superviseDirectly(sc.id, users.fin);
      console.log('  → 样品 2 (1 draft + 1 supervised) + 废料 1 supervised');
    } else {
      console.log(`  → 已存在 ${existingSamples.length} 条样品/废料, 跳过`);
    }

    // ============ 5. 试制 ============
    console.log('[5/12] 试制任务 + 转嫁...');
    async function ensureTrialOrder(opts: {
      title: string;
      plannedQty: number;
      complete: boolean;
    }) {
      const exists = await prisma.trialProductionOrder.findFirst({
        where: { projectId: demoProj.id, title: opts.title },
      });
      if (exists) return exists;
      const o = await createTrialOrder(users.plead, {
        projectId: demoProj.id,
        title: opts.title,
        description: `demo: ${opts.title}`,
        plannedQty: opts.plannedQty,
        plannedUnit: '件',
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'trial_production_v1',
        entityId: o.id,
      });
      // step 1 (plead) approve
      const t1 = await listTodo(jwt(users.plead, R.PROJECT_LEAD));
      const s1 = t1.find((x) => x.entityType === 'trial_production_order' && x.entityId === o.id);
      if (s1) await approve(jwt(users.plead, R.PROJECT_LEAD), { stepId: s1.stepId });
      // step 2 (prod) approve
      const t2 = await listTodo(jwt(users.prod, R.PRODUCTION_LEAD));
      const s2 = t2.find((x) => x.entityType === 'trial_production_order' && x.entityId === o.id);
      if (s2) await approve(jwt(users.prod, R.PRODUCTION_LEAD), { stepId: s2.stepId });
      if (opts.complete) {
        await completeOrder(users.prod, o.id, opts.plannedQty, new Date());
      }
      return prisma.trialProductionOrder.findUniqueOrThrow({ where: { id: o.id } });
    }
    const order1 = await ensureTrialOrder({
      title: '高阻燃膜中试 3 件',
      plannedQty: 3,
      complete: true,
    });
    const order2 = await ensureTrialOrder({
      title: '薄膜测试 5 件',
      plannedQty: 5,
      complete: false,
    });

    // 转嫁单 (基于 order1)
    const transferExists = await prisma.trialCostTransfer.findFirst({
      where: { trialOrderId: order1.id },
    });
    if (!transferExists) {
      const tr = await createTransfer(users.prod, {
        trialOrderId: order1.id,
        laborCost: 2000,
        machineCost: 800,
        materialCost: 300,
        description: 'demo: 高阻燃膜中试转嫁',
      });
      await submit(jwt(users.prod, R.PRODUCTION_LEAD), {
        workflowCode: 'trial_transfer_v1',
        entityId: tr.id,
      });
      for (const [uid, role] of [
        [users.prod, R.PRODUCTION_LEAD],
        [users.rddir, R.RD_DIRECTOR],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const) {
        const ts = await listTodo(jwt(uid, role));
        const s = ts.find((x) => x.entityType === 'trial_cost_transfer' && x.entityId === tr.id);
        if (s) await approve(jwt(uid, role), { stepId: s.stepId });
      }
    }
    console.log(`  → trial order: ${order1.docNo} completed, ${order2.docNo} approved; transfer settled 3100`);

    // ============ 6. 委外 ============
    console.log('[6/12] 委外合同 + 付款...');
    let supplier = await prisma.outsourceSupplier.findUnique({ where: { code: 'SUP-DEMO-001' } });
    if (!supplier) {
      supplier = await createSupplier({
        code: 'SUP-DEMO-001',
        name: '演示委外公司有限公司',
        contactPerson: '王经理',
        contactPhone: '13800001111',
      });
    }
    const contractNo = 'OS-2026-DEMO';
    let contract = await prisma.outsourceContract.findUnique({ where: { contractNo } });
    if (!contract) {
      contract = await createContract(users.plead, {
        contractNo,
        projectId: demoProj.id,
        supplierId: supplier.id,
        title: '阻燃配方外协开发',
        scope: 'demo: 第三方阻燃剂配方研究',
        ipOwnership: '我方所有',
        totalAmount: 50000,
        signedDate: new Date('2026-03-01'),
        startDate: new Date('2026-03-05'),
        endDate: new Date('2026-09-30'),
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'outsource_contract_v1',
        entityId: contract.id,
      });
      for (const [uid, role] of [
        [users.rddir, R.RD_DIRECTOR],
        [users.tech, R.TECH_COMMITTEE],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const) {
        const ts = await listTodo(jwt(uid, role));
        const s = ts.find((x) => x.entityType === 'outsource_contract' && x.entityId === contract!.id);
        if (s) await approve(jwt(uid, role), { stepId: s.stepId });
      }
      // 2 笔付款 (累计 45000, 保留 5000 余额, 合同保持 active)
      await registerPayment(users.fin, {
        contractId: contract.id,
        amount: 30000,
        paidDate: new Date('2026-04-15'),
        installmentNo: 1,
        note: 'demo: 首期 60%',
      });
      await registerPayment(users.fin, {
        contractId: contract.id,
        amount: 15000,
        paidDate: new Date('2026-06-15'),
        installmentNo: 2,
        note: 'demo: 二期 30%',
      });
    }
    const ctAfter = await prisma.outsourceContract.findUniqueOrThrow({ where: { contractNo } });
    console.log(`  → contract ${contractNo}: status=${ctAfter.status}, paid 45000/50000`);

    // ============ 7. 月报 ============
    console.log('[7/12] 月度报告...');
    const now = new Date();
    const thisMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const lastMonth =
      thisMonth.month === 1
        ? { year: thisMonth.year - 1, month: 12 }
        : { year: thisMonth.year, month: thisMonth.month - 1 };

    // 月报 1: 上月 → approved (走 3 步)
    let mr1 = await prisma.monthlyReport.findUnique({
      where: {
        projectId_reportYear_reportMonth: {
          projectId: demoProj.id,
          reportYear: lastMonth.year,
          reportMonth: lastMonth.month,
        },
      },
    });
    if (!mr1) {
      mr1 = await createReport(users.plead, {
        projectId: demoProj.id,
        reportYear: lastMonth.year,
        reportMonth: lastMonth.month,
        monthPlan: 'demo: 上月计划: 完成中试 3 件',
        actualCompletion: 'demo: 中试 3 件完成, 阻燃性能达标',
        outputs: 'demo: 样品 3 件 + 测试报告',
        problems: 'demo: 涂布厚度波动 ±2μm, 需优化',
        resourceUsage: 'demo: 工时 80h, 物料 12k',
        nextMonthPlan: 'demo: 优化涂布工艺, 启动小批量试制',
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'monthly_report_v1',
        entityId: mr1.id,
      });
      for (const [uid, role] of [
        [users.fin, R.FINANCE_LEAD],
        [users.rddir, R.RD_DIRECTOR],
        [users.ceo, R.CEO],
      ] as const) {
        const ts = await listTodo(jwt(uid, role));
        const s = ts.find((x) => x.entityType === 'monthly_report' && x.entityId === mr1!.id);
        if (s) await approve(jwt(uid, role), { stepId: s.stepId });
      }
    }

    // 月报 2: 本月 → 走到 step 2 (fin 已批, rddir 待审)
    let mr2 = await prisma.monthlyReport.findUnique({
      where: {
        projectId_reportYear_reportMonth: {
          projectId: demoProj.id,
          reportYear: thisMonth.year,
          reportMonth: thisMonth.month,
        },
      },
    });
    if (!mr2) {
      mr2 = await createReport(users.plead, {
        projectId: demoProj.id,
        reportYear: thisMonth.year,
        reportMonth: thisMonth.month,
        monthPlan: 'demo: 本月计划: 启动小批量试制',
        actualCompletion: 'demo: 进度 60%',
        outputs: 'demo: 工艺参数表 v2',
        problems: 'demo: 阻燃剂配比需复测',
        resourceUsage: 'demo: 工时 60h',
        nextMonthPlan: 'demo: 完成小批试制 + 第三方认证',
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'monthly_report_v1',
        entityId: mr2.id,
      });
      // 只批 step 1 (fin), 留 step 2 (rddir) 待审
      const ts = await listTodo(jwt(users.fin, R.FINANCE_LEAD));
      const s = ts.find((x) => x.entityType === 'monthly_report' && x.entityId === mr2!.id);
      if (s) await approve(jwt(users.fin, R.FINANCE_LEAD), { stepId: s.stepId });
    }
    console.log(
      `  → 月报: ${lastMonth.year}-${lastMonth.month} approved, ${thisMonth.year}-${thisMonth.month} reviewing (rddir 待审)`,
    );

    // ============ 8. 月度勾稽 ============
    console.log('[8/12] 月度勾稽 (3 类)...');
    const recRows = await runMonthlyReconciliation(lastMonth.year, lastMonth.month);
    // 强制把 material_output 标成异常 (演示用), 不动 expected/actual 真实值
    const matOut = recRows.find((r) => r.checkType === 'material_output');
    if (matOut) {
      await prisma.reconciliationCheck.update({
        where: { id: matOut.id },
        data: { isException: true, diffRate: 0.05, note: 'demo: 演示用异常 (实际差异率人工标注 5%)' },
      });
    }
    console.log(`  → reconciliation ${lastMonth.year}-${lastMonth.month}: 3 类落库, 1 类异常`);

    // ============ 9. 异常单 ============
    console.log('[9/12] 异常核对单...');
    if (matOut) {
      const excExists = await prisma.exceptionNote.findFirst({
        where: { reconciliationId: matOut.id },
      });
      if (!excExists) {
        await createExceptionNote(users.fin, {
          reconciliationId: matOut.id,
          reason: 'demo: 出库金额与样品/废料登记金额差异率 5% > 3% 阈值, 演示用异常',
        });
      }
      console.log('  → exception note open');
    }

    // ============ 10. 季度内审 ============
    console.log('[10/12] 季度内审...');
    const curQuarter = Math.floor(now.getMonth() / 3) + 1; // 1-4
    const lastQ = curQuarter === 1 ? { year: now.getFullYear() - 1, quarter: 4 } : { year: now.getFullYear(), quarter: curQuarter - 1 };
    const auditExists = await prisma.quarterlyAudit.findFirst({
      where: { year: lastQ.year, quarter: lastQ.quarter },
    });
    if (!auditExists) {
      await createAudit(users.rddir, {
        year: lastQ.year,
        quarter: lastQ.quarter,
        checkProject: 'demo: 抽查 4 个项目, 人员认定均符合制度 4.3',
        checkBudget: 'demo: 工时/物料归集与立项预算误差均 ≤5%',
        checkMaterial: 'demo: 工时记录完整, 项目负责人审批率 100%',
        checkOutsource: 'demo: 样品销售/销毁均有财务监销',
        checkArchive: 'demo: 资本化时点判定符合 IAS 38',
        compliantProject: true,
        compliantBudget: true,
        compliantMaterial: true,
        compliantOutsource: true,
        compliantArchive: true,
        overallOpinion: 'demo: 整体合规, 无重大风险',
      });
    }
    console.log(`  → audit ${lastQ.year} Q${lastQ.quarter}`);

    // ============ 11. 资本化 ============
    console.log('[11/12] 资本化评估...');
    const capExists = await prisma.capitalizationReport.findFirst({
      where: { projectId: demoProj.id },
    });
    if (!capExists) {
      const cap = await createCapitalization(users.plead, {
        projectId: demoProj.id,
        condTechnical: true,
        condIntent: true,
        condUsability: true,
        condMarket: true,
        condResource: true,
        evidenceTechnical: 'demo: 中试 3 件 UL94 V-0 通过 + 第三方阻燃测试报告 SGS-2026-001',
        evidenceMarket: 'demo: 新能源客户 3 家意向, 总采购 200t/年',
        evidenceResource: 'demo: 已立项预算 50w, 配置 lead + 1 主研 + 1 技委评审员',
        evidenceCost: 'demo: 工时台账 80h + 物料归集 12k, 详见 cost-summary',
        capitalizationAmount: 100000,
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'capitalization_v1',
        entityId: cap.id,
      });
      for (const [uid, role] of [
        [users.rddir, R.RD_DIRECTOR],
        [users.tech, R.TECH_COMMITTEE],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const) {
        const ts = await listTodo(jwt(uid, role));
        const s = ts.find((x) => x.entityType === 'capitalization_report' && x.entityId === cap.id);
        if (s) await approve(jwt(uid, role), { stepId: s.stepId });
      }
    }
    console.log('  → capitalization DEMO-MAT approved 100k');

    // ============ 12. 结项报告 (DEMO-EQP) ============
    console.log('[12/12] 结项报告 (DEMO-EQP)...');
    const clExists = await prisma.closingReport.findFirst({ where: { projectId: demoEqp.id } });
    if (!clExists) {
      // DEMO-EQP 必须先转 active, 才能 createClosing; 完成后 setApproved hook 会把它推回 closed
      await prisma.project.update({ where: { id: demoEqp.id }, data: { status: 'active' } });
      const cl = await createClosing(users.plead, {
        projectId: demoEqp.id,
        basicSummary: 'demo: 分切机张力控制项目历时 8 个月, 完成 PID 算法升级 + 在线传感器集成',
        goalReview: 'demo: 张力波动从 ±5% 降至 ±1.5%, 优于目标 ±2%',
        outputs: 'demo: 1 项实用新型专利 + 在线监控系统',
        budgetReview: 'demo: 预算 500k, 实际 472k, 节省 28k',
        lessons: 'demo: 传感器选型应提前 2 月调研, 后期可减少返工',
        conversionPlan: 'demo: Q4 推广到全线 4 台分切机',
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), {
        workflowCode: 'closing_report_v1',
        entityId: cl.id,
      });
      // 3 步: plead (project lead) → rddir → tech
      const t1 = await listTodo(jwt(users.plead, R.PROJECT_LEAD));
      const s1 = t1.find((x) => x.entityType === 'closing_report' && x.entityId === cl.id);
      if (s1) await approve(jwt(users.plead, R.PROJECT_LEAD), { stepId: s1.stepId });
      const t2 = await listTodo(jwt(users.rddir, R.RD_DIRECTOR));
      const s2 = t2.find((x) => x.entityType === 'closing_report' && x.entityId === cl.id);
      if (s2) await approve(jwt(users.rddir, R.RD_DIRECTOR), { stepId: s2.stepId });
      const t3 = await listTodo(jwt(users.tech, R.TECH_COMMITTEE));
      const s3 = t3.find((x) => x.entityType === 'closing_report' && x.entityId === cl.id);
      if (s3) await approve(jwt(users.tech, R.TECH_COMMITTEE), { stepId: s3.stepId });
      // 归档
      await prisma.closingReport.update({
        where: { id: cl.id },
        data: { archivedAt: new Date() },
      });
    }
    console.log('  → closing DEMO-EQP approved + archived');

    // ============ Bonus: 通知 ============
    console.log('[bonus] 通知 + AppTopBar 红点...');
    const notifCount = await prisma.notification.count({ where: { recipientId: users.plead } });
    if (notifCount === 0) {
      const recipients = [users.plead, users.researcher, users.rddir, users.tech, users.prod, users.fin, users.ceo, users.wh];
      // 通用公告 1 条未读 + 1 条已读
      for (const rid of recipients) {
        await prisma.notification.create({
          data: {
            recipientId: rid,
            eventType: 'system_announce',
            message: 'demo: 系统升级公告 — 月报新增第三方测试报告附件上传支持',
          },
        });
      }
      // 已读公告 (一条历史)
      for (const rid of recipients) {
        await prisma.notification.create({
          data: {
            recipientId: rid,
            eventType: 'system_announce',
            message: 'demo: 上月系统例行维护已完成',
            readAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
          },
        });
      }
      // 项目立项通过通知 (推送给 prod + wh)
      for (const rid of [users.prod, users.wh]) {
        await prisma.notification.create({
          data: {
            recipientId: rid,
            eventType: 'project_approved',
            entityType: 'project',
            entityId: demoProj.id,
            message: `demo: 项目 ${demoProj.code} 立项通过, 可申请相关物料`,
          },
        });
      }
    }
    const finalNotif = await prisma.notification.count({ where: { readAt: null } });
    console.log(`  → 未读通知: ${finalNotif}`);

    console.log('\n=== 演示数据已就绪 ===');
    console.log('登录账号 (密码 1234):');
    console.log('  plead      陈项目  — 项目负责人 (待审领料/工时, 项目大屏)');
    console.log('  researcher 李研发  — 研究员 (工时填报, 领料申请)');
    console.log('  rddir      王中心  — 研发中心 (月报待审 1 条)');
    console.log('  tech       张技委  — 技委会 (DEMO-PRC 项目审批)');
    console.log('  prod       赵生产  — 生产部 (进行中试制任务 1)');
    console.log('  fin        钱财务  — 财务部 (待监销样品 1)');
    console.log('  ceo        总经理  — 总经理 (大屏全局)');
    console.log('  wh         孙仓管  — 仓管 (待出库领料 1)');
    console.log('管理员 admin / 1234');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
