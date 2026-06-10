'use client';

import { useEffect, useState, useCallback } from 'react';
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
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Download, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ProjectStat {
  projectId: number;
  projectCode: string;
  projectName: string;
  materialCount: number;
  requestedQty: number;
  issuedQty: number;
  returnedQty: number;
  actualQty: number;
}

interface MaterialStat {
  materialId: number;
  materialCode: string;
  materialName: string;
  unit: string;
  actualQty: number;
  breakdown: Array<{
    projectId: number;
    projectCode: string;
    projectName: string;
    subQty: number;
    ratio: number;
  }>;
}

interface MonthStat {
  year: number;
  month: number;
  issueCount: number;
  issueAmount: number;
}

interface Project {
  id: number;
  code: string;
  name: string;
}

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];

function fmtNum(n: number, digits = 2) {
  return n.toLocaleString('zh-CN', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  });
}

function fmtMoney(n: number) {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function MaterialOutboundStatsPage() {
  const [view, setView] = useState<'project' | 'material' | 'month'>('project');
  const [year, setYear] = useState<string>('all');
  const [projectId, setProjectId] = useState<string>('all');
  const [projects, setProjects] = useState<Project[]>([]);

  const [projectRows, setProjectRows] = useState<ProjectStat[]>([]);
  const [materialRows, setMaterialRows] = useState<MaterialStat[]>([]);
  const [monthRows, setMonthRows] = useState<MonthStat[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/projects', { credentials: 'include' })
      .then((r) => r.json())
      .then((b) => setProjects(b.data ?? []))
      .catch(() => {});
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ view });
      if (year !== 'all') params.set('year', year);
      if (projectId !== 'all') params.set('projectId', projectId);
      const res = await fetch(
        `/api/inventory/outbound/stats?${params}`,
        { credentials: 'include' },
      );
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '加载失败');
      }
      const body = await res.json();
      if (view === 'project') setProjectRows(body.data ?? []);
      else if (view === 'material') setMaterialRows(body.data ?? []);
      else setMonthRows(body.data ?? []);
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [view, year, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  async function exportExcel() {
    try {
      const filters: Record<string, any> = {};
      if (year !== 'all') filters.year = Number(year);
      if (projectId !== 'all') filters.projectId = Number(projectId);
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'material_outbound_stats', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `领料统计-${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      toast.error(e?.message ?? '导出失败');
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/workbench"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            领料统计
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            研发物料消耗分析 (报表 1.3)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download size={14} className="mr-2" />
          导出 Excel
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md">
        <CardContent className="py-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">年份</span>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部</SelectItem>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-3">项目</span>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部项目</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="project">按项目</TabsTrigger>
          <TabsTrigger value="material">按物料</TabsTrigger>
          <TabsTrigger value="month">按月</TabsTrigger>
        </TabsList>

        <TabsContent value="project" className="mt-4">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">按项目汇总</CardTitle>
              <CardDescription>
                仅统计已出库 / 已退库 的领料单, 草稿和审批中不计入
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : projectRows.length === 0 ? (
                <EmptyRow text="暂无领料数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead className="text-right">物料数</TableHead>
                      <TableHead className="text-right">申请量</TableHead>
                      <TableHead className="text-right">累计出库</TableHead>
                      <TableHead className="text-right">退库</TableHead>
                      <TableHead className="text-right">实际消耗</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRows.map((r) => (
                      <TableRow key={r.projectId}>
                        <TableCell className="font-mono tabular-nums text-xs">
                          {r.projectCode}
                        </TableCell>
                        <TableCell className="font-medium">{r.projectName}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.materialCount}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtNum(r.requestedQty)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {fmtNum(r.issuedQty)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums text-blue-700">
                          {fmtNum(r.returnedQty)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          {fmtNum(r.actualQty)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="material" className="mt-4">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">按物料汇总</CardTitle>
              <CardDescription>各物料累计消耗 + Top 5 项目使用占比</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : materialRows.length === 0 ? (
                <EmptyRow text="暂无领料数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编码</TableHead>
                      <TableHead>物料</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead className="text-right">累计消耗</TableHead>
                      <TableHead>Top 5 项目占比</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialRows.map((r) => (
                      <TableRow key={r.materialId}>
                        <TableCell className="font-mono tabular-nums text-xs">
                          {r.materialCode}
                        </TableCell>
                        <TableCell className="font-medium">{r.materialName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {r.unit}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums font-semibold">
                          {fmtNum(r.actualQty)}
                        </TableCell>
                        <TableCell>
                          {r.breakdown.length === 0 ? (
                            <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {r.breakdown.map((b, i) => (
                                <Badge
                                  key={`${b.projectId}-${i}`}
                                  variant="secondary"
                                  className="font-normal text-[11px]"
                                >
                                  {b.projectName}
                                  <span className="ml-1 tabular-nums text-slate-500">
                                    {(b.ratio * 100).toFixed(0)}%
                                  </span>
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">按月汇总</CardTitle>
              <CardDescription>
                按出库时间 (issued_at) 聚合, 金额 = 出库量 × 单价 (M6+ 单价回填)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : monthRows.length === 0 ? (
                <EmptyRow text="暂无出库数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>月份</TableHead>
                      <TableHead className="text-right">出库次数</TableHead>
                      <TableHead className="text-right">出库金额</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {monthRows.map((r) => (
                      <TableRow key={`${r.year}-${r.month}`}>
                        <TableCell className="font-mono tabular-nums">
                          {r.year}-{String(r.month).padStart(2, '0')}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.issueCount}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          ¥{fmtMoney(r.issueAmount)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LoadingRow() {
  return (
    <div className="py-12 flex items-center justify-center text-muted-foreground gap-2">
      <Loader2 className="animate-spin" size={16} />
      加载中…
    </div>
  );
}

function EmptyRow({ text }: { text: string }) {
  return (
    <div className="py-12 text-center text-sm text-muted-foreground">{text}</div>
  );
}
