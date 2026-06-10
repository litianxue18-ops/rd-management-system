'use client';
import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  ArrowLeft,
  Building2,
  Activity,
  Sparkles,
  Archive,
  Clock,
  AlertTriangle,
  Coins,
  FlaskConical,
  ShieldAlert,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

const ReactECharts = dynamic(() => import('echarts-for-react'), { ssr: false });

interface Overview {
  period: { year: number; quarter: number };
  projectStats: {
    total: number;
    draft: number;
    reviewing: number;
    rejected: number;
    active: number;
    closed: number;
    cancelled: number;
  };
  thisQuarter: {
    newProjects: number;
    closedProjects: number;
    newCapitalizations: number;
  };
  todoTotal: number;
  deptLaborTop: Array<{
    deptId: number | null;
    deptName: string;
    laborCost: number;
  }>;
}

interface TrendRow {
  label: string;
  year: number;
  month: number;
  newProjects: number;
  closedProjects: number;
  totalLaborCost: number;
}

interface Alerts {
  lowWorkhourCount: number;
  reconExceptions: number;
  openExceptions: number;
  sampleDraft: number;
  inventoryWarnings: number;
}

interface BigStatProps {
  label: string;
  value: number | string;
  hint: string;
  Icon: typeof Building2;
  loading: boolean;
}

function BigStat({ label, value, hint, Icon, loading }: BigStatProps) {
  return (
    <Card className="border-slate-300 shadow-md h-28">
      <CardContent className="h-full flex items-center justify-between px-5 py-0">
        <div className="min-w-0">
          <div className="text-xs text-muted-foreground">{label}</div>
          {loading ? (
            <Skeleton className="h-9 w-16 mt-1" />
          ) : (
            <div className="text-3xl md:text-4xl xl:text-5xl font-bold tabular-nums text-slate-900 mt-1">
              {value}
            </div>
          )}
          <div className="text-xs text-muted-foreground mt-1 truncate max-w-[14rem]">
            {hint}
          </div>
        </div>
        <Icon size={16} className="text-slate-300 shrink-0 self-start mt-1" />
      </CardContent>
    </Card>
  );
}

const STATUS_LABEL: Record<string, string> = {
  draft: '草稿',
  reviewing: '审批中',
  rejected: '已驳回',
  active: '进行中',
  closed: '已结项',
  cancelled: '已取消',
};

const STATUS_COLOR: Record<string, string> = {
  draft: '#94a3b8',
  reviewing: '#1677ff',
  rejected: '#e11d48',
  active: '#10b981',
  closed: '#7c3aed',
  cancelled: '#f59e0b',
};

function fmtMoney(n: number) {
  if (!Number.isFinite(n)) return '—';
  if (n >= 10000) {
    return `${(n / 10000).toLocaleString('zh-CN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} 万`;
  }
  return n.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

export default function DashboardPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [trends, setTrends] = useState<TrendRow[] | null>(null);
  const [alerts, setAlerts] = useState<Alerts | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/api/dashboard/overview').then((r) => r.json()),
      fetch('/api/dashboard/trends?months=12').then((r) => r.json()),
      fetch('/api/dashboard/alerts').then((r) => r.json()),
    ]).then(([o, t, a]) => {
      setOverview(o.data ?? null);
      setTrends(t.data ?? []);
      setAlerts(a.data ?? null);
    });
  }, []);

  const cq = overview?.period;

  // 饼图 option
  const pieOption = overview
    ? {
        tooltip: { trigger: 'item' as const },
        legend: { bottom: 0, left: 'center', textStyle: { color: '#475569' } },
        series: [
          {
            name: '项目状态',
            type: 'pie' as const,
            radius: ['40%', '70%'],
            avoidLabelOverlap: false,
            label: { show: false },
            data: [
              { value: overview.projectStats.draft, name: STATUS_LABEL.draft, itemStyle: { color: STATUS_COLOR.draft } },
              { value: overview.projectStats.reviewing, name: STATUS_LABEL.reviewing, itemStyle: { color: STATUS_COLOR.reviewing } },
              { value: overview.projectStats.active, name: STATUS_LABEL.active, itemStyle: { color: STATUS_COLOR.active } },
              { value: overview.projectStats.closed, name: STATUS_LABEL.closed, itemStyle: { color: STATUS_COLOR.closed } },
              { value: overview.projectStats.rejected, name: STATUS_LABEL.rejected, itemStyle: { color: STATUS_COLOR.rejected } },
              { value: overview.projectStats.cancelled, name: STATUS_LABEL.cancelled, itemStyle: { color: STATUS_COLOR.cancelled } },
            ].filter((d) => d.value > 0),
          },
        ],
      }
    : null;

  // 条形图 (部门人工费)
  const barOption =
    overview && overview.deptLaborTop.length > 0
      ? {
          tooltip: {
            trigger: 'axis' as const,
            axisPointer: { type: 'shadow' as const },
            valueFormatter: (v: number) => fmtMoney(v) + ' 元',
          },
          grid: { left: 90, right: 30, top: 10, bottom: 30 },
          xAxis: {
            type: 'value' as const,
            axisLabel: {
              color: '#64748b',
              formatter: (v: number) => fmtMoney(v),
            },
            splitLine: { lineStyle: { color: '#e2e8f0' } },
          },
          yAxis: {
            type: 'category' as const,
            data: overview.deptLaborTop.map((d) => d.deptName).reverse(),
            axisLabel: { color: '#475569' },
          },
          series: [
            {
              name: '人工费',
              type: 'bar' as const,
              data: overview.deptLaborTop.map((d) => d.laborCost).reverse(),
              itemStyle: { color: '#1677ff', borderRadius: [0, 4, 4, 0] },
              barWidth: 18,
            },
          ],
        }
      : null;

  // 趋势曲线
  const trendOption =
    trends && trends.length > 0
      ? {
          tooltip: { trigger: 'axis' as const },
          legend: { bottom: 0, textStyle: { color: '#475569' } },
          grid: { left: 60, right: 60, top: 20, bottom: 50 },
          xAxis: {
            type: 'category' as const,
            data: trends.map((r) => r.label),
            axisLabel: { color: '#64748b', fontSize: 10 },
          },
          yAxis: [
            {
              type: 'value' as const,
              name: '项目数',
              position: 'left' as const,
              axisLabel: { color: '#64748b' },
              splitLine: { lineStyle: { color: '#e2e8f0' } },
            },
            {
              type: 'value' as const,
              name: '人工费 (万)',
              position: 'right' as const,
              axisLabel: {
                color: '#64748b',
                formatter: (v: number) => (v / 10000).toFixed(0),
              },
            },
          ],
          series: [
            {
              name: '新立项',
              type: 'bar' as const,
              data: trends.map((r) => r.newProjects),
              itemStyle: { color: '#1677ff' },
              yAxisIndex: 0,
            },
            {
              name: '新结项',
              type: 'bar' as const,
              data: trends.map((r) => r.closedProjects),
              itemStyle: { color: '#7c3aed' },
              yAxisIndex: 0,
            },
            {
              name: '人工费',
              type: 'line' as const,
              data: trends.map((r) => r.totalLaborCost),
              itemStyle: { color: '#10b981' },
              lineStyle: { color: '#10b981', width: 2 },
              yAxisIndex: 1,
              smooth: true,
            },
          ],
        }
      : null;

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
            研发管理 BI 大屏
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            {cq ? `${cq.year} Q${cq.quarter} · ` : ''}项目分布 / 部门投入 / 月度趋势 / 红线
          </p>
        </div>
      </div>

      {/* 4 KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BigStat
          label="全公司项目"
          value={overview?.projectStats.total ?? 0}
          hint="累计立项"
          Icon={Building2}
          loading={overview === null}
        />
        <BigStat
          label="进行中"
          value={overview?.projectStats.active ?? 0}
          hint="active 项目"
          Icon={Activity}
          loading={overview === null}
        />
        <BigStat
          label="本季新立项"
          value={overview?.thisQuarter.newProjects ?? 0}
          hint={cq ? `${cq.year} Q${cq.quarter}` : ''}
          Icon={Sparkles}
          loading={overview === null}
        />
        <BigStat
          label="本季新结项"
          value={overview?.thisQuarter.closedProjects ?? 0}
          hint={cq ? `${cq.year} Q${cq.quarter}` : ''}
          Icon={Archive}
          loading={overview === null}
        />
      </div>

      {/* 中部: 项目分布 + 部门排名 (8) | 红线预警 (4) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                项目状态分布
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  · 共 {overview?.projectStats.total ?? 0} 个
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview === null ? (
                <Skeleton className="h-72 w-full" />
              ) : pieOption ? (
                <ReactECharts
                  option={pieOption}
                  style={{ height: 300 }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  暂无项目
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-slate-300 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                部门人工费 top 5
                <span className="text-xs font-normal text-muted-foreground ml-2">
                  · 全部已批准工时累计
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {overview === null ? (
                <Skeleton className="h-72 w-full" />
              ) : barOption ? (
                <ReactECharts
                  option={barOption}
                  style={{ height: 300 }}
                  opts={{ renderer: 'canvas' }}
                />
              ) : (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  暂无人工费数据
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 红线 */}
        <div className="lg:col-span-4">
          <Card className="border-slate-300 shadow-md h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <ShieldAlert size={16} className="text-rose-600" />
                红线预警
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {alerts === null ? (
                <Skeleton className="h-40 w-full" />
              ) : (
                <>
                  <AlertRow
                    Icon={Clock}
                    label="本月工时 <240h 人数"
                    value={alerts.lowWorkhourCount}
                    suffix="人"
                  />
                  <AlertRow
                    Icon={Activity}
                    label="本月勾稽差异 > 3%"
                    value={alerts.reconExceptions}
                    suffix="类 / 3"
                  />
                  <AlertRow
                    Icon={AlertTriangle}
                    label="异常单 open"
                    value={alerts.openExceptions}
                    suffix="条"
                  />
                  <AlertRow
                    Icon={FlaskConical}
                    label="样品销售待监销"
                    value={alerts.sampleDraft}
                    suffix="单"
                  />
                  <AlertRow
                    Icon={Coins}
                    label="本季新资本化"
                    value={overview?.thisQuarter.newCapitalizations ?? 0}
                    suffix="份"
                    positiveIsGood
                  />
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 底: 近 12 月趋势 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            近 12 月趋势
            <span className="text-xs font-normal text-muted-foreground ml-2">
              · 立项 / 结项 / 人工费
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trends === null ? (
            <Skeleton className="h-80 w-full" />
          ) : trendOption ? (
            <ReactECharts
              option={trendOption}
              style={{ height: 320 }}
              opts={{ renderer: 'canvas' }}
            />
          ) : (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无趋势数据
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface AlertRowProps {
  Icon: typeof Clock;
  label: string;
  value: number;
  suffix: string;
  positiveIsGood?: boolean;
}

function AlertRow({ Icon, label, value, suffix, positiveIsGood }: AlertRowProps) {
  const bad = positiveIsGood ? value === 0 : value > 0;
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-slate-50">
      <div className="flex items-center gap-2 min-w-0">
        <Icon
          size={14}
          className={bad ? 'text-rose-600 shrink-0' : 'text-emerald-600 shrink-0'}
        />
        <span className="text-xs text-slate-700 truncate">{label}</span>
      </div>
      <div className="text-right shrink-0">
        <span
          className={
            bad
              ? 'text-xl font-bold tabular-nums text-rose-700'
              : 'text-xl font-bold tabular-nums text-emerald-700'
          }
        >
          {value}
        </span>
        <span className="text-xs text-muted-foreground ml-1">{suffix}</span>
      </div>
    </div>
  );
}
