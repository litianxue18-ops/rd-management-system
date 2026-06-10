import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/shared/prisma';
import { getProjectLaborCostBreakdown } from '@/modules/workhour/labor-cost';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ChevronRight, Download, Star } from 'lucide-react';
import {
  DISPOSAL_LABEL,
  fmtDate,
  fmtDateTime,
  fmtMoney,
  fmtNum,
  genericStatusBadge,
  LEDGER_TYPE_LABEL,
  LongField,
  projectStatusBadge,
  requirePageAuth,
} from '../../overview/overview-shared';

/**
 * 项目执行档案 — section 详情页 (server component)。
 *
 * 把原 overview 里的全明细渲染搬到二级页, 按 section param 切换。
 * 处理 9 个: members/workhour/material/samples/trial/outsource/monthly/changes/capitalization/closing。
 * basic → /projects/[id]; cost → /projects/[id]/cost-summary (不在此路由)。
 * 非法 section → notFound()。
 */

const MONTHLY_STD = 174; // 21.75 工作日 × 8 h

/**
 * ledger 流水按 sourceType 溯源到源单页。返回 null 时不显示链接, 只显示来源文字。
 * sourceType 枚举: inbound / outbound / return / sample_scrap_log / init / adjust
 * 注意: return 的 sourceId 是退库记录 id, 需外部传入其关联 outboundId。
 */
function ledgerSourceHref(
  sourceType: string,
  sourceId: number,
  returnOutboundMap?: Map<number, number>,
): string | null {
  switch (sourceType) {
    case 'outbound':
      return `/material/outbound/${sourceId}`;
    case 'inbound':
      return `/inventory/inbound`; // 无单条页, 跳列表
    case 'return': {
      const outboundId = returnOutboundMap?.get(sourceId);
      return outboundId ? `/material/outbound/${outboundId}` : null;
    }
    case 'sample_scrap_log':
      return `/samples/${sourceId}`;
    default:
      return null; // init / adjust 等无源单
  }
}

/** 表格末列统一 "详情 →" 入口 (ghost button + ChevronRight)。href 为空时占位。 */
function DetailLinkCell({ href }: { href: string | null }) {
  return (
    <TableCell className="text-right py-1.5 w-16">
      {href ? (
        <Button
          variant="ghost"
          size="sm"
          asChild
          className="h-7 px-2 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
        >
          <Link href={href}>
            详情 <ChevronRight size={14} className="ml-0.5" />
          </Link>
        </Button>
      ) : (
        <span className="text-xs text-muted-foreground pr-2">—</span>
      )}
    </TableCell>
  );
}

const SECTION_TITLE: Record<string, string> = {
  members: '项目成员明细',
  workhour: '工时明细',
  material: '物料消耗明细',
  samples: '样品 / 废料台账',
  trial: '试制任务明细',
  outsource: '委外合同明细',
  monthly: '月度报告明细',
  changes: '项目变更历史',
  capitalization: '资本化评估',
  closing: '结项档案',
};

const VALID_SECTIONS = Object.keys(SECTION_TITLE);

export default async function ProjectDetailSectionPage({
  params,
}: {
  params: Promise<{ id: string; section: string }>;
}) {
  await requirePageAuth();
  const { id: idStr, section } = await params;
  const projectId = Number(idStr);
  if (!Number.isFinite(projectId)) notFound();
  if (!VALID_SECTIONS.includes(section)) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, code: true, name: true, status: true },
  });
  if (!project) notFound();

  const body = await renderSection(section, projectId, project.status);

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-3.5rem)]">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href={`/projects/${projectId}/overview`}
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              返回项目报告
            </Link>
            <ChevronRight size={12} />
            <span>{SECTION_TITLE[section]}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
              {SECTION_TITLE[section]}
            </h1>
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums text-xs">
              {project.code}
            </code>
            <span className="text-sm text-muted-foreground">· {project.name}</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6">{body}</div>
    </div>
  );
}

// ---------- per-section renderers ----------

async function renderSection(section: string, projectId: number, projectStatus: string) {
  switch (section) {
    case 'members':
      return renderMembers(projectId);
    case 'workhour':
      return renderWorkhour(projectId);
    case 'material':
      return renderMaterial(projectId);
    case 'samples':
      return renderSamples(projectId);
    case 'trial':
      return renderTrial(projectId);
    case 'outsource':
      return renderOutsource(projectId);
    case 'monthly':
      return renderMonthly(projectId);
    case 'changes':
      return renderChanges(projectId);
    case 'capitalization':
      return renderCapitalization(projectId);
    case 'closing':
      return renderClosing(projectId, projectStatus);
    default:
      notFound();
  }
}

// ----- 成员 -----

async function renderMembers(projectId: number) {
  const [members, breakdown] = await Promise.all([
    prisma.projectMember.findMany({ where: { projectId } }),
    getProjectLaborCostBreakdown(projectId),
  ]);
  const userIds = members.map((m) => m.userId);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        include: { department: { select: { name: true } } },
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u]));
  const breakdownByUser = new Map(breakdown.map((b) => [b.userId, b]));

  if (members.length === 0) {
    return <EmptyCard text="暂无成员" />;
  }

  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>姓名</TableHead>
              <TableHead>部门</TableHead>
              <TableHead>角色</TableHead>
              <TableHead className="text-right">累计工时</TableHead>
              <TableHead className="text-right">工资折算</TableHead>
              <TableHead className="text-right w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((m) => {
              const u = userMap.get(m.userId);
              const b = breakdownByUser.get(m.userId);
              const name = u?.name ?? `#${m.userId}`;
              return (
                <TableRow key={m.userId} className="h-10 hover:bg-blue-50/50">
                  <TableCell className="font-medium py-2">
                    <span className="inline-flex items-center gap-1.5">
                      {name}
                      {m.isLead && (
                        <Badge
                          variant="outline"
                          className="text-blue-800 border-blue-300 bg-blue-100 font-normal text-[10px] gap-0.5"
                        >
                          <Star size={10} className="fill-blue-700 text-blue-700" />
                          负责人
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell className="py-2 text-xs text-muted-foreground">
                    {u?.department?.name ?? '—'}
                  </TableCell>
                  <TableCell className="py-2 text-xs">{m.role}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-2">
                    {fmtNum(b?.hours ?? 0, 1)} h
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums font-medium py-2 text-blue-700">
                    {fmtMoney(b?.subCost ?? 0)}
                  </TableCell>
                  <DetailLinkCell
                    href={`/projects/${projectId}/detail/workhour/${m.userId}`}
                  />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ----- 工时 -----

async function renderWorkhour(projectId: number) {
  const breakdown = await getProjectLaborCostBreakdown(projectId);
  if (breakdown.length === 0) {
    return <EmptyCard text="暂无已批准工时" />;
  }
  return (
    <>
      <Card className="border-slate-300 shadow-md">
        <CardContent className="px-0 pb-0">
          <Table>
            <TableHeader>
              <TableRow className="h-10">
                <TableHead>姓名</TableHead>
                <TableHead>工号</TableHead>
                <TableHead className="text-right">累计工时</TableHead>
                <TableHead className="text-right">小时成本</TableHead>
                <TableHead className="text-right">工资折算</TableHead>
                <TableHead className="text-right">占月度标准</TableHead>
                <TableHead className="text-right w-16"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {breakdown.map((r) => {
                const pct = (r.hours / MONTHLY_STD) * 100;
                const isLow = pct < 50;
                return (
                  <TableRow key={r.userId} className="h-10 hover:bg-blue-50/50">
                    <TableCell className="font-medium py-2">{r.userName}</TableCell>
                    <TableCell className="font-mono tabular-nums text-xs text-muted-foreground py-2">
                      {r.employeeId}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums py-2">
                      {fmtNum(r.hours, 1)}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums py-2">
                      {r.hourlyCost > 0 ? (
                        fmtMoney(r.hourlyCost)
                      ) : (
                        <span className="text-rose-600 text-xs">未设</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-medium py-2 text-blue-700">
                      {fmtMoney(r.subCost)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tabular-nums py-2 ${isLow ? 'text-rose-600 font-medium' : 'text-slate-600'}`}
                    >
                      {pct.toFixed(0)}%{isLow && <span className="ml-1 text-[10px]">⚠</span>}
                    </TableCell>
                    <DetailLinkCell
                      href={`/projects/${projectId}/detail/workhour/${r.userId}`}
                    />
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <div className="text-xs text-muted-foreground mt-2">
        提示: 月度标准 174 h (21.75 工作日 × 8 h). 占比 &lt;50% 标红, 财务复核重点.
      </div>
    </>
  );
}

// ----- 物料 -----

async function renderMaterial(projectId: number) {
  const [outbounds, ledgerRows] = await Promise.all([
    prisma.inventoryOutbound.findMany({
      where: { projectId },
      include: { material: { select: { code: true, name: true, unit: true } } },
      orderBy: { id: 'desc' },
    }),
    prisma.inventoryLedger.findMany({
      where: { projectId },
      include: { material: { select: { code: true, name: true, unit: true } } },
      orderBy: { id: 'desc' },
    }),
  ]);

  // ledger 中 return 类型的 sourceId 是退库记录 id, 解析其关联领料单以便溯源
  const returnIds = ledgerRows
    .filter((l) => l.sourceType === 'return')
    .map((l) => l.sourceId);
  const returnRecords = returnIds.length
    ? await prisma.inventoryReturn.findMany({
        where: { id: { in: returnIds } },
        select: { id: true, outboundId: true },
      })
    : [];
  const returnOutboundMap = new Map(returnRecords.map((r) => [r.id, r.outboundId]));

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">领料单</div>
        {outbounds.length === 0 ? (
          <EmptyCard text="暂无领料" />
        ) : (
          <Card className="border-slate-300 shadow-md">
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead>单号</TableHead>
                    <TableHead>物料</TableHead>
                    <TableHead className="text-right">申请</TableHead>
                    <TableHead className="text-right">已出</TableHead>
                    <TableHead className="text-right">已退</TableHead>
                    <TableHead className="text-right">净消耗</TableHead>
                    <TableHead className="text-right">单价</TableHead>
                    <TableHead className="text-right">金额</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {outbounds.map((o) => {
                    const net = Number(o.issuedQty) - Number(o.returnedQty);
                    const amount = net * Number(o.unitPrice ?? 0);
                    return (
                      <TableRow key={o.id} className="h-10 hover:bg-blue-50/50">
                        <TableCell className="font-mono tabular-nums text-xs py-2">
                          {o.docNo}
                        </TableCell>
                        <TableCell className="py-2">
                          <div className="text-xs font-medium">{o.material.name}</div>
                          <code className="text-[10px] text-muted-foreground tabular-nums">
                            {o.material.code}
                          </code>
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs py-2">
                          {fmtNum(Number(o.requestedQty), 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs py-2">
                          {fmtNum(Number(o.issuedQty), 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs py-2 text-amber-700">
                          {fmtNum(Number(o.returnedQty), 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums py-2">
                          {fmtNum(net, 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs py-2">
                          {Number(o.unitPrice ?? 0) > 0 ? fmtMoney(Number(o.unitPrice)) : '—'}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-medium py-2 text-blue-700">
                          {fmtMoney(amount)}
                        </TableCell>
                        <TableCell className="py-2">{genericStatusBadge(o.status)}</TableCell>
                        <DetailLinkCell href={`/material/outbound/${o.id}`} />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>

      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">库存账本流水</div>
        {ledgerRows.length === 0 ? (
          <EmptyCard text="暂无账本流水" />
        ) : (
          <Card className="border-slate-300 shadow-sm">
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead>发生时间</TableHead>
                    <TableHead>物料</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead className="text-right">变动量</TableHead>
                    <TableHead className="text-right">余额</TableHead>
                    <TableHead className="text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledgerRows.map((l) => {
                    const qty = Number(l.changeQty);
                    const href = ledgerSourceHref(l.sourceType, l.sourceId, returnOutboundMap);
                    return (
                      <TableRow key={l.id} className="h-9 hover:bg-blue-50/50">
                        <TableCell className="font-mono tabular-nums text-xs py-1.5">
                          {fmtDateTime(l.occurredAt)}
                        </TableCell>
                        <TableCell className="py-1.5 text-xs">
                          {l.material.name}{' '}
                          <code className="text-[10px] text-muted-foreground">{l.material.code}</code>
                        </TableCell>
                        <TableCell className="py-1.5 text-xs">
                          {LEDGER_TYPE_LABEL[l.changeType] ?? l.changeType}
                        </TableCell>
                        <TableCell
                          className={`text-right font-mono tabular-nums text-xs py-1.5 ${qty >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
                        >
                          {qty >= 0 ? '+' : ''}
                          {fmtNum(qty, 2)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-xs py-1.5">
                          {fmtNum(Number(l.balanceAfter), 2)}
                        </TableCell>
                        <DetailLinkCell href={href} />
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </div>
      <div className="text-xs text-muted-foreground">
        — 系统暂未启用月底物料盘点功能 (后续 D+ 期上线).
      </div>
    </div>
  );
}

// ----- 样品 / 废料 -----

async function renderSamples(projectId: number) {
  const sampleLogs = await prisma.sampleScrapLog.findMany({
    where: { projectId },
    include: { material: { select: { code: true, name: true, unit: true } } },
    orderBy: { id: 'desc' },
  });
  if (sampleLogs.length === 0) {
    return <EmptyCard text="暂无样品/废料登记" />;
  }
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>单号</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>原料</TableHead>
              <TableHead className="text-right">消耗量</TableHead>
              <TableHead>产出</TableHead>
              <TableHead>处置</TableHead>
              <TableHead>监销人</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sampleLogs.map((s) => (
              <TableRow key={s.id} className="h-10 hover:bg-blue-50/50">
                <TableCell className="font-mono tabular-nums text-xs py-2">{s.docNo}</TableCell>
                <TableCell className="py-2">
                  {s.type === 'sample' ? (
                    <Badge
                      variant="outline"
                      className="bg-blue-100 text-blue-800 border-blue-300 font-normal text-[10px]"
                    >
                      样品
                    </Badge>
                  ) : (
                    <Badge
                      variant="outline"
                      className="bg-rose-100 text-rose-800 border-rose-300 font-normal text-[10px]"
                    >
                      废料
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  {s.material.name}
                  <div className="text-[10px] text-muted-foreground">{s.material.code}</div>
                </TableCell>
                <TableCell className="text-right font-mono tabular-nums py-2 text-xs">
                  {fmtNum(Number(s.consumedQty), 2)} {s.material.unit}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  {s.productName ? (
                    <>
                      {s.productName}{' '}
                      <span className="text-muted-foreground">
                        ({fmtNum(Number(s.productQty ?? 0), 2)} {s.productUnit ?? ''})
                      </span>
                    </>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell className="py-2 text-xs">
                  {DISPOSAL_LABEL[s.disposalMethod] ?? s.disposalMethod}
                </TableCell>
                <TableCell className="py-2 text-xs text-muted-foreground">
                  {s.supervisedById ? `#${s.supervisedById}` : '—'}
                </TableCell>
                <TableCell className="py-2">{genericStatusBadge(s.status)}</TableCell>
                <DetailLinkCell href={`/samples/${s.id}`} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ----- 试制 -----

async function renderTrial(projectId: number) {
  const [trialOrders, trialRows] = await Promise.all([
    prisma.trialProductionOrder.findMany({
      where: { projectId },
      include: { transfers: { orderBy: { id: 'desc' } } },
      orderBy: { id: 'desc' },
    }),
    prisma.$queryRaw<any[]>`
      SELECT
        t.id, t.doc_no,
        t.labor_cost::text AS labor_cost,
        t.machine_cost::text AS machine_cost,
        t.material_cost::text AS material_cost,
        t.total_amount::text AS total_amount,
        tpo.title AS order_title, tpo.doc_no AS order_doc_no
      FROM trial_cost_transfer t
      JOIN trial_production_order tpo ON tpo.id = t.trial_order_id
      WHERE t.project_id = ${projectId} AND t.status = 'settled'
      ORDER BY t.id DESC
    `,
  ]);

  if (trialOrders.length === 0) {
    return <EmptyCard text="暂无试制任务" />;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-sm font-medium text-slate-700 mb-2">试制任务</div>
        <Card className="border-slate-300 shadow-md">
          <CardContent className="px-0 pb-0">
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>单号</TableHead>
                  <TableHead>标题</TableHead>
                  <TableHead className="text-right">计划数量</TableHead>
                  <TableHead className="text-right">实际数量</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">转嫁单数</TableHead>
                  <TableHead className="text-right w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trialOrders.map((t) => (
                  <TableRow key={t.id} className="h-10 hover:bg-blue-50/50">
                    <TableCell className="font-mono tabular-nums text-xs py-2">{t.docNo}</TableCell>
                    <TableCell className="py-2 text-xs font-medium">{t.title}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums py-2 text-xs">
                      {fmtNum(Number(t.plannedQty), 2)} {t.plannedUnit}
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums py-2 text-xs">
                      {t.actualQty != null ? fmtNum(Number(t.actualQty), 2) : '—'}
                    </TableCell>
                    <TableCell className="py-2">{genericStatusBadge(t.status)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums py-2 text-xs">
                      {t.transfers.length}
                    </TableCell>
                    <DetailLinkCell href={`/trial/orders/${t.id}`} />
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {trialRows.length > 0 && (
        <div>
          <div className="text-sm font-medium text-slate-700 mb-2">已结转的试制转嫁单</div>
          <Card className="border-slate-300 shadow-sm">
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="h-9">
                    <TableHead>转嫁单号</TableHead>
                    <TableHead>试制任务</TableHead>
                    <TableHead className="text-right">人工</TableHead>
                    <TableHead className="text-right">机台</TableHead>
                    <TableHead className="text-right">材料</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                    <TableHead className="text-right w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trialRows.map((t) => (
                    <TableRow key={t.id} className="h-9 hover:bg-blue-50/50">
                      <TableCell className="font-mono tabular-nums text-xs py-1.5">
                        {t.doc_no}
                      </TableCell>
                      <TableCell className="py-1.5 text-xs">
                        {t.order_title}{' '}
                        <code className="text-[10px] text-muted-foreground">{t.order_doc_no}</code>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs py-1.5">
                        {fmtNum(Number(t.labor_cost ?? 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs py-1.5">
                        {fmtNum(Number(t.machine_cost ?? 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs py-1.5">
                        {fmtNum(Number(t.material_cost ?? 0))}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium py-1.5 text-blue-700">
                        {fmtMoney(Number(t.total_amount ?? 0))}
                      </TableCell>
                      <DetailLinkCell href={`/trial/transfers/${t.id}`} />
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

// ----- 委外 -----

async function renderOutsource(projectId: number) {
  const contracts = await prisma.outsourceContract.findMany({
    where: { projectId },
    include: { supplier: true, payments: { orderBy: { paidDate: 'desc' } } },
    orderBy: { id: 'desc' },
  });
  if (contracts.length === 0) {
    return <EmptyCard text="暂无委外合同" />;
  }
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>合同号</TableHead>
              <TableHead>供应商</TableHead>
              <TableHead>标题</TableHead>
              <TableHead className="text-right">合同总额</TableHead>
              <TableHead className="text-right">已付</TableHead>
              <TableHead>付款进度</TableHead>
              <TableHead>状态</TableHead>
              <TableHead className="text-right w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.map((c) => {
              const total = Number(c.totalAmount);
              const paid = c.payments.reduce((a, p) => a + Number(p.amount), 0);
              const pct = total > 0 ? paid / total : 0;
              return (
                <TableRow key={c.id} className="h-10 hover:bg-blue-50/50">
                  <TableCell className="font-mono tabular-nums text-xs py-2">
                    {c.contractNo}
                  </TableCell>
                  <TableCell className="py-2 text-xs">
                    {c.supplier.name}
                    <div className="text-[10px] text-muted-foreground">{c.supplier.code}</div>
                  </TableCell>
                  <TableCell className="py-2 text-xs">{c.title}</TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-2 text-xs">
                    {fmtMoney(total)}
                  </TableCell>
                  <TableCell className="text-right font-mono tabular-nums py-2 text-xs font-medium text-emerald-700">
                    {fmtMoney(paid)}
                  </TableCell>
                  <TableCell className="py-2 w-32">
                    <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-emerald-500"
                        style={{ width: `${Math.min(pct * 100, 100)}%` }}
                      />
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums mt-0.5">
                      {(pct * 100).toFixed(1)}%
                    </div>
                  </TableCell>
                  <TableCell className="py-2">{genericStatusBadge(c.status)}</TableCell>
                  <DetailLinkCell href={`/outsource/contracts/${c.id}`} />
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ----- 月报 -----

async function renderMonthly(projectId: number) {
  const reports = await prisma.monthlyReport.findMany({
    where: { projectId },
    orderBy: [{ reportYear: 'desc' }, { reportMonth: 'desc' }],
  });
  if (reports.length === 0) {
    return <EmptyCard text="暂无月度报告" />;
  }
  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <Card key={r.id} className="border-slate-300 shadow-sm">
          <CardContent className="py-4">
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <Badge
                variant="outline"
                className="font-mono tabular-nums bg-slate-100 text-slate-800 border-slate-300"
              >
                {r.reportYear}-{String(r.reportMonth).padStart(2, '0')}
              </Badge>
              {genericStatusBadge(r.status)}
              <span className="text-xs text-muted-foreground">创建于 {fmtDate(r.createdAt)}</span>
              <Button
                variant="ghost"
                size="sm"
                asChild
                className="h-7 px-2 ml-auto text-blue-700 hover:text-blue-800 hover:bg-blue-100"
              >
                <Link href={`/monthly/${r.id}`}>
                  详情 <ChevronRight size={14} className="ml-0.5" />
                </Link>
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <LongField label="月度计划" text={r.monthPlan} />
              <LongField label="实际完成" text={r.actualCompletion} />
              <LongField label="成果输出" text={r.outputs} />
              <LongField label="问题与解决" text={r.problems} />
              <LongField label="资源投入" text={r.resourceUsage} />
              <LongField label="下月计划" text={r.nextMonthPlan} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ----- 变更 -----

async function renderChanges(projectId: number) {
  const changes = await prisma.projectChangeRequest.findMany({
    where: { projectId },
    orderBy: { id: 'desc' },
  });
  if (changes.length === 0) {
    return <EmptyCard text="暂无变更申请" />;
  }
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="px-0 pb-0">
        <Table>
          <TableHeader>
            <TableRow className="h-10">
              <TableHead>变更原因</TableHead>
              <TableHead>影响范围</TableHead>
              <TableHead className="text-right">新预算</TableHead>
              <TableHead>新结束日期</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>套用时间</TableHead>
              <TableHead className="text-right w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {changes.map((c) => (
              <TableRow key={c.id} className="h-10 hover:bg-blue-50/50">
                <TableCell className="py-2 text-xs max-w-[220px] truncate">{c.reason}</TableCell>
                <TableCell className="py-2 text-xs max-w-[220px] truncate">{c.scope}</TableCell>
                <TableCell className="text-right font-mono tabular-nums text-xs py-2">
                  {c.newBudget != null ? fmtMoney(Number(c.newBudget)) : '—'}
                </TableCell>
                <TableCell className="font-mono tabular-nums text-xs py-2">
                  {c.newEndDate ? fmtDate(c.newEndDate) : '—'}
                </TableCell>
                <TableCell className="py-2">{projectStatusBadge(c.status)}</TableCell>
                <TableCell className="font-mono tabular-nums text-xs py-2 text-muted-foreground">
                  {c.appliedAt ? fmtDateTime(c.appliedAt) : '—'}
                </TableCell>
                <DetailLinkCell href={`/projects/${projectId}/changes/${c.id}`} />
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ----- 资本化 -----

async function renderCapitalization(projectId: number) {
  const capReport = await prisma.capitalizationReport.findFirst({
    where: { projectId },
    orderBy: { id: 'desc' },
  });
  if (!capReport) {
    return (
      <Card className="border-slate-300 shadow-md">
        <CardContent className="text-center py-8">
          <div className="text-sm text-muted-foreground mb-3">尚未发起资本化评估</div>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/capitalization/new?projectId=${projectId}`}>发起资本化评估</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }
  const conds = [
    { key: 'condTechnical', label: '技术可行', val: capReport.condTechnical },
    { key: 'condIntent', label: '完成意图明确', val: capReport.condIntent },
    { key: 'condUsability', label: '可用性 / 经济利益', val: capReport.condUsability },
    { key: 'condMarket', label: '市场价值', val: capReport.condMarket },
    { key: 'condResource', label: '资源保障', val: capReport.condResource },
  ];
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
          <div className="flex items-center gap-3">
            <code className="font-mono tabular-nums text-xs bg-slate-100 px-1.5 py-0.5 rounded">
              {capReport.docNo}
            </code>
            {genericStatusBadge(capReport.status)}
            <span className="text-xs text-muted-foreground">
              创建于 {fmtDate(capReport.createdAt)}
            </span>
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="h-7 px-2 text-blue-700 hover:text-blue-800 hover:bg-blue-100"
            >
              <Link href={`/capitalization/${capReport.id}`}>
                详情 <ChevronRight size={14} className="ml-0.5" />
              </Link>
            </Button>
          </div>
          <div>
            <span className="text-xs text-muted-foreground">资本化金额: </span>
            <span className="font-mono tabular-nums text-lg font-semibold text-blue-700">
              {fmtMoney(Number(capReport.capitalizationAmount))}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {conds.map((c) => (
            <div
              key={c.key}
              className={`flex items-center gap-2 px-3 py-2 rounded border ${c.val ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
            >
              <span
                className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold shrink-0 ${c.val ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-white'}`}
              >
                {c.val ? '✓' : '×'}
              </span>
              <span className={`text-xs ${c.val ? 'text-emerald-900 font-medium' : 'text-slate-500'}`}>
                {c.label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ----- 结项 -----

async function renderClosing(projectId: number, projectStatus: string) {
  const closingReport = await prisma.closingReport.findUnique({ where: { projectId } });
  if (!closingReport) {
    return (
      <Card className="border-slate-300 shadow-md">
        <CardContent className="text-center py-8">
          <div className="text-sm text-muted-foreground mb-3">项目尚未结项</div>
          {projectStatus === 'active' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/closing/new?projectId=${projectId}`}>发起结项报告</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="pt-6">
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <code className="font-mono tabular-nums text-xs bg-slate-100 px-1.5 py-0.5 rounded">
            {closingReport.docNo}
          </code>
          {genericStatusBadge(closingReport.status)}
          <span className="text-xs text-muted-foreground">
            创建于 {fmtDate(closingReport.createdAt)}
          </span>
          {closingReport.approvedAt && (
            <span className="text-xs text-muted-foreground">
              · 批准于 {fmtDate(closingReport.approvedAt)}
            </span>
          )}
          {closingReport.status === 'approved' && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/api/closing/${closingReport.id}/archive`}>
                <Download size={14} className="mr-1.5" />
                下载档案 JSON
              </Link>
            </Button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <LongField label="项目摘要" text={closingReport.basicSummary} />
          <LongField label="目标回顾" text={closingReport.goalReview} />
          <LongField label="成果总结" text={closingReport.outputs} />
          <LongField label="预算回顾" text={closingReport.budgetReview} />
          <LongField label="经验教训" text={closingReport.lessons} />
          <LongField label="后续转化计划" text={closingReport.conversionPlan} />
        </div>
      </CardContent>
    </Card>
  );
}

// ---------- atoms ----------

function EmptyCard({ text }: { text: string }) {
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent>
    </Card>
  );
}
