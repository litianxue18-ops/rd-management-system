/**
 * 完整业务流 E2E (M1-M6 全链路冒烟):
 *
 * 立项 (跳过 4 步审, 直接 active, 已有 project-approval-flow.test 单测 4 步)
 *   → 工时 (填 + submit + approve)
 *   → 入库 → 申请领料 → 2 步审 → 出库
 *   → 退库 10
 *   → 试制任务 → 2 步审 → 完成
 *   → 试制费用转嫁单 → 4 步审 → settled
 *   → 样品 + 废料 → 财务监销
 *   → 月报 → 3 步审 → approved
 *   → 委外合同 → 4 步审 → active → 付款
 *   → 验项目费用归集 4 项有数 (人工/材料/试制/委外 != null)
 *
 * 仅断言关键 status 变化, 不验金额精确值 (各模块单测已覆盖).
 * 目的: 验全链路 service 互通, 无 schema 兼容性问题.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { hashPassword } from '@/modules/auth/password';
import { seedRoles } from '../../prisma/seeds/roles';
import { seedPermissionMatrix } from '../../prisma/seeds/permission-matrix';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import { _resetRegistry, registerWorkflow } from '@/modules/workflow/registry';
import { submit, approve, listTodo } from '@/modules/workflow/engine';

// services
import { createInbound } from '@/modules/inventory/inbound-service';
import {
  createOutbound,
  issueOutbound,
  setReviewing as obSetReviewing,
  setApproved as obSetApproved,
  setRejected as obSetRejected,
} from '@/modules/inventory/outbound-service';
import { returnOutbound } from '@/modules/inventory/return-service';
import {
  upsertEntry,
  submitWeek,
  approveEntries,
} from '@/modules/workhour/workhour-service';
import {
  createReport,
  markApproved as mrApproved,
  markRejected as mrRejected,
  setReviewing as mrSetReviewing,
} from '@/modules/monthly/monthly-service';
import {
  createTrialOrder,
  completeOrder,
  setReviewing as tpoSetReviewing,
  setApproved as tpoSetApproved,
  setRejected as tpoSetRejected,
} from '@/modules/trial/production-service';
import {
  createTransfer,
  setReviewing as trSetReviewing,
  setApproved as trSetApproved,
  setRejected as trSetRejected,
} from '@/modules/trial/transfer-service';
import { superviseDirectly } from '@/modules/sample/sample-service';
import { createSupplier } from '@/modules/outsource/supplier-service';
import {
  createContract,
  setReviewing as ctSetReviewing,
  setActive as ctSetActive,
  setRejected as ctSetRejected,
} from '@/modules/outsource/contract-service';
import { registerPayment } from '@/modules/outsource/payment-service';

/** 内联注册所有 workflow (跟其它 E2E pattern 一致, 绕开 vitest 模块缓存). */
function registerAllWorkflows() {
  // 领料 (2 步)
  registerWorkflow({
    code: 'material_request_v1',
    entityType: 'material_request',
    steps: [
      {
        name: '项目负责人审核',
        role: R.PROJECT_LEAD,
        resolveAssignee: async (entity, tx) => {
          if (!entity?.projectId) return null;
          const proj = await tx.project.findUnique({ where: { id: entity.projectId } });
          return proj?.leadUserId ?? null;
        },
      },
      { name: '研发中心审批', role: R.RD_DIRECTOR },
    ],
    loadEntity: async (id, tx) => tx.inventoryOutbound.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => obSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => {
        const lastStep = await tx.approvalStep.findFirst({
          where: {
            instance: { entityType: 'material_request', entityId: entity.id },
            status: 'approved',
          },
          orderBy: { stepIndex: 'desc' },
        });
        await obSetApproved(entity.id, tx, lastStep?.actedBy ?? entity.requesterId);
      },
      onRejected: async (entity, comments, tx) => obSetRejected(entity.id, comments, tx),
    },
  });

  // 试制任务 (2 步)
  registerWorkflow({
    code: 'trial_production_v1',
    entityType: 'trial_production_order',
    steps: [
      {
        name: '项目负责人审核',
        role: R.PROJECT_LEAD,
        resolveAssignee: async (entity, tx) => {
          if (!entity?.projectId) return null;
          const proj = await tx.project.findUnique({ where: { id: entity.projectId } });
          return proj?.leadUserId ?? null;
        },
      },
      { name: '生产部接单', role: R.PRODUCTION_LEAD },
    ],
    loadEntity: async (id, tx) => tx.trialProductionOrder.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => tpoSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => {
        const lastStep = await tx.approvalStep.findFirst({
          where: {
            instance: { entityType: 'trial_production_order', entityId: entity.id },
            status: 'approved',
          },
          orderBy: { stepIndex: 'desc' },
        });
        await tpoSetApproved(entity.id, lastStep?.actedBy ?? null, tx);
      },
      onRejected: async (entity, comments, tx) => tpoSetRejected(entity.id, comments, tx),
    },
  });

  // 试制费用转嫁 (4 步)
  registerWorkflow({
    code: 'trial_transfer_v1',
    entityType: 'trial_cost_transfer',
    steps: [
      { name: '生产部确认', role: R.PRODUCTION_LEAD },
      { name: '研发负责人确认', role: R.RD_DIRECTOR },
      { name: '财务部审核', role: R.FINANCE_LEAD },
      { name: '总经理批准', role: R.CEO },
    ],
    loadEntity: async (id, tx) => tx.trialCostTransfer.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => trSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => trSetApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) => trSetRejected(entity.id, comments, tx),
    },
  });

  // 月报 (3 步)
  registerWorkflow({
    code: 'monthly_report_v1',
    entityType: 'monthly_report',
    steps: [
      { name: '财务负责人审核', role: R.FINANCE_LEAD },
      { name: '研发负责人审核', role: R.RD_DIRECTOR },
      { name: '总经理批准',     role: R.CEO },
    ],
    loadEntity: async (id, tx) => tx.monthlyReport.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => mrSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => mrApproved(entity.id, tx),
      onRejected: async (entity, comments, tx) => mrRejected(entity.id, comments, tx),
    },
  });

  // 委外合同 (4 步)
  registerWorkflow({
    code: 'outsource_contract_v1',
    entityType: 'outsource_contract',
    steps: [
      { name: '研发中心审核', role: R.RD_DIRECTOR },
      { name: '技委会评审', role: R.TECH_COMMITTEE },
      { name: '财务部审核', role: R.FINANCE_LEAD },
      { name: '总经理批准', role: R.CEO },
    ],
    loadEntity: async (id, tx) => tx.outsourceContract.findUnique({ where: { id } }),
    hooks: {
      onSubmit: async (entity, tx) => ctSetReviewing(entity.id, tx),
      onApproved: async (entity, tx) => ctSetActive(entity.id, tx),
      onRejected: async (entity, comments, tx) => ctSetRejected(entity.id, comments, tx),
    },
  });
}

beforeEach(async () => {
  _resetRegistry();
  registerAllWorkflows();
  await seedRoles(prisma);
  await seedPermissionMatrix(prisma);
});

describe('完整业务流端到端 (M1-M6 全链路冒烟)', () => {
  it('立项 → 工时 → 领料 → 出库 → 退库 → 试制 → 转嫁 → 样品 → 月报 → 委外 → 费用归集', async () => {
    // ===== 0. 基础数据 =====
    const dept = await prisma.department.create({ data: { code: 'rd', name: '研发' } });
    const typeRow = await prisma.projectType.create({
      data: { code: 'MAT', name: '新材料' },
    });

    async function makeUser(name: string, role: string, hourlyCost?: number) {
      const u = await prisma.user.create({
        data: {
          username: name,
          employeeId: name.toUpperCase(),
          name,
          passwordHash: await hashPassword('p'),
          departmentId: dept.id,
          ...(hourlyCost ? { hourlyCost } : {}),
        },
      });
      const r = await prisma.role.findUniqueOrThrow({ where: { code: role } });
      await prisma.userRole.create({
        data: { userId: u.id, roleId: r.id, isPrimary: true },
      });
      return u.id;
    }

    const leadId = await makeUser('plead', R.PROJECT_LEAD, 150);
    const researcherId = await makeUser('res', R.RESEARCHER, 80);
    const rdDirectorId = await makeUser('rddir', R.RD_DIRECTOR);
    const techId = await makeUser('tech', R.TECH_COMMITTEE);
    const productionLeadId = await makeUser('prod', R.PRODUCTION_LEAD);
    const financeLeadId = await makeUser('fin', R.FINANCE_LEAD);
    const ceoId = await makeUser('ceo', R.CEO);
    const wkId = await makeUser('wk', R.WAREHOUSE_KEEPER);

    const jwt = (id: number, role: string) => ({
      userId: id,
      roles: [role],
      primaryRole: role,
      tokenVersion: 0,
    });

    // ===== 1. 立项 (跳过 4 步审, 直接 active) =====
    const project = await prisma.project.create({
      data: {
        code: 'E2E-FULL-001',
        name: '完整流测试项目',
        projectTypeId: typeRow.id,
        departmentId: dept.id,
        leadUserId: leadId,
        status: 'active',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
        budget: 1000000,
        background: 'x',
        goals: 'x',
        techPlan: 'x',
        schedule: 'x',
        budgetDetail: 'x',
        expectedOutput: 'x',
        createdById: leadId,
        activatedAt: new Date(),
        members: {
          create: [
            { userId: leadId, role: '项目负责人', isLead: true },
            { userId: researcherId, role: '主研' },
          ],
        },
      },
    });
    expect(project.status).toBe('active');

    // ===== 2. 工时 (researcher 填 + submit + lead approve) =====
    const monday = new Date('2026-06-01'); // 周一
    const whIds: number[] = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const e = await upsertEntry(researcherId, {
        projectId: project.id,
        workDate: d,
        hours: 8,
        workContent: `day ${i + 1}`,
      });
      whIds.push(e.id);
    }
    await submitWeek(researcherId, monday);
    await approveEntries(leadId, whIds);
    const approvedWh = await prisma.workhourEntry.findMany({ where: { id: { in: whIds } } });
    expect(approvedWh.every((e) => e.status === 'approved')).toBe(true);

    // ===== 3. 入库 → 申请领料 → 2 步审 → 出库 =====
    const wh = await prisma.warehouse.create({
      data: { code: 'wh-main', name: '主仓' },
    });
    const mat = await prisma.material.create({
      data: { code: 'M-X', name: 'BOPET 切片', unit: 'kg' },
    });
    await createInbound(wkId, {
      materialId: mat.id,
      warehouseId: wh.id,
      quantity: 100,
      unitPrice: 20,
      receivedAt: new Date('2026-06-01'),
    });
    const out = await createOutbound(researcherId, {
      projectId: project.id,
      materialId: mat.id,
      warehouseId: wh.id,
      requestedQty: 30,
      purpose: '中试测试',
    });
    await submit(jwt(researcherId, R.RESEARCHER), {
      workflowCode: 'material_request_v1',
      entityId: out.id,
    });
    // 2 步审
    let todos = await listTodo(jwt(leadId, R.PROJECT_LEAD));
    const obStep1 = todos.find((t) => t.entityType === 'material_request');
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: obStep1!.stepId });
    todos = await listTodo(jwt(rdDirectorId, R.RD_DIRECTOR));
    const obStep2 = todos.find((t) => t.entityType === 'material_request');
    await approve(jwt(rdDirectorId, R.RD_DIRECTOR), { stepId: obStep2!.stepId });
    const issued = await issueOutbound(wkId, out.id, 30);
    expect(issued.status).toBe('issued');

    // ===== 4. 退库 10 =====
    await returnOutbound(wkId, out.id, 10, '用不完');
    const afterReturn = await prisma.inventoryOutbound.findUniqueOrThrow({
      where: { id: out.id },
    });
    expect(Number(afterReturn.returnedQty)).toBe(10);

    // ===== 5. 试制任务 → 2 步审 → 完成 =====
    const order = await createTrialOrder(leadId, {
      projectId: project.id,
      title: '试制 A 样 50 件',
      description: '高温烧结',
      plannedQty: 50,
      plannedUnit: '件',
    });
    await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'trial_production_v1',
      entityId: order.id,
    });
    todos = await listTodo(jwt(leadId, R.PROJECT_LEAD));
    const tpoStep1 = todos.find((t) => t.entityType === 'trial_production_order');
    await approve(jwt(leadId, R.PROJECT_LEAD), { stepId: tpoStep1!.stepId });
    todos = await listTodo(jwt(productionLeadId, R.PRODUCTION_LEAD));
    const tpoStep2 = todos.find((t) => t.entityType === 'trial_production_order');
    await approve(jwt(productionLeadId, R.PRODUCTION_LEAD), { stepId: tpoStep2!.stepId });
    await completeOrder(productionLeadId, order.id, 45, new Date('2026-07-15'));
    const completedOrder = await prisma.trialProductionOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(completedOrder.status).toBe('completed');

    // ===== 6. 试制费用转嫁 → 4 步审 → settled =====
    const transfer = await createTransfer(productionLeadId, {
      trialOrderId: order.id,
      laborCost: 3000,
      machineCost: 1500,
      materialCost: 500,
      description: '试制 A 样转嫁',
    });
    await submit(jwt(productionLeadId, R.PRODUCTION_LEAD), {
      workflowCode: 'trial_transfer_v1',
      entityId: transfer.id,
    });
    // 4 步
    for (const [uid, role] of [
      [productionLeadId, R.PRODUCTION_LEAD],
      [rdDirectorId, R.RD_DIRECTOR],
      [financeLeadId, R.FINANCE_LEAD],
      [ceoId, R.CEO],
    ] as const) {
      const ts = await listTodo(jwt(uid, role));
      const s = ts.find((t) => t.entityType === 'trial_cost_transfer');
      expect(s).toBeDefined();
      await approve(jwt(uid, role), { stepId: s!.stepId });
    }
    const finalTransfer = await prisma.trialCostTransfer.findUniqueOrThrow({
      where: { id: transfer.id },
    });
    expect(finalTransfer.status).toBe('settled');

    // ===== 7. 样品 + 废料 → 财务监销 (1 步 直接 supervise) =====
    const { createSample } = await import('@/modules/sample/sample-service');
    const sample = await createSample(researcherId, {
      projectId: project.id,
      type: 'sample',
      sourceOutboundId: out.id,
      materialId: mat.id,
      warehouseId: wh.id,
      consumedQty: 5,
      productName: '样品 A',
      productQty: 3,
      productUnit: '片',
      disposalMethod: 'retained',
    });
    const scrap = await createSample(researcherId, {
      projectId: project.id,
      type: 'scrap',
      materialId: mat.id,
      warehouseId: wh.id,
      consumedQty: 3,
      disposalMethod: 'destroyed',
    });
    await superviseDirectly(sample.id, financeLeadId);
    await superviseDirectly(scrap.id, financeLeadId);
    const sampleAfter = await prisma.sampleScrapLog.findUniqueOrThrow({
      where: { id: sample.id },
    });
    expect(sampleAfter.status).toBe('supervised');

    // ===== 8. 月报 → 3 步审 → approved =====
    const report = await createReport(leadId, {
      projectId: project.id,
      reportYear: 2026,
      reportMonth: 6,
      monthPlan: '计划',
      actualCompletion: '完成',
      outputs: '样品',
      problems: '无',
      resourceUsage: '正常',
      nextMonthPlan: '继续',
    });
    await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'monthly_report_v1',
      entityId: report.id,
    });
    for (const [uid, role] of [
      [financeLeadId, R.FINANCE_LEAD],
      [rdDirectorId, R.RD_DIRECTOR],
      [ceoId, R.CEO],
    ] as const) {
      const ts = await listTodo(jwt(uid, role));
      const s = ts.find((t) => t.entityType === 'monthly_report');
      expect(s).toBeDefined();
      await approve(jwt(uid, role), { stepId: s!.stepId });
    }
    const reportAfter = await prisma.monthlyReport.findUniqueOrThrow({
      where: { id: report.id },
    });
    expect(reportAfter.status).toBe('approved');

    // ===== 9. 委外合同 → 4 步审 → active → 付款 =====
    const supplier = await createSupplier({
      code: 'SUP-E2E-001',
      name: '测试供应商',
      contactPerson: '联系人',
      contactPhone: '13800000000',
    });
    const contract = await createContract(leadId, {
      contractNo: 'CT-E2E-001',
      projectId: project.id,
      supplierId: supplier.id,
      title: 'E2E 委外',
      scope: '按方案',
      ipOwnership: '我方所有',
      totalAmount: 50000,
      signedDate: new Date('2026-06-01'),
      startDate: new Date('2026-06-05'),
      endDate: new Date('2026-08-30'),
    });
    await submit(jwt(leadId, R.PROJECT_LEAD), {
      workflowCode: 'outsource_contract_v1',
      entityId: contract.id,
    });
    for (const [uid, role] of [
      [rdDirectorId, R.RD_DIRECTOR],
      [techId, R.TECH_COMMITTEE],
      [financeLeadId, R.FINANCE_LEAD],
      [ceoId, R.CEO],
    ] as const) {
      const ts = await listTodo(jwt(uid, role));
      const s = ts.find((t) => t.entityType === 'outsource_contract');
      expect(s).toBeDefined();
      await approve(jwt(uid, role), { stepId: s!.stepId });
    }
    const contractAfter = await prisma.outsourceContract.findUniqueOrThrow({
      where: { id: contract.id },
    });
    expect(contractAfter.status).toBe('active');
    await registerPayment(financeLeadId, {
      contractId: contract.id,
      amount: 50000,
      paidDate: new Date('2026-07-01'),
      installmentNo: 1,
      note: '全款',
    });

    // ===== 10. 验项目费用归集 4 项有数 (无需精确金额, 各模块单测已覆盖) =====
    // 人工费 view
    const laborRows = await prisma.$queryRaw<Array<{ labor_cost: string }>>`
      SELECT COALESCE(SUM(w.hours * u.hourly_cost), 0)::text AS labor_cost
      FROM workhour_entry w
      JOIN "user" u ON u.id = w.user_id
      WHERE w.project_id = ${project.id} AND w.status = 'approved'
    `;
    expect(Number(laborRows[0].labor_cost)).toBeGreaterThan(0);

    // 材料费: 已出库 (含退库扣减) 的领料 * 加权单价 (略简: 验有 outbound)
    const matRows = await prisma.$queryRaw<Array<{ cnt: bigint }>>`
      SELECT COUNT(*)::bigint AS cnt FROM inventory_outbound
      WHERE project_id = ${project.id} AND status IN ('issued', 'returned')
    `;
    expect(Number(matRows[0].cnt)).toBeGreaterThan(0);

    // 试制费: settled 转嫁
    const trialRows = await prisma.$queryRaw<Array<{ total: string }>>`
      SELECT COALESCE(SUM(total_amount), 0)::text AS total
      FROM trial_cost_transfer
      WHERE project_id = ${project.id} AND status = 'settled'
    `;
    expect(Number(trialRows[0].total)).toBe(5000);

    // 委外费: 已付款
    const outsourceRows = await prisma.$queryRaw<Array<{ paid: string }>>`
      SELECT COALESCE(SUM(op.amount), 0)::text AS paid
      FROM outsource_contract oc
      JOIN outsource_payment op ON op.contract_id = oc.id
      WHERE oc.project_id = ${project.id}
    `;
    expect(Number(outsourceRows[0].paid)).toBe(50000);
  }, 60000);
});
