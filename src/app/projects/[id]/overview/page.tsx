import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/shared/prisma';
import {
  getProjectLaborCost,
  getProjectLaborCostBreakdown,
} from '@/modules/workhour/labor-cost';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Boxes,
  ChevronRight,
  ClipboardList,
  Clock,
  Coins,
  Download,
  FileText,
  FlaskConical,
  Info,
  PackageOpen,
  ScrollText,
  Star,
  Truck,
  Users,
  Wallet,
} from 'lucide-react';
import { OverviewSidebar } from './overview-sidebar';
import { TestBadge } from '@/shared/components/test-badge';
import {
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtNum,
  genericStatusBadge,
  projectStatusBadge,
  requirePageAuth,
  SectionTitle,
  StatCell,
} from './overview-shared';

/**
 * 项目执行档案综合页 — 纯概要报告 (server component)。
 *
 * 每个模块只显示总结性概要 (3-5 个关键数字 + 状态), 不列明细;
 * 底部 "查看完整明细 →" 跳转独立详情页 /projects/[id]/detail/[section]。
 *
 * 12 个 section 二级目录:
 *  1. 基本信息  2. 成员  3. 工时  4. 物料  5. 样品/废料
 *  6. 试制      7. 委外  8. 月报  9. 变更  10. 资本化
 *  11. 费用归集 12. 结项档案
 *
 * Demo 目标: DEMO-MAT-2026-001 (id=1) 数据最全。
 */

// ---------- page ----------

export default async function ProjectOverviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id: idStr } = await params;
  const projectId = Number(idStr);
  if (!Number.isFinite(projectId)) notFound();

  // 概要只需要计数 / 汇总, 不 include 全明细
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      projectType: true,
      members: true,
      closingReport: true,
      capitalizationReports: { orderBy: { id: 'desc' }, take: 1 },
    },
  });
  if (!project) notFound();

  const memberUserIds = project.members.map((m) => m.userId);
  const memberUsers = memberUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: memberUserIds } },
        select: { id: true, name: true },
      })
    : [];
  const memberUserMap = new Map(memberUsers.map((u) => [u.id, u]));

  // 并行算各模块的概要数值 (聚合查询, 不拉明细行)
  const [
    labor,
    laborBreakdown,
    materialAgg,
    trialAgg,
    outsourceAgg,
    ledgerCountRow,
    sampleAgg,
    reportAgg,
    changeAgg,
    leadUser,
    projectDept,
  ] = await Promise.all([
    getProjectLaborCost(projectId),
    getProjectLaborCostBreakdown(projectId),
    // 物料: 累计领料 / 已退库 / 净消耗
    prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*)::int AS cnt,
        COALESCE(SUM(o.issued_qty * COALESCE(o.unit_price, 0)), 0)::text AS issued_amount,
        COALESCE(SUM(o.returned_qty * COALESCE(o.unit_price, 0)), 0)::text AS returned_amount,
        COALESCE(SUM((o.issued_qty - o.returned_qty) * COALESCE(o.unit_price, 0)), 0)::text AS net_amount
      FROM inventory_outbound o
      WHERE o.project_id = ${projectId} AND o.status IN ('issued','returned')
    `,
    // 试制: 任务数 / 完成数 / 转嫁费总额
    prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM trial_production_order WHERE project_id = ${projectId})::int AS total_cnt,
        (SELECT COUNT(*) FROM trial_production_order WHERE project_id = ${projectId} AND status = 'completed')::int AS done_cnt,
        (SELECT COALESCE(SUM(total_amount), 0) FROM trial_cost_transfer WHERE project_id = ${projectId} AND status = 'settled')::text AS transfer_total
    `,
    // 委外: 合同数 / 合同总额 / 已付
    prisma.$queryRaw<any[]>`
      SELECT
        (SELECT COUNT(*) FROM outsource_contract
         WHERE project_id = ${projectId} AND status IN ('active','completed'))::int AS cnt,
        (SELECT COALESCE(SUM(total_amount), 0) FROM outsource_contract
         WHERE project_id = ${projectId} AND status IN ('active','completed'))::text AS total_amount,
        (SELECT COALESCE(SUM(op.amount), 0) FROM outsource_payment op
         JOIN outsource_contract c2 ON c2.id = op.contract_id
         WHERE c2.project_id = ${projectId} AND c2.status IN ('active','completed'))::text AS paid_amount
    `,
    prisma.inventoryLedger.count({ where: { projectId } }),
    // 样品/废料: 样品数 / 废料数 / 待监销
    prisma.$queryRaw<any[]>`
      SELECT
        COUNT(*) FILTER (WHERE type = 'sample')::int AS sample_cnt,
        COUNT(*) FILTER (WHERE type = 'scrap')::int AS scrap_cnt,
        COUNT(*) FILTER (WHERE status <> 'supervised')::int AS pending_cnt
      FROM sample_scrap_log
      WHERE project_id = ${projectId}
    `,
    // 月报: 最新一期
    prisma.monthlyReport.findMany({
      where: { projectId },
      orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
      take: 1,
      select: { reportYear: true, reportMonth: true, status: true },
    }),
    // 变更: 最近一次
    prisma.projectChangeRequest.findMany({
      where: { projectId },
      orderBy: { id: 'desc' },
      take: 1,
      select: { status: true },
    }),
    prisma.user.findUnique({
      where: { id: project.leadUserId },
      select: { id: true, name: true, department: { select: { name: true } } },
    }),
    prisma.department.findUnique({
      where: { id: project.departmentId },
      select: { name: true },
    }),
  ]);

  // 聚合数值
  const laborCost = labor?.laborCost ?? 0;
  const totalApprovedHours = labor?.totalHours ?? 0;
  const reviewingAgg = await prisma.workhourEntry.aggregate({
    where: { projectId, status: 'reviewing' },
    _sum: { hours: true },
  });
  const reviewingHours = Number(reviewingAgg._sum.hours ?? 0);

  const materialNet = Number(materialAgg[0]?.net_amount ?? 0);
  const materialIssued = Number(materialAgg[0]?.issued_amount ?? 0);
  const materialReturned = Number(materialAgg[0]?.returned_amount ?? 0);
  const materialCount = Number(materialAgg[0]?.cnt ?? 0);
  const ledgerCount = ledgerCountRow;

  const trialTotalCnt = Number(trialAgg[0]?.total_cnt ?? 0);
  const trialDoneCnt = Number(trialAgg[0]?.done_cnt ?? 0);
  const trialTransferTotal = Number(trialAgg[0]?.transfer_total ?? 0);

  const outsourceCnt = Number(outsourceAgg[0]?.cnt ?? 0);
  const outsourceTotal = Number(outsourceAgg[0]?.total_amount ?? 0);
  const outsourcePaid = Number(outsourceAgg[0]?.paid_amount ?? 0);
  const outsourceRemaining = outsourceTotal - outsourcePaid;

  const sampleCnt = Number(sampleAgg[0]?.sample_cnt ?? 0);
  const scrapCnt = Number(sampleAgg[0]?.scrap_cnt ?? 0);
  const samplePending = Number(sampleAgg[0]?.pending_cnt ?? 0);

  const reportCount = await prisma.monthlyReport.count({ where: { projectId } });
  const latestReport = reportAgg[0] ?? null;
  const changeCount = await prisma.projectChangeRequest.count({ where: { projectId } });
  const latestChange = changeAgg[0] ?? null;

  const usedTotal = laborCost + materialNet + trialTransferTotal + outsourcePaid;
  const budget = Number(project.budget);
  const execRate = budget > 0 ? usedTotal / budget : 0;

  // 进度估算
  const now = Date.now();
  const sTime = new Date(project.startDate).getTime();
  const eTime = new Date(project.endDate).getTime();
  let scheduleProgress = 0;
  if (eTime > sTime) {
    scheduleProgress = Math.max(0, Math.min(1, (now - sTime) / (eTime - sTime)));
  }

  const leadName = leadUser?.name ?? `#${project.leadUserId}`;
  const leadDeptName = leadUser?.department?.name ?? '—';
  const projectDeptName = projectDept?.name ?? `#${project.departmentId}`;

  // 累计工时 (含待审批) — 给成员概要展示总工时
  const totalHoursAll = totalApprovedHours + reviewingHours;

  const capReport = project.capitalizationReports[0] ?? null;
  const base = `/projects/${projectId}`;

  // ============== render ==============

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-3.5rem)]">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/projects" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              返回项目台账
            </Link>
            <ChevronRight size={12} />
            <span>执行档案</span>
          </div>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="min-w-0 flex items-center gap-3 flex-wrap">
              <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
                {project.name}
              </h1>
              <TestBadge show={project.isTest} />
              {projectStatusBadge(project.status)}
              {project.code.startsWith('DRAFT-') ? (
                <span className="text-xs text-muted-foreground">草稿编号待生成</span>
              ) : (
                <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums text-xs">
                  {project.code}
                </code>
              )}
              <span className="text-xs text-muted-foreground">
                · {project.projectType.name} · {projectDeptName}
              </span>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}`}>
                  <FileText size={14} className="mr-1.5" />
                  立项详情
                </Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href={`${base}/cost-summary`}>
                  <Download size={14} className="mr-1.5" />
                  导出 Excel
                </Link>
              </Button>
            </div>
          </div>

          {/* KPI 5 横排 + 进度 */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
            <KpiCell label="人工费" value={fmtMoney(laborCost)} />
            <KpiCell label="物料费" value={fmtMoney(materialNet)} />
            <KpiCell label="试制费" value={fmtMoney(trialTransferTotal)} />
            <KpiCell label="委外费" value={fmtMoney(outsourcePaid)} />
            <KpiCell
              label="进度估算"
              value={`${(scheduleProgress * 100).toFixed(0)}%`}
              note={`执行率 ${(execRate * 100).toFixed(1)}%`}
            />
          </div>
        </div>
      </div>

      {/* main */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-6 md:gap-8">
          <OverviewSidebar />

          <div className="flex-1 min-w-0 space-y-6 max-w-5xl">
            {/* 1. 基本信息 */}
            <section id="basic" className="scroll-mt-40">
              <SectionTitle>1. 基本信息</SectionTitle>
              <SummaryCard
                icon={<Info size={16} />}
                title="立项概要"
                href={`${base}`}
                linkLabel="查看立项详情"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                  <StatCell
                    label="项目编号"
                    value={<span className="text-sm">{project.code}</span>}
                  />
                  <StatCell
                    label="项目类型"
                    value={<span className="text-sm">{project.projectType.name}</span>}
                  />
                  <StatCell
                    label="主导部门"
                    value={<span className="text-sm">{projectDeptName}</span>}
                  />
                  <StatCell
                    label="负责人"
                    value={
                      <span className="text-sm">
                        {leadName}{' '}
                        <span className="text-xs text-muted-foreground font-sans">
                          ({leadDeptName})
                        </span>
                      </span>
                    }
                  />
                  <StatCell label="状态" value={projectStatusBadge(project.status)} />
                  <StatCell
                    label="起止日期"
                    value={
                      <span className="text-xs">
                        {fmtDate(project.startDate)} — {fmtDate(project.endDate)}
                      </span>
                    }
                  />
                  <StatCell label="预算" value={fmtMoney(budget)} tone="blue" />
                  <StatCell
                    label="创建时间"
                    value={<span className="text-xs">{fmtDateTime(project.createdAt)}</span>}
                  />
                </div>
              </SummaryCard>
            </section>

            {/* 2. 项目成员 */}
            <section id="members" className="scroll-mt-40">
              <SectionTitle>2. 项目成员</SectionTitle>
              <SummaryCard
                icon={<Users size={16} />}
                title="成员概要"
                href={`${base}/detail/members`}
                linkLabel="查看成员明细"
              >
                <div className="grid grid-cols-3 gap-x-6 gap-y-4 mb-4">
                  <StatCell label="成员总数" value={`${project.members.length} 人`} />
                  <StatCell
                    label="负责人"
                    value={
                      <span className="inline-flex items-center gap-1 text-sm">
                        <Star size={12} className="fill-blue-600 text-blue-600" />
                        {leadName}
                      </span>
                    }
                  />
                  <StatCell label="累计工时" value={`${fmtNum(totalHoursAll, 1)} h`} tone="blue" />
                </div>
                {project.members.length > 0 && (
                  <div className="flex items-center -space-x-2">
                    {project.members.slice(0, 6).map((m) => {
                      const name = memberUserMap.get(m.userId)?.name ?? `#${m.userId}`;
                      return (
                        <span
                          key={m.userId}
                          title={name}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm font-medium ring-2 ring-white"
                        >
                          {name.charAt(0)}
                        </span>
                      );
                    })}
                    {project.members.length > 6 && (
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-200 text-slate-600 text-xs font-medium ring-2 ring-white tabular-nums">
                        +{project.members.length - 6}
                      </span>
                    )}
                  </div>
                )}
              </SummaryCard>
            </section>

            {/* 3. 工时明细 */}
            <section id="workhour" className="scroll-mt-40">
              <SectionTitle>3. 工时明细</SectionTitle>
              <SummaryCard
                icon={<Clock size={16} />}
                title="工时概要"
                href={`${base}/detail/workhour`}
                linkLabel="查看工时明细"
              >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-4">
                  <StatCell label="总工时" value={`${fmtNum(totalHoursAll, 1)} h`} />
                  <StatCell label="已审批" value={`${fmtNum(totalApprovedHours, 1)} h`} tone="emerald" />
                  <StatCell label="待审批" value={`${fmtNum(reviewingHours, 1)} h`} tone="amber" />
                  <StatCell label="参与人数" value={`${labor?.participantCount ?? 0} 人`} />
                  <StatCell label="工资折算" value={fmtMoney(laborCost)} tone="blue" />
                </div>
              </SummaryCard>
            </section>

            {/* 4. 物料消耗 */}
            <section id="material" className="scroll-mt-40">
              <SectionTitle>4. 物料消耗</SectionTitle>
              <SummaryCard
                icon={<Boxes size={16} />}
                title="物料概要"
                href={`${base}/detail/material`}
                linkLabel="查看物料明细"
              >
                <div className="grid grid-cols-2 md:grid-cols-5 gap-x-6 gap-y-4">
                  <StatCell label="领料单数" value={`${materialCount} 单`} />
                  <StatCell label="累计领料" value={fmtMoney(materialIssued)} />
                  <StatCell label="已退库" value={fmtMoney(materialReturned)} tone="amber" />
                  <StatCell label="净消耗" value={fmtMoney(materialNet)} tone="blue" />
                  <StatCell label="账本流水" value={`${ledgerCount} 笔`} />
                </div>
              </SummaryCard>
            </section>

            {/* 5. 样品 / 废料 */}
            <section id="sample" className="scroll-mt-40">
              <SectionTitle>5. 样品 / 废料</SectionTitle>
              <SummaryCard
                icon={<PackageOpen size={16} />}
                title="样品台账概要"
                href={`${base}/detail/samples`}
                linkLabel="查看样品台账"
              >
                <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                  <StatCell label="样品登记" value={`${sampleCnt} 条`} />
                  <StatCell label="废料登记" value={`${scrapCnt} 条`} />
                  <StatCell label="待监销" value={`${samplePending} 条`} tone="amber" />
                </div>
              </SummaryCard>
            </section>

            {/* 6. 试制任务 */}
            <section id="trial" className="scroll-mt-40">
              <SectionTitle>6. 试制任务</SectionTitle>
              <SummaryCard
                icon={<FlaskConical size={16} />}
                title="试制概要"
                href={`${base}/detail/trial`}
                linkLabel="查看试制明细"
              >
                <div className="grid grid-cols-3 gap-x-6 gap-y-4">
                  <StatCell label="试制任务" value={`${trialTotalCnt} 个`} />
                  <StatCell label="已完成" value={`${trialDoneCnt} 个`} tone="emerald" />
                  <StatCell label="转嫁费总额" value={fmtMoney(trialTransferTotal)} tone="blue" />
                </div>
              </SummaryCard>
            </section>

            {/* 7. 委外 */}
            <section id="outsource" className="scroll-mt-40">
              <SectionTitle>7. 委外合同</SectionTitle>
              <SummaryCard
                icon={<Truck size={16} />}
                title="委外概要"
                href={`${base}/detail/outsource`}
                linkLabel="查看委外明细"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
                  <StatCell label="合同数" value={`${outsourceCnt} 份`} />
                  <StatCell label="合同总额" value={fmtMoney(outsourceTotal)} />
                  <StatCell label="已付" value={fmtMoney(outsourcePaid)} tone="emerald" />
                  <StatCell label="待付" value={fmtMoney(outsourceRemaining)} tone="amber" />
                </div>
              </SummaryCard>
            </section>

            {/* 8. 月度报告 */}
            <section id="monthly" className="scroll-mt-40">
              <SectionTitle>8. 月度报告</SectionTitle>
              <SummaryCard
                icon={<ScrollText size={16} />}
                title="月报概要"
                href={`${base}/detail/monthly`}
                linkLabel="查看月报明细"
              >
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                  <StatCell label="已交期数" value={`${reportCount} 期`} />
                  <StatCell
                    label="最新一期"
                    value={
                      latestReport ? (
                        <span className="text-sm">
                          {latestReport.reportYear}-
                          {String(latestReport.reportMonth).padStart(2, '0')}
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )
                    }
                  />
                  <StatCell
                    label="最新状态"
                    value={
                      latestReport ? (
                        genericStatusBadge(latestReport.status)
                      ) : (
                        <span className="text-sm text-muted-foreground">尚无月报</span>
                      )
                    }
                  />
                </div>
              </SummaryCard>
            </section>

            {/* 9. 项目变更 */}
            <section id="changes" className="scroll-mt-40">
              <SectionTitle>9. 项目变更</SectionTitle>
              <SummaryCard
                icon={<ClipboardList size={16} />}
                title="变更概要"
                href={`${base}/detail/changes`}
                linkLabel="查看变更明细"
              >
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <StatCell label="变更次数" value={`${changeCount} 次`} />
                  <StatCell
                    label="最近一次状态"
                    value={
                      latestChange ? (
                        projectStatusBadge(latestChange.status)
                      ) : (
                        <span className="text-sm text-muted-foreground">尚无变更</span>
                      )
                    }
                  />
                </div>
              </SummaryCard>
            </section>

            {/* 10. 资本化 */}
            <section id="capitalization" className="scroll-mt-40">
              <SectionTitle>10. 资本化评估</SectionTitle>
              <SummaryCard
                icon={<Coins size={16} />}
                title="资本化概要"
                href={`${base}/detail/capitalization`}
                linkLabel="查看资本化"
              >
                {capReport ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <StatCell label="单号" value={<span className="text-xs">{capReport.docNo}</span>} />
                    <StatCell label="状态" value={genericStatusBadge(capReport.status)} />
                    <StatCell
                      label="资本化金额"
                      value={fmtMoney(Number(capReport.capitalizationAmount))}
                      tone="blue"
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">尚未发起资本化评估</div>
                )}
              </SummaryCard>
            </section>

            {/* 11. 费用归集 */}
            <section id="cost" className="scroll-mt-40">
              <SectionTitle>11. 费用归集 (按月)</SectionTitle>
              <SummaryCard
                icon={<Wallet size={16} />}
                title="费用归集概要"
                href={`${base}/cost-summary`}
                linkLabel="查看费用归集"
              >
                <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4 mb-4">
                  <StatCell label="人工费" value={fmtMoney(laborCost)} />
                  <StatCell label="物料费" value={fmtMoney(materialNet)} />
                  <StatCell label="试制费" value={fmtMoney(trialTransferTotal)} />
                  <StatCell label="委外费" value={fmtMoney(outsourcePaid)} />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-2 mb-3">
                  <StatCell label="累计已使用" value={fmtMoney(usedTotal)} tone="blue" />
                  <StatCell label="项目预算" value={fmtMoney(budget)} />
                  <StatCell
                    label="执行率"
                    value={`${(execRate * 100).toFixed(1)}%`}
                    tone={execRate > 1 ? 'amber' : 'default'}
                  />
                </div>
                <div className="w-full h-3 bg-slate-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${execRate > 1 ? 'bg-rose-500' : execRate > 0.85 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(execRate * 100, 100)}%` }}
                  />
                </div>
              </SummaryCard>
            </section>

            {/* 12. 结项档案 */}
            <section id="closing" className="scroll-mt-40">
              <SectionTitle>12. 结项档案</SectionTitle>
              <SummaryCard
                icon={<FileText size={16} />}
                title="结项概要"
                href={`${base}/detail/closing`}
                linkLabel="查看结项档案"
              >
                {project.closingReport ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
                    <StatCell label="状态" value={genericStatusBadge(project.closingReport.status)} />
                    <StatCell
                      label="单号"
                      value={<span className="text-xs">{project.closingReport.docNo}</span>}
                    />
                    <StatCell
                      label="归档时间"
                      value={
                        <span className="text-xs">
                          {project.closingReport.archivedAt
                            ? fmtDate(project.closingReport.archivedAt)
                            : '未归档'}
                        </span>
                      }
                    />
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">项目尚未结项</div>
                )}
              </SummaryCard>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- 概要卡 ----------

function SummaryCard({
  icon,
  title,
  href,
  linkLabel,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  linkLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="border-slate-300 shadow-md rounded-xl">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2 text-slate-700 text-sm font-medium">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-700">
            {icon}
          </span>
          {title}
        </div>
      </CardHeader>
      <CardContent className="pt-0">{children}</CardContent>
      <CardFooter className="pt-0 justify-end">
        <Button variant="ghost" size="sm" asChild className="text-blue-700 hover:text-blue-800">
          <Link href={href}>
            {linkLabel}
            <ChevronRight size={14} className="ml-0.5" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

function KpiCell({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="bg-slate-50 border border-slate-200 rounded px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-mono tabular-nums text-lg font-semibold text-slate-900">{value}</div>
      {note && <div className="text-[10px] text-muted-foreground tabular-nums">{note}</div>}
    </div>
  );
}
