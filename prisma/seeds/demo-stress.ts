/**
 * 压力测试 seed: 模拟大量数据, 覆盖所有业务流程的所有状态分支 + 边界情况.
 *
 * 跑顺序: `pnpm seed:demo` → `pnpm seed:demo-business` → `pnpm seed:stress`.
 *
 * 目标:
 *  - 8-10 个 STRESS-* 项目覆盖全部 6 个 ProjectStatus (draft/reviewing/rejected/active/closed/cancelled)
 *  - 1 个完全空的 active 项目 (STRESS-EMPTY-01) — 空数组/null 边界 bug 高发区
 *  - active 项目挂全状态业务数据: 工时 / 物料 / 样品废料 / 试制 / 委外 / 月报 / 变更 / CD 期
 *  - 所有 STRESS 项目 isTest=true
 *
 * 幂等: 用固定 code 前缀 STRESS-*, 已存在则跳过该段.
 * 规模适中, 控制在 1-2 分钟跑完.
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

import { submit, approve, reject, listTodo } from '../../src/modules/workflow/engine';
import { ROLE_CODES as R } from '../../src/modules/permission/nodes';

import { upsertEntry, submitWeek, approveEntries } from '../../src/modules/workhour/workhour-service';
import { createOutbound, issueOutbound } from '../../src/modules/inventory/outbound-service';
import { returnOutbound } from '../../src/modules/inventory/return-service';
import { createInbound } from '../../src/modules/inventory/inbound-service';
import { createUsage } from '../../src/modules/inventory/usage-service';
import { createSample, superviseDirectly } from '../../src/modules/sample/sample-service';
import { createTrialOrder, completeOrder } from '../../src/modules/trial/production-service';
import { createTransfer } from '../../src/modules/trial/transfer-service';
import { createSupplier } from '../../src/modules/outsource/supplier-service';
import { createContract } from '../../src/modules/outsource/contract-service';
import { registerPayment } from '../../src/modules/outsource/payment-service';
import { createReport } from '../../src/modules/monthly/monthly-service';
import { createChangeRequest } from '../../src/modules/project/change-service';
import { runMonthlyReconciliation } from '../../src/modules/reconciliation/reconciliation-service';
import { createExceptionNote, resolveExceptionNote } from '../../src/modules/reconciliation/exception-service';
import { createAudit } from '../../src/modules/audit/audit-service';
import { createCapitalization } from '../../src/modules/capitalization/capitalization-service';
import { createClosing } from '../../src/modules/closing/closing-service';

type Users = {
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

function startOfWeek(d: Date): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = r.getDay();
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

/** 走 1 步审批: 找到指定 entityType+entityId 的 pending step, 用 actor approve. */
async function approveStep(
  uid: number,
  role: string,
  entityType: string,
  entityId: number,
): Promise<boolean> {
  const todos = await listTodo(jwt(uid, role));
  const s = todos.find((x) => x.entityType === entityType && x.entityId === entityId);
  if (s) {
    await approve(jwt(uid, role), { stepId: s.stepId });
    return true;
  }
  return false;
}

/** 走 1 步驳回. */
async function rejectStep(
  uid: number,
  role: string,
  entityType: string,
  entityId: number,
  comments: string,
): Promise<boolean> {
  const todos = await listTodo(jwt(uid, role));
  const s = todos.find((x) => x.entityType === entityType && x.entityId === entityId);
  if (s) {
    await reject(jwt(uid, role), { stepId: s.stepId, comments });
    return true;
  }
  return false;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const users = await getUserMap(prisma);
    const projType = await prisma.projectType.findUniqueOrThrow({ where: { code: 'MAT' } });
    const dept = await prisma.department.findUniqueOrThrow({ where: { code: 'rd_center' } });
    const wh = await prisma.warehouse.findUniqueOrThrow({ where: { code: 'rd-warehouse' } });
    const materials = Object.fromEntries(
      (await prisma.material.findMany({})).map((m) => [m.code, m.id]),
    );

    // ============ 0. 补库存 (压力 seed 大量领料, 先充足) ============
    console.log('[0] 补库存 (每物料 +2000)...');
    for (const mc of ['M-BOPET-12', 'M-FLAME', 'M-GLUE-A', 'M-COAT', 'M-TEST-P']) {
      const exists = await prisma.inventoryLedger.findFirst({
        where: { materialId: materials[mc], warehouseId: wh.id, note: 'stress 期初补库' },
      });
      if (exists) continue;
      await createInbound(users.wh, {
        materialId: materials[mc],
        warehouseId: wh.id,
        quantity: 2000,
        unitPrice: 20,
        changeType: 'inbound',
        receivedAt: new Date(),
        note: 'stress 期初补库',
      });
    }

    // ============ 1. 项目矩阵 (覆盖全部 6 状态) ============
    console.log('[1] 项目矩阵 (6 状态)...');

    /** 直接 create 一个 STRESS 项目 (指定 status, isTest=true). 幂等. */
    async function ensureProject(opts: {
      code: string;
      name: string;
      status: 'draft' | 'reviewing' | 'rejected' | 'active' | 'closed' | 'cancelled';
      members?: number[];
      rejectedReason?: string;
    }) {
      const exists = await prisma.project.findFirst({ where: { code: opts.code } });
      if (exists) return exists;
      return prisma.project.create({
        data: {
          code: opts.code,
          name: opts.name,
          isTest: true,
          projectTypeId: projType.id,
          departmentId: dept.id,
          leadUserId: users.plead,
          status: opts.status,
          startDate: new Date('2026-01-01'),
          endDate: new Date('2026-12-31'),
          budget: 800000,
          background: `stress: ${opts.name} 行业背景`,
          goals: `stress: ${opts.name} 目标`,
          techPlan: 'stress: 配方 → 小试 → 中试 → 量产',
          schedule: 'stress: Q1/Q2/Q3/Q4',
          budgetDetail: 'stress: 人工 + 材料 + 试制 + 委外',
          expectedOutput: 'stress: 2 项专利 + 量产配方',
          createdById: users.plead,
          activatedAt:
            opts.status === 'active' || opts.status === 'closed' ? new Date() : null,
          rejectedAt: opts.status === 'rejected' ? new Date() : null,
          rejectedReason: opts.status === 'rejected' ? opts.rejectedReason ?? 'stress: 立项被驳回' : null,
          members: {
            create: [
              { userId: users.plead, role: '项目负责人', isLead: true },
              ...(opts.members ?? []).map((uid) => ({ userId: uid, role: '研究员' })),
            ],
          },
        },
      });
    }

    const pDraft = await ensureProject({ code: 'STRESS-DRAFT-01', name: '压力-草稿项目', status: 'draft' });
    const pReview = await ensureProject({ code: 'STRESS-REVIEW-01', name: '压力-审批中项目', status: 'reviewing' });
    const pReject = await ensureProject({
      code: 'STRESS-REJECT-01',
      name: '压力-被驳回项目',
      status: 'rejected',
      rejectedReason: 'stress: 立项被研发中心驳回 — 技术路线不清晰, 预算明细缺失',
    });
    const pActive1 = await ensureProject({ code: 'STRESS-ACTIVE-01', name: '压力-进行中-1', status: 'active', members: [users.researcher, users.rddir] });
    const pActive2 = await ensureProject({ code: 'STRESS-ACTIVE-02', name: '压力-进行中-2', status: 'active', members: [users.researcher] });
    const pActive3 = await ensureProject({ code: 'STRESS-ACTIVE-03', name: '压力-进行中-3', status: 'active', members: [users.researcher] });
    const pClosed = await ensureProject({ code: 'STRESS-CLOSED-01', name: '压力-已结项', status: 'active', members: [users.researcher] }); // 先 active, 跑完结项 hook 推 closed
    const pCancel = await ensureProject({ code: 'STRESS-CANCEL-01', name: '压力-已撤回', status: 'cancelled' });
    const pEmpty = await ensureProject({ code: 'STRESS-EMPTY-01', name: '压力-空项目边界', status: 'active' });

    const activeProjects = [pActive1, pActive2, pActive3];
    console.log(
      `  → STRESS 项目: draft/${pDraft.id} reviewing/${pReview.id} rejected/${pReject.id} active/${pActive1.id},${pActive2.id},${pActive3.id} closed-pending/${pClosed.id} cancelled/${pCancel.id} EMPTY/${pEmpty.id}`,
    );

    // STRESS-REVIEW-01 真走 workflow 2 步停在技委会 (覆盖"卡中间步骤"实例)
    {
      const inst = await prisma.approvalInstance.findFirst({
        where: { entityType: 'project', entityId: pReview.id },
      });
      if (!inst) {
        await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'project_approval_v1', entityId: pReview.id });
        // step1 研发中心初审 → approve, 停在 step2 技委会
        await approveStep(users.rddir, R.RD_DIRECTOR, 'project', pReview.id);
      }
    }

    // ============ 2. 工时 (多人多月, 状态混合 + 边界) ============
    console.log('[2] 工时 (多人多月混合状态)...');
    const today = new Date();
    const thisWeekMon = startOfWeek(today);
    const lastWeekMon = addDays(thisWeekMon, -7);
    const twoWeeksAgoMon = addDays(thisWeekMon, -14);

    const existingWh = await prisma.workhourEntry.count({ where: { projectId: pActive1.id } });
    if (existingWh === 0) {
      // researcher: 两周前 5 天 approved + 上周 3 天 approved
      const w0: number[] = [];
      for (let i = 0; i < 5; i++) {
        const e = await upsertEntry(users.researcher, {
          projectId: pActive1.id,
          workDate: addDays(twoWeeksAgoMon, i),
          hours: 8,
          workContent: `stress 两周前 day${i + 1}: 配方测试`,
        });
        w0.push(e.id);
      }
      await submitWeek(users.researcher, twoWeeksAgoMon);
      await approveEntries(users.plead, w0);

      const w1: number[] = [];
      for (let i = 0; i < 3; i++) {
        const e = await upsertEntry(users.researcher, {
          projectId: pActive1.id,
          workDate: addDays(lastWeekMon, i),
          hours: 7.5,
          workContent: `stress 上周 day${i + 1}: 中试`,
        });
        w1.push(e.id);
      }
      await submitWeek(users.researcher, lastWeekMon);
      await approveEntries(users.plead, w1);

      // rddir: 上周 1 天 reviewing (待审, 卡中间)
      await upsertEntry(users.rddir, {
        projectId: pActive1.id,
        workDate: addDays(lastWeekMon, 0),
        hours: 4,
        workContent: 'stress 上周: 技术评审 (待周审)',
      });
      await submitWeek(users.rddir, lastWeekMon);

      // tech: 两周前 2 天填了但只 draft (不提交 — 边界: 只有 draft)
      await upsertEntry(users.tech, {
        projectId: pActive1.id,
        workDate: addDays(twoWeeksAgoMon, 0),
        hours: 3,
        workContent: 'stress 草稿工时, 未提交',
      });
      // users.prod = 0 工时 (不填) — 边界已天然满足
    }
    // active2: 仅 1 个人 1 天 approved (单点边界)
    if ((await prisma.workhourEntry.count({ where: { projectId: pActive2.id } })) === 0) {
      const e = await upsertEntry(users.researcher, {
        projectId: pActive2.id,
        workDate: addDays(lastWeekMon, 0),
        hours: 8,
        workContent: 'stress active2 单日工时',
      });
      await submitWeek(users.researcher, lastWeekMon);
      await approveEntries(users.plead, [e.id]);
    }

    // ============ 3. 物料: 全状态领料 + 消耗 ============
    console.log('[3] 领料单全状态 + 消耗登记...');
    async function ensureOutbound(
      proj: { id: number },
      purpose: string,
      mk: () => Promise<{ id: number }>,
    ): Promise<{ id: number } | null> {
      const exists = await prisma.inventoryOutbound.findFirst({
        where: { projectId: proj.id, purpose },
      });
      if (exists) return exists;
      return mk();
    }

    async function fullApproveOutbound(o: { id: number }) {
      await submit(jwt(users.researcher, R.RESEARCHER), {
        workflowCode: 'material_request_v1',
        entityId: o.id,
      });
      await approveStep(users.plead, R.PROJECT_LEAD, 'material_request', o.id);
      await approveStep(users.rddir, R.RD_DIRECTOR, 'material_request', o.id);
    }

    // 对 pActive1 造全状态领料单
    await ensureOutbound(pActive1, 'S#1 草稿', () =>
      createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-FLAME'], warehouseId: wh.id,
        requestedQty: 10, purpose: 'S#1 草稿',
      }),
    );
    // reviewing
    await ensureOutbound(pActive1, 'S#2 待审', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-GLUE-A'], warehouseId: wh.id,
        requestedQty: 5, purpose: 'S#2 待审',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), { workflowCode: 'material_request_v1', entityId: o.id });
      return o;
    });
    // rejected
    await ensureOutbound(pActive1, 'S#3 被驳回', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-COAT'], warehouseId: wh.id,
        requestedQty: 8, purpose: 'S#3 被驳回',
      });
      await submit(jwt(users.researcher, R.RESEARCHER), { workflowCode: 'material_request_v1', entityId: o.id });
      await rejectStep(users.plead, R.PROJECT_LEAD, 'material_request', o.id, 'stress: 用量超标, 驳回');
      return o;
    });
    // approved (待出库)
    await ensureOutbound(pActive1, 'S#4 已批待出', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-COAT'], warehouseId: wh.id,
        requestedQty: 6, purpose: 'S#4 已批待出',
      });
      await fullApproveOutbound(o);
      return o;
    });
    // issued + 多笔消耗 (不同事件类型, 留部分在手)
    const outIssued = await ensureOutbound(pActive1, 'S#5 已出库消耗', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-BOPET-12'], warehouseId: wh.id,
        requestedQty: 40, purpose: 'S#5 已出库消耗',
      });
      await fullApproveOutbound(o);
      await issueOutbound(users.wh, o.id, 40);
      return o;
    });
    if (outIssued && (await prisma.materialUsageLog.count({ where: { outboundId: outIssued.id } })) === 0) {
      await createUsage(users.researcher, { outboundId: outIssued.id, usageDate: addDays(today, -5), quantity: 10, eventType: 'testing', description: 'stress 测试消耗' });
      await createUsage(users.researcher, { outboundId: outIssued.id, usageDate: addDays(today, -4), quantity: 8, eventType: 'trial_prep', description: 'stress 试制备料' });
      await createUsage(users.researcher, { outboundId: outIssued.id, usageDate: addDays(today, -3), quantity: 5, eventType: 'sample_making', description: 'stress 样品制备' });
      await createUsage(users.researcher, { outboundId: outIssued.id, usageDate: addDays(today, -2), quantity: 2, eventType: 'loss', description: 'stress 损耗' });
      // 余 15 在手
    }
    // issued + 0 消耗 (边界: 全在手)
    await ensureOutbound(pActive1, 'S#6 出库0消耗', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-FLAME'], warehouseId: wh.id,
        requestedQty: 12, purpose: 'S#6 出库0消耗',
      });
      await fullApproveOutbound(o);
      await issueOutbound(users.wh, o.id, 12);
      return o;
    });
    // returned (全退, 在手=0 边界)
    await ensureOutbound(pActive1, 'S#7 全额退库', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive1.id, materialId: materials['M-GLUE-A'], warehouseId: wh.id,
        requestedQty: 15, purpose: 'S#7 全额退库',
      });
      await fullApproveOutbound(o);
      await issueOutbound(users.wh, o.id, 15);
      await returnOutbound(users.wh, o.id, 15, 'stress: 工艺调整全退');
      return o;
    });
    // active2: 1 个 issued + 部分消耗
    const out2Issued = await ensureOutbound(pActive2, 'S2#1 出库部分消耗', async () => {
      const o = await createOutbound(users.researcher, {
        projectId: pActive2.id, materialId: materials['M-COAT'], warehouseId: wh.id,
        requestedQty: 20, purpose: 'S2#1 出库部分消耗',
      });
      await fullApproveOutbound(o);
      await issueOutbound(users.wh, o.id, 20);
      return o;
    });
    if (out2Issued && (await prisma.materialUsageLog.count({ where: { outboundId: out2Issued.id } })) === 0) {
      await createUsage(users.researcher, { outboundId: out2Issued.id, usageDate: addDays(today, -1), quantity: 7, eventType: 'other', description: 'stress 其他消耗' });
    }

    // ============ 4. 样品 / 废料 (全 disposalMethod + sold 带 income) ============
    console.log('[4] 样品/废料 (全处置方式)...');
    if ((await prisma.sampleScrapLog.count({ where: { projectId: pActive1.id } })) === 0) {
      // sample retained (draft 待监销)
      await createSample(users.researcher, {
        projectId: pActive1.id, type: 'sample', materialId: materials['M-BOPET-12'], warehouseId: wh.id,
        consumedQty: 5, productName: 'stress 阻燃膜样品', productQty: 3, productUnit: '片',
        disposalMethod: 'retained', note: 'stress: 留样备查',
      });
      // sample destroyed (supervised)
      const sd = await createSample(users.researcher, {
        projectId: pActive1.id, type: 'sample', materialId: materials['M-COAT'], warehouseId: wh.id,
        consumedQty: 2, productName: 'stress 涂层样块', productQty: 1, productUnit: '块',
        disposalMethod: 'destroyed', note: 'stress: 不合格销毁',
      });
      await superviseDirectly(sd.id, users.fin);
      // sample sold (带 disposalIncome, supervised)
      const ss = await createSample(users.researcher, {
        projectId: pActive1.id, type: 'sample', materialId: materials['M-BOPET-12'], warehouseId: wh.id,
        consumedQty: 3, productName: 'stress 可售样品', productQty: 2, productUnit: '片',
        disposalMethod: 'sold', disposalIncome: 1500, note: 'stress: 样品对外销售',
      });
      await superviseDirectly(ss.id, users.fin);
      // sample internal_use (draft)
      await createSample(users.researcher, {
        projectId: pActive1.id, type: 'sample', materialId: materials['M-COAT'], warehouseId: wh.id,
        consumedQty: 1, productName: 'stress 内部使用样', productQty: 1, productUnit: '块',
        disposalMethod: 'internal_use', note: 'stress: 转内部测试',
      });
      // scrap destroyed (supervised)
      const sc = await createSample(users.researcher, {
        projectId: pActive1.id, type: 'scrap', materialId: materials['M-FLAME'], warehouseId: wh.id,
        consumedQty: 1, disposalMethod: 'destroyed', note: 'stress: 过期废料销毁',
      });
      await superviseDirectly(sc.id, users.fin);
    }

    // ============ 5. 试制 (全状态 + 转嫁全状态) ============
    console.log('[5] 试制 + 转嫁全状态...');
    async function ensureTrial(opts: {
      proj: { id: number };
      title: string;
      plannedQty: number;
      target: 'draft' | 'reviewing' | 'approved' | 'completed' | 'rejected';
    }) {
      const exists = await prisma.trialProductionOrder.findFirst({
        where: { projectId: opts.proj.id, title: opts.title },
      });
      if (exists) return exists;
      const o = await createTrialOrder(users.plead, {
        projectId: opts.proj.id, title: opts.title, description: `stress: ${opts.title}`,
        plannedQty: opts.plannedQty, plannedUnit: '件',
      });
      if (opts.target === 'draft') return prisma.trialProductionOrder.findUniqueOrThrow({ where: { id: o.id } });
      await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'trial_production_v1', entityId: o.id });
      if (opts.target === 'reviewing') return prisma.trialProductionOrder.findUniqueOrThrow({ where: { id: o.id } });
      if (opts.target === 'rejected') {
        await rejectStep(users.plead, R.PROJECT_LEAD, 'trial_production_order', o.id, 'stress: 试制方案不可行, 驳回');
        return prisma.trialProductionOrder.findUniqueOrThrow({ where: { id: o.id } });
      }
      // approved / completed: 走 2 步
      await approveStep(users.plead, R.PROJECT_LEAD, 'trial_production_order', o.id);
      await approveStep(users.prod, R.PRODUCTION_LEAD, 'trial_production_order', o.id);
      if (opts.target === 'completed') {
        await completeOrder(users.prod, o.id, opts.plannedQty, new Date());
      }
      return prisma.trialProductionOrder.findUniqueOrThrow({ where: { id: o.id } });
    }
    await ensureTrial({ proj: pActive1, title: 'stress 试制草稿', plannedQty: 2, target: 'draft' });
    await ensureTrial({ proj: pActive1, title: 'stress 试制待审', plannedQty: 3, target: 'reviewing' });
    await ensureTrial({ proj: pActive1, title: 'stress 试制被驳', plannedQty: 4, target: 'rejected' });
    await ensureTrial({ proj: pActive1, title: 'stress 试制已批', plannedQty: 5, target: 'approved' });
    const trCompleted = await ensureTrial({ proj: pActive1, title: 'stress 试制完成', plannedQty: 6, target: 'completed' });
    const trCompleted2 = await ensureTrial({ proj: pActive2, title: 'stress 试制完成2', plannedQty: 3, target: 'completed' });

    // 转嫁单: settled / 卡中间 / rejected
    async function ensureTransfer(opts: {
      order: { id: number };
      target: 'reviewing' | 'mid' | 'settled' | 'rejected';
    }) {
      const exists = await prisma.trialCostTransfer.findFirst({ where: { trialOrderId: opts.order.id } });
      if (exists) return exists;
      const tr = await createTransfer(users.prod, {
        trialOrderId: opts.order.id, laborCost: 2000, machineCost: 800, materialCost: 300,
        description: 'stress: 试制成本转嫁',
      });
      await submit(jwt(users.prod, R.PRODUCTION_LEAD), { workflowCode: 'trial_transfer_v1', entityId: tr.id });
      const chain = [
        [users.prod, R.PRODUCTION_LEAD],
        [users.rddir, R.RD_DIRECTOR],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const;
      if (opts.target === 'reviewing') return tr;
      if (opts.target === 'rejected') {
        await rejectStep(users.prod, R.PRODUCTION_LEAD, 'trial_cost_transfer', tr.id, 'stress: 成本核算有误, 驳回');
        return tr;
      }
      if (opts.target === 'mid') {
        // 只走前 2 步, 卡在财务
        await approveStep(chain[0][0], chain[0][1], 'trial_cost_transfer', tr.id);
        await approveStep(chain[1][0], chain[1][1], 'trial_cost_transfer', tr.id);
        return tr;
      }
      // settled: 全 4 步
      for (const [uid, role] of chain) {
        await approveStep(uid, role, 'trial_cost_transfer', tr.id);
      }
      return tr;
    }
    if (trCompleted) await ensureTransfer({ order: trCompleted, target: 'settled' });
    if (trCompleted2) await ensureTransfer({ order: trCompleted2, target: 'mid' });

    // ============ 6. 委外 (2 供应商 + 全状态合同) ============
    console.log('[6] 委外供应商 + 全状态合同...');
    async function ensureSupplier(code: string, name: string) {
      const ex = await prisma.outsourceSupplier.findUnique({ where: { code } });
      if (ex) return ex;
      return createSupplier({ code, name, contactPerson: '联系人', contactPhone: '13900000000' });
    }
    const sup1 = await ensureSupplier('SUP-STRESS-01', 'stress 委外公司甲');
    const sup2 = await ensureSupplier('SUP-STRESS-02', 'stress 委外公司乙');

    async function ensureContract(opts: {
      contractNo: string;
      proj: { id: number };
      supplierId: number;
      target: 'draft' | 'reviewing' | 'active' | 'completed' | 'rejected';
      pay?: 'partial' | 'full';
    }) {
      const ex = await prisma.outsourceContract.findUnique({ where: { contractNo: opts.contractNo } });
      if (ex) return ex;
      const c = await createContract(users.plead, {
        contractNo: opts.contractNo, projectId: opts.proj.id, supplierId: opts.supplierId,
        title: `stress 委外 ${opts.contractNo}`, scope: 'stress: 第三方配方研究', ipOwnership: '我方所有',
        totalAmount: 50000, signedDate: new Date('2026-03-01'),
        startDate: new Date('2026-03-05'), endDate: new Date('2026-09-30'),
      });
      if (opts.target === 'draft') return c;
      await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'outsource_contract_v1', entityId: c.id });
      if (opts.target === 'reviewing') return c;
      const chain = [
        [users.rddir, R.RD_DIRECTOR],
        [users.tech, R.TECH_COMMITTEE],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const;
      if (opts.target === 'rejected') {
        await rejectStep(users.rddir, R.RD_DIRECTOR, 'outsource_contract', c.id, 'stress: 合同条款不符, 驳回');
        return c;
      }
      // active / completed: 全 4 步通过
      for (const [uid, role] of chain) {
        await approveStep(uid, role, 'outsource_contract', c.id);
      }
      if (opts.pay === 'partial') {
        await registerPayment(users.fin, { contractId: c.id, amount: 20000, paidDate: new Date('2026-04-15'), installmentNo: 1, note: 'stress 首期' });
      } else if (opts.pay === 'full') {
        await registerPayment(users.fin, { contractId: c.id, amount: 30000, paidDate: new Date('2026-04-15'), installmentNo: 1, note: 'stress 首期' });
        await registerPayment(users.fin, { contractId: c.id, amount: 20000, paidDate: new Date('2026-06-15'), installmentNo: 2, note: 'stress 尾款' });
      }
      return c;
    }
    await ensureContract({ contractNo: 'OS-STRESS-DRAFT', proj: pActive1, supplierId: sup1.id, target: 'draft' });
    await ensureContract({ contractNo: 'OS-STRESS-REVIEW', proj: pActive1, supplierId: sup1.id, target: 'reviewing' });
    await ensureContract({ contractNo: 'OS-STRESS-REJECT', proj: pActive1, supplierId: sup2.id, target: 'rejected' });
    await ensureContract({ contractNo: 'OS-STRESS-ACTIVE-P', proj: pActive1, supplierId: sup1.id, target: 'active', pay: 'partial' });
    await ensureContract({ contractNo: 'OS-STRESS-ACTIVE-F', proj: pActive2, supplierId: sup2.id, target: 'active', pay: 'full' });

    // ============ 7. 月报 (多项目多月混合状态) ============
    console.log('[7] 月报全状态...');
    const now = new Date();
    const thisMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
    const lastMonth = thisMonth.month === 1 ? { year: thisMonth.year - 1, month: 12 } : { year: thisMonth.year, month: thisMonth.month - 1 };
    const twoMonthsAgo = lastMonth.month === 1 ? { year: lastMonth.year - 1, month: 12 } : { year: lastMonth.year, month: lastMonth.month - 1 };

    async function ensureReport(opts: {
      proj: { id: number };
      year: number;
      month: number;
      target: 'draft' | 'reviewing' | 'approved' | 'rejected';
    }) {
      const ex = await prisma.monthlyReport.findUnique({
        where: { projectId_reportYear_reportMonth: { projectId: opts.proj.id, reportYear: opts.year, reportMonth: opts.month } },
      });
      if (ex) return ex;
      const r = await createReport(users.plead, {
        projectId: opts.proj.id, reportYear: opts.year, reportMonth: opts.month,
        monthPlan: 'stress 计划', actualCompletion: 'stress 实绩', outputs: 'stress 产出',
        problems: 'stress 问题', resourceUsage: 'stress 资源', nextMonthPlan: 'stress 下月',
      });
      if (opts.target === 'draft') return r;
      await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'monthly_report_v1', entityId: r.id });
      if (opts.target === 'reviewing') {
        // 走 1 步 (fin), 停 rddir
        await approveStep(users.fin, R.FINANCE_LEAD, 'monthly_report', r.id);
        return r;
      }
      if (opts.target === 'rejected') {
        await rejectStep(users.fin, R.FINANCE_LEAD, 'monthly_report', r.id, 'stress: 月报数据不全, 驳回');
        return r;
      }
      // approved: fin → rddir → ceo
      await approveStep(users.fin, R.FINANCE_LEAD, 'monthly_report', r.id);
      await approveStep(users.rddir, R.RD_DIRECTOR, 'monthly_report', r.id);
      await approveStep(users.ceo, R.CEO, 'monthly_report', r.id);
      return r;
    }
    await ensureReport({ proj: pActive1, year: twoMonthsAgo.year, month: twoMonthsAgo.month, target: 'approved' });
    await ensureReport({ proj: pActive1, year: lastMonth.year, month: lastMonth.month, target: 'reviewing' });
    await ensureReport({ proj: pActive1, year: thisMonth.year, month: thisMonth.month, target: 'draft' });
    await ensureReport({ proj: pActive2, year: lastMonth.year, month: lastMonth.month, target: 'rejected' });

    // ============ 8. 项目变更 (active 项目, 全状态) ============
    console.log('[8] 项目变更全状态...');
    async function ensureChange(opts: {
      proj: { id: number };
      reason: string;
      target: 'reviewing' | 'mid' | 'approved' | 'rejected';
      newBudget?: number;
    }) {
      const ex = await prisma.projectChangeRequest.findFirst({ where: { projectId: opts.proj.id, reason: opts.reason } });
      if (ex) return ex;
      const ch = await createChangeRequest(opts.proj.id, users.plead, {
        reason: opts.reason, scope: 'stress 变更范围', details: 'stress 变更详情',
        newBudget: opts.newBudget,
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'project_change_v1', entityId: ch.id });
      const chain = [
        [users.rddir, R.RD_DIRECTOR],
        [users.tech, R.TECH_COMMITTEE],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const;
      if (opts.target === 'reviewing') return ch;
      if (opts.target === 'rejected') {
        await rejectStep(users.rddir, R.RD_DIRECTOR, 'project_change', ch.id, 'stress: 变更理由不充分, 驳回');
        return ch;
      }
      if (opts.target === 'mid') {
        await approveStep(chain[0][0], chain[0][1], 'project_change', ch.id);
        await approveStep(chain[1][0], chain[1][1], 'project_change', ch.id);
        return ch;
      }
      // approved: 全 4 步, hook 套用变更
      for (const [uid, role] of chain) {
        await approveStep(uid, role, 'project_change', ch.id);
      }
      return ch;
    }
    await ensureChange({ proj: pActive1, reason: 'stress 变更-已批套用', target: 'approved', newBudget: 900000 });
    await ensureChange({ proj: pActive1, reason: 'stress 变更-被驳回', target: 'rejected' });
    await ensureChange({ proj: pActive2, reason: 'stress 变更-审批中', target: 'mid' });

    // ============ 9. CD 期: 资本化 / 结项 / 勾稽 / 异常 / 内审 ============
    console.log('[9] CD 期 (资本化/结项/勾稽/异常/内审)...');

    // 资本化: approved / reviewing / rejected (不同项目)
    async function ensureCap(opts: { proj: { id: number }; target: 'reviewing' | 'approved' | 'rejected' }) {
      const ex = await prisma.capitalizationReport.findFirst({ where: { projectId: opts.proj.id } });
      if (ex) return ex;
      const cap = await createCapitalization(users.plead, {
        projectId: opts.proj.id, condTechnical: true, condIntent: true, condUsability: true,
        condMarket: true, condResource: true,
        evidenceTechnical: 'stress 中试通过', evidenceMarket: 'stress 客户意向',
        evidenceResource: 'stress 资源配置', evidenceCost: 'stress 成本台账',
        capitalizationAmount: 150000,
      });
      await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'capitalization_v1', entityId: cap.id });
      const chain = [
        [users.rddir, R.RD_DIRECTOR],
        [users.tech, R.TECH_COMMITTEE],
        [users.fin, R.FINANCE_LEAD],
        [users.ceo, R.CEO],
      ] as const;
      if (opts.target === 'reviewing') return cap;
      if (opts.target === 'rejected') {
        await rejectStep(users.rddir, R.RD_DIRECTOR, 'capitalization_report', cap.id, 'stress: 资本化时点不符, 驳回');
        return cap;
      }
      for (const [uid, role] of chain) {
        await approveStep(uid, role, 'capitalization_report', cap.id);
      }
      return cap;
    }
    await ensureCap({ proj: pActive1, target: 'approved' });
    await ensureCap({ proj: pActive2, target: 'reviewing' });
    await ensureCap({ proj: pActive3, target: 'rejected' });

    // 结项 (STRESS-CLOSED-01): 走 3 步 → hook 推 closed + 归档
    {
      const ex = await prisma.closingReport.findFirst({ where: { projectId: pClosed.id } });
      if (!ex) {
        const cl = await createClosing(users.plead, {
          projectId: pClosed.id,
          basicSummary: 'stress 结项总结', goalReview: 'stress 目标回顾', outputs: 'stress 成果',
          budgetReview: 'stress 预算回顾', lessons: 'stress 经验', conversionPlan: 'stress 转化计划',
        });
        await submit(jwt(users.plead, R.PROJECT_LEAD), { workflowCode: 'closing_report_v1', entityId: cl.id });
        await approveStep(users.plead, R.PROJECT_LEAD, 'closing_report', cl.id);
        await approveStep(users.rddir, R.RD_DIRECTOR, 'closing_report', cl.id);
        await approveStep(users.tech, R.TECH_COMMITTEE, 'closing_report', cl.id);
        await prisma.closingReport.update({ where: { id: cl.id }, data: { archivedAt: new Date() } });
      }
    }

    // 月度勾稽 (两个月) + 1 异常 → 异常单 (open + resolved)
    for (const m of [twoMonthsAgo, lastMonth]) {
      const existCheck = await prisma.reconciliationCheck.findFirst({ where: { year: m.year, month: m.month } });
      if (existCheck) continue;
      const rows = await runMonthlyReconciliation(m.year, m.month);
      const matOut = rows.find((r) => r.checkType === 'material_output');
      if (matOut) {
        await prisma.reconciliationCheck.update({
          where: { id: matOut.id },
          data: { isException: true, diffRate: 0.06, note: 'stress: 人工标注异常 6%' },
        });
        const exNote = await createExceptionNote(users.fin, {
          reconciliationId: matOut.id,
          reason: 'stress: 出库金额与登记差异 6% > 阈值',
        });
        // lastMonth 的异常单标 resolved
        if (m === lastMonth) {
          await resolveExceptionNote(users.fin, exNote.id, 'stress: 已核实为登记延迟, 已补登');
        }
      }
    }

    // 季度内审 (两季度)
    const curQuarter = Math.floor(now.getMonth() / 3) + 1;
    const lastQ = curQuarter === 1 ? { year: now.getFullYear() - 1, quarter: 4 } : { year: now.getFullYear(), quarter: curQuarter - 1 };
    const prevQ = lastQ.quarter === 1 ? { year: lastQ.year - 1, quarter: 4 } : { year: lastQ.year, quarter: lastQ.quarter - 1 };
    for (const q of [prevQ, lastQ]) {
      const ex = await prisma.quarterlyAudit.findFirst({ where: { year: q.year, quarter: q.quarter } });
      if (ex) continue;
      await createAudit(users.rddir, {
        year: q.year, quarter: q.quarter,
        checkProject: 'stress 抽查', checkBudget: 'stress 预算', checkMaterial: 'stress 物料',
        checkOutsource: 'stress 委外', checkArchive: 'stress 归档',
        compliantProject: true, compliantBudget: true, compliantMaterial: true,
        compliantOutsource: true, compliantArchive: true,
        overallOpinion: 'stress 整体合规',
      });
    }

    // ============ 10. 通知 (已读/未读) ============
    console.log('[10] 通知 (已读未读)...');
    const recipients = [users.plead, users.researcher, users.rddir, users.tech, users.prod, users.fin, users.ceo, users.wh];
    if ((await prisma.notification.count({ where: { message: { startsWith: 'stress:' } } })) === 0) {
      for (const rid of recipients) {
        await prisma.notification.create({ data: { recipientId: rid, eventType: 'system_announce', message: 'stress: 压力测试公告 (未读)' } });
        await prisma.notification.create({ data: { recipientId: rid, eventType: 'system_announce', message: 'stress: 历史公告 (已读)', readAt: new Date(Date.now() - 2 * 86400000) } });
      }
      await prisma.notification.create({ data: { recipientId: users.wh, eventType: 'project_approved', entityType: 'project', entityId: pActive1.id, message: `stress: 项目 ${pActive1.code} 立项通过` } });
    }

    // ============ 汇总 ============
    const stressIds = (
      await prisma.project.findMany({ where: { code: { startsWith: 'STRESS-' } }, select: { id: true } })
    ).map((p) => p.id);
    const inStress = { in: stressIds };
    const counts = {
      projects: stressIds.length,
      workhours: await prisma.workhourEntry.count({ where: { projectId: inStress } }),
      outbounds: await prisma.inventoryOutbound.count({ where: { projectId: inStress } }),
      usage: await prisma.materialUsageLog.count({ where: { projectId: inStress } }),
      samples: await prisma.sampleScrapLog.count({ where: { projectId: inStress } }),
      trialOrders: await prisma.trialProductionOrder.count({ where: { projectId: inStress } }),
      transfers: await prisma.trialCostTransfer.count(),
      contracts: await prisma.outsourceContract.count({ where: { contractNo: { startsWith: 'OS-STRESS-' } } }),
      reports: await prisma.monthlyReport.count({ where: { projectId: inStress } }),
      changes: await prisma.projectChangeRequest.count({ where: { projectId: inStress } }),
      capitalizations: await prisma.capitalizationReport.count({ where: { projectId: inStress } }),
      notifications: await prisma.notification.count({ where: { message: { startsWith: 'stress:' } } }),
    };
    console.log('\n=== 压力 seed 完成 ===');
    console.log(JSON.stringify(counts, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
