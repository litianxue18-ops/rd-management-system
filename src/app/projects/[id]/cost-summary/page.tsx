'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface ProjectDetail {
  id: number;
  code: string;
  name: string;
  budget: string;
}

interface LaborSummary {
  projectId: number;
  laborCost: number;
  totalHours: number;
  participantCount: number;
}

interface Breakdown {
  userId: number;
  userName: string;
  employeeId: string;
  hours: number;
  hourlyCost: number;
  subCost: number;
}

interface MaterialBreakdown {
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  actualQty: number;
  subCost: number;
}

interface MaterialCost {
  total: number;
  breakdown: MaterialBreakdown[];
}

interface TrialBreakdown {
  id: number;
  docNo: string;
  laborCost: number;
  machineCost: number;
  materialCost: number;
  totalAmount: number;
  settledAt: string | null;
  orderTitle: string;
  orderDocNo: string;
}

interface TrialCost {
  total: number;
  breakdown: TrialBreakdown[];
}

interface OutsourceBreakdown {
  id: number;
  contractNo: string;
  title: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  remaining: number;
  supplierName: string;
  supplierCode: string;
}

interface OutsourceCost {
  total: number;
  breakdown: OutsourceBreakdown[];
}

interface SharedBreakdown {
  year: number;
  month: number;
  amount: number;
}

interface SharedCost {
  total: number;
  breakdown: SharedBreakdown[];
}

function fmtMoney(n: number): string {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function ProjectCostSummaryPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [proj, setProj] = useState<ProjectDetail | null>(null);
  const [summary, setSummary] = useState<LaborSummary | null>(null);
  const [breakdown, setBreakdown] = useState<Breakdown[]>([]);
  const [matCost, setMatCost] = useState<MaterialCost | null>(null);
  const [trialCost, setTrialCost] = useState<TrialCost | null>(null);
  const [outsourceCost, setOutsourceCost] = useState<OutsourceCost | null>(null);
  const [sharedCost, setSharedCost] = useState<SharedCost | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, lRes, mRes, tRes, oRes, sRes] = await Promise.all([
        fetch(`/api/projects/${id}`, { credentials: 'include' }),
        fetch(`/api/projects/${id}/labor-cost`, { credentials: 'include' }),
        fetch(`/api/projects/${id}/material-cost`, { credentials: 'include' }),
        fetch(`/api/projects/${id}/trial-cost`, { credentials: 'include' }),
        fetch(`/api/projects/${id}/outsource-cost`, { credentials: 'include' }),
        fetch(`/api/projects/${id}/shared-cost`, { credentials: 'include' }),
      ]);
      if (!pRes.ok || !lRes.ok || !mRes.ok || !tRes.ok || !oRes.ok || !sRes.ok) {
        const failed = [pRes, lRes, mRes, tRes, oRes, sRes].find((r) => !r.ok)!;
        const b = await failed.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '加载失败');
      }
      const pBody = await pRes.json();
      const lBody = await lRes.json();
      const mBody = await mRes.json();
      const tBody = await tRes.json();
      const oBody = await oRes.json();
      const sBody = await sRes.json();
      setProj(pBody.data ?? null);
      setSummary(lBody.data?.summary ?? null);
      setBreakdown(lBody.data?.breakdown ?? []);
      setMatCost(mBody.data ?? { total: 0, breakdown: [] });
      setTrialCost(tBody.data ?? { total: 0, breakdown: [] });
      setOutsourceCost(oBody.data ?? { total: 0, breakdown: [] });
      setSharedCost(sBody.data ?? { total: 0, breakdown: [] });
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!isFinite(id)) return;
    loadAll();
  }, [id, loadAll]);

  if (loading || !proj) {
    return (
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const budget = Number(proj.budget);
  const laborCost = summary?.laborCost ?? 0;
  const materialCost = matCost?.total ?? 0;
  const trialTotal = trialCost?.total ?? 0;
  const outsourceTotal = outsourceCost?.total ?? 0;
  const sharedTotal = sharedCost?.total ?? 0;
  const usedTotal =
    laborCost + materialCost + trialTotal + outsourceTotal + sharedTotal;
  const execRate = budget > 0 ? usedTotal / budget : 0;

  async function exportExcel() {
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          type: 'project_cost',
          filters: { projectId: id },
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `项目费用归集-${proj?.code ?? id}-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? '导出失败');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href={`/projects/${id}`}
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              返回项目详情
            </Link>
            <ChevronRight size={12} />
            <span>费用归集</span>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            项目费用归集
          </h1>
          <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
            <span>{proj.name}</span>
            <span>·</span>
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums text-xs">
              {proj.code}
            </code>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel} className="shrink-0">
          <Download size={14} className="mr-2" />
          导出 Excel
        </Button>
      </div>

      {/* KPI Strip 5 卡 全活 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <KpiCard label="人工费" value={`¥${fmtMoney(laborCost)}`} />
        <KpiCard label="物料费" value={`¥${fmtMoney(materialCost)}`} />
        <KpiCard label="试制费" value={`¥${fmtMoney(trialTotal)}`} />
        <KpiCard label="委外费" value={`¥${fmtMoney(outsourceTotal)}`} />
        <KpiCard label="共用资源分摊" value={`¥${fmtMoney(sharedTotal)}`} />
      </div>

      {/* 预算 vs 实际 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">预算 vs 实际</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div>
              <div className="text-xs text-muted-foreground mb-1">预算 (元)</div>
              <div className="font-mono tabular-nums text-2xl font-semibold">
                ¥{fmtMoney(budget)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">已使用 (元)</div>
              <div className="font-mono tabular-nums text-2xl font-semibold text-blue-700">
                ¥{fmtMoney(usedTotal)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">
                = 人工 ¥{fmtMoney(laborCost)} + 物料 ¥{fmtMoney(materialCost)} +
                试制 ¥{fmtMoney(trialTotal)} + 委外 ¥{fmtMoney(outsourceTotal)} +
                共用资源 ¥{fmtMoney(sharedTotal)}
              </div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">执行率</div>
              <div className="font-mono tabular-nums text-2xl font-semibold">
                {(execRate * 100).toFixed(1)}%
              </div>
            </div>
          </div>
          <div className="w-full h-2 bg-slate-100 rounded overflow-hidden">
            <div
              className="h-full bg-blue-500 transition-all"
              style={{ width: `${Math.min(execRate * 100, 100)}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 4 张明细 Card grid-cols-1 lg:grid-cols-2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 人工费明细 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              人工费明细
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {summary?.participantCount ?? 0} 人 ·{' '}
                {(summary?.totalHours ?? 0).toFixed(1)} 小时
              </span>
            </CardTitle>
            <CardDescription>
              按累计已批准工时 × 用户小时成本汇总
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {breakdown.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无已批准工时
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>工号</TableHead>
                    <TableHead className="text-right">累计工时</TableHead>
                    <TableHead className="text-right">小时成本</TableHead>
                    <TableHead className="text-right">人工费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {breakdown.map((r) => (
                    <TableRow key={r.userId}>
                      <TableCell className="font-medium">{r.userName}</TableCell>
                      <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                        {r.employeeId}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.hours.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.hourlyCost > 0 ? `¥${fmtMoney(r.hourlyCost)}` : (
                          <span className="text-rose-600 text-xs">未设</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        ¥{fmtMoney(r.subCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={2} className="font-semibold">
                      合计
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold">
                      {(summary?.totalHours ?? 0).toFixed(1)}
                    </TableCell>
                    <TableCell />
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-blue-700">
                      ¥{fmtMoney(laborCost)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 物料费明细 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              物料费明细
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {matCost?.breakdown.length ?? 0} 种物料
              </span>
            </CardTitle>
            <CardDescription>
              按实际消耗 (出库 - 退库) × 单价聚合; 单价 0 时本期物料费为 ¥0
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(matCost?.breakdown.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无已出库的领料
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>物料编码</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>单位</TableHead>
                    <TableHead className="text-right">实际消耗</TableHead>
                    <TableHead className="text-right">物料费</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(matCost?.breakdown ?? []).map((r) => (
                    <TableRow key={r.materialId}>
                      <TableCell className="font-mono tabular-nums text-xs">
                        {r.materialCode}
                      </TableCell>
                      <TableCell className="font-medium">{r.materialName}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {r.unit}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {r.actualQty.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        ¥{fmtMoney(r.subCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      合计
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-blue-700">
                      ¥{fmtMoney(materialCost)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 试制费明细 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              试制费明细
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {trialCost?.breakdown.length ?? 0} 张转嫁单
              </span>
            </CardTitle>
            <CardDescription>
              仅统计 4 步审批已结转 (status=settled) 的转嫁单
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(trialCost?.breakdown.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无已结转的试制转嫁单
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>转嫁单号</TableHead>
                    <TableHead>试制任务</TableHead>
                    <TableHead className="text-right">人工</TableHead>
                    <TableHead className="text-right">机台</TableHead>
                    <TableHead className="text-right">材料</TableHead>
                    <TableHead className="text-right">小计</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(trialCost?.breakdown ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono tabular-nums text-xs">
                        <Link
                          href={`/trial/transfers/${r.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {r.docNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium truncate max-w-[140px]">
                          {r.orderTitle}
                        </div>
                        <code className="font-mono text-[10px] text-muted-foreground tabular-nums">
                          {r.orderDocNo}
                        </code>
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {Number(r.laborCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {Number(r.machineCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {Number(r.materialCost).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        ¥{fmtMoney(r.totalAmount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={5} className="font-semibold">
                      合计
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-blue-700">
                      ¥{fmtMoney(trialTotal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 委外费明细 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              委外费明细
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {outsourceCost?.breakdown.length ?? 0} 份合同
              </span>
            </CardTitle>
            <CardDescription>
              仅统计 active / completed 合同, 委外费 = 已实付总额
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(outsourceCost?.breakdown.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无已通过的委外合同
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>合同号</TableHead>
                    <TableHead>供应商</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead className="text-right">合同总额</TableHead>
                    <TableHead className="text-right">已付</TableHead>
                    <TableHead className="text-right">剩余</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(outsourceCost?.breakdown ?? []).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-mono tabular-nums text-xs">
                        <Link
                          href={`/outsource/contracts/${r.id}`}
                          className="text-blue-700 hover:underline"
                        >
                          {r.contractNo}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-medium truncate max-w-[120px]">
                          {r.supplierName}
                        </div>
                        <code className="font-mono text-[10px] text-muted-foreground">
                          {r.supplierCode}
                        </code>
                      </TableCell>
                      <TableCell>
                        {r.status === 'active' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100 text-[10px] font-normal">
                            执行中
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-[10px] font-normal">
                            已完成
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs">
                        {Number(r.totalAmount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium text-emerald-700">
                        ¥{fmtMoney(r.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums text-xs text-amber-700">
                        {fmtMoney(r.remaining)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell colSpan={4} className="font-semibold">
                      合计已付
                    </TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-blue-700">
                      ¥{fmtMoney(outsourceTotal)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* 共用资源分摊明细 */}
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              共用资源分摊明细
              <span className="ml-2 text-xs font-normal text-muted-foreground">
                · {sharedCost?.breakdown.length ?? 0} 个月
              </span>
            </CardTitle>
            <CardDescription>
              按项目存续期逐月归集; 月度额 ÷ 12 后按工时占比 / 项目平均分摊
            </CardDescription>
          </CardHeader>
          <CardContent className="px-0 pb-0">
            {(sharedCost?.breakdown.length ?? 0) === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                暂无共用资源分摊 (需配置年度分摊项 + 当月有已审批工时)
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>年月</TableHead>
                    <TableHead className="text-right">分摊额</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(sharedCost?.breakdown ?? []).map((r) => (
                    <TableRow key={`${r.year}-${r.month}`}>
                      <TableCell className="font-mono tabular-nums text-xs">
                        {r.year}-{String(r.month).padStart(2, '0')}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums font-medium">
                        ¥{fmtMoney(r.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">合计</TableCell>
                    <TableCell className="text-right font-mono tabular-nums font-semibold text-blue-700">
                      ¥{fmtMoney(sharedTotal)}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-slate-300 shadow-md">
      <CardContent className="py-4">
        <div className="text-xs text-muted-foreground mb-1">{label}</div>
        <div className="font-mono tabular-nums text-xl font-semibold text-blue-700">
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
