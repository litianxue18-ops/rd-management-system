'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Loader2, Download } from 'lucide-react';
import { toast } from 'sonner';

interface Dept {
  id: number;
  name: string;
}

interface UserRow {
  userId: number;
  userName: string;
  employeeId: string;
  departmentName: string;
  totalHours: number;
  ratio: number;
  belowRedline: boolean;
}

interface ProjectRow {
  projectId: number;
  projectCode: string;
  projectName: string;
  typeName?: string;
  totalHours: number;
  participantCount: number;
}

interface MonthRow {
  year: number;
  month: number;
  totalHours: number;
  activeUsers: number;
  totalUsers: number;
  coverage: number;
  standardHours: number;
}

interface UserData {
  rows: UserRow[];
  standardHours: number;
  workdays: number;
  year: number;
  month: number;
}

const NOW = new Date();
const CURRENT_YEAR = NOW.getFullYear();
const CURRENT_MONTH = NOW.getMonth() + 1;

const YEARS = [CURRENT_YEAR - 1, CURRENT_YEAR, CURRENT_YEAR + 1];
const MONTHS = Array.from({ length: 12 }).map((_, i) => i + 1);

export default function WorkhourStatsPage() {
  const [year, setYear] = useState(CURRENT_YEAR);
  const [month, setMonth] = useState(CURRENT_MONTH);
  const [view, setView] = useState<'user' | 'project' | 'month'>('user');
  const [departmentId, setDepartmentId] = useState<string>('all');
  const [departments, setDepartments] = useState<Dept[]>([]);

  const [userData, setUserData] = useState<UserData | null>(null);
  const [projectRows, setProjectRows] = useState<ProjectRow[]>([]);
  const [monthRow, setMonthRow] = useState<MonthRow | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/departments', { credentials: 'include' })
      .then((r) => r.json())
      .then((b) => setDepartments(b.data ?? []))
      .catch(() => {});
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(year),
        month: String(month),
        view,
      });
      if (departmentId !== 'all') params.set('departmentId', departmentId);
      const res = await fetch(`/api/workhours/stats?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '加载失败');
      }
      const body = await res.json();
      if (view === 'user') {
        setUserData(body.data);
      } else if (view === 'project') {
        setProjectRows(body.data.rows ?? []);
      } else {
        setMonthRow(body.data.rows?.[0] ?? null);
      }
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [year, month, view, departmentId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function exportExcel() {
    try {
      const filters: Record<string, any> = { year, month };
      if (departmentId !== 'all') filters.departmentId = Number(departmentId);
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ type: 'workhour_stats', filters }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error?.message ?? '导出失败');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `工时统计-${year}-${month}-${new Date().toISOString().slice(0, 10)}.xlsx`;
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
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight">
            工时统计
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            研发投入分析报表
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={exportExcel}>
          <Download size={14} className="mr-2" />
          导出 Excel
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md">
        <CardContent className="py-4 flex items-center gap-3 flex-wrap">
          <span className="text-sm text-muted-foreground">年月</span>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {YEARS.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m) => (
                <SelectItem key={m} value={String(m)}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground ml-3">部门</span>
          <Select value={departmentId} onValueChange={setDepartmentId}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {departments.map((d) => (
                <SelectItem key={d.id} value={String(d.id)}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Tabs value={view} onValueChange={(v) => setView(v as any)}>
        <TabsList>
          <TabsTrigger value="user">按人</TabsTrigger>
          <TabsTrigger value="project">按项目</TabsTrigger>
          <TabsTrigger value="month">按月</TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="mt-4">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">按员工汇总</CardTitle>
              <CardDescription>
                标准工时 = {userData?.workdays ?? 0} 工作日 × 8 ={' '}
                <span className="font-mono tabular-nums">
                  {userData?.standardHours ?? 0}
                </span>{' '}
                小时 (不含节假日)
              </CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : !userData || userData.rows.length === 0 ? (
                <EmptyRow text="本月暂无工时数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>员工</TableHead>
                      <TableHead>工号</TableHead>
                      <TableHead>部门</TableHead>
                      <TableHead className="text-right">总工时</TableHead>
                      <TableHead className="text-right">占比</TableHead>
                      <TableHead>红线标志</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {userData.rows.map((r) => (
                      <TableRow key={r.userId}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                          {r.employeeId}
                        </TableCell>
                        <TableCell>{r.departmentName}</TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.totalHours.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {(r.ratio * 100).toFixed(1)}%
                        </TableCell>
                        <TableCell>
                          {r.belowRedline ? (
                            <Badge
                              variant="outline"
                              className="text-rose-800 border-rose-300 bg-rose-100 font-normal"
                            >
                              低于红线 50%
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
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

        <TabsContent value="project" className="mt-4">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">按项目汇总</CardTitle>
              <CardDescription>本月已批准工时按项目分布</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : projectRows.length === 0 ? (
                <EmptyRow text="本月暂无工时数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>编号</TableHead>
                      <TableHead>项目</TableHead>
                      <TableHead>类型</TableHead>
                      <TableHead className="text-right">总工时</TableHead>
                      <TableHead className="text-right">参与人数</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projectRows.map((r) => (
                      <TableRow key={r.projectId}>
                        <TableCell className="font-mono tabular-nums text-xs">
                          {r.projectCode}
                        </TableCell>
                        <TableCell className="font-medium">{r.projectName}</TableCell>
                        <TableCell>
                          {r.typeName ? (
                            <Badge variant="secondary" className="font-normal">
                              {r.typeName}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.totalHours.toFixed(1)}
                        </TableCell>
                        <TableCell className="text-right font-mono tabular-nums">
                          {r.participantCount}
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
              <CardTitle className="text-base font-semibold">全公司本月汇总</CardTitle>
              <CardDescription>研发员覆盖率与总投入</CardDescription>
            </CardHeader>
            <CardContent className="px-0 pb-0">
              {loading ? (
                <LoadingRow />
              ) : !monthRow ? (
                <EmptyRow text="本月暂无工时数据" />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>年月</TableHead>
                      <TableHead className="text-right">全公司总工时</TableHead>
                      <TableHead className="text-right">标准工时</TableHead>
                      <TableHead className="text-right">活跃员工</TableHead>
                      <TableHead className="text-right">在职员工</TableHead>
                      <TableHead className="text-right">覆盖率</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="font-mono tabular-nums">
                        {monthRow.year}-{String(monthRow.month).padStart(2, '0')}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {monthRow.totalHours.toFixed(1)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {monthRow.standardHours}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {monthRow.activeUsers}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {monthRow.totalUsers}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {(monthRow.coverage * 100).toFixed(1)}%
                      </TableCell>
                    </TableRow>
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
    <div className="py-12 text-center text-sm text-muted-foreground">
      {text}
    </div>
  );
}
