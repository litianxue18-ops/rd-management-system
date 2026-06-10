import { Fragment } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/shared/prisma';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import {
  fmtDate,
  fmtMoney,
  fmtNum,
  MiniKpi,
  requirePageAuth,
} from '../../../overview/overview-shared';

/**
 * 工时按人按天页 (server component, 三级钻取 T2)。
 *
 * 来源: /projects/[id]/detail/workhour 的聚合行点 "详情" 进来。
 * 展示该 user 在本项目的全部 workhour_entry, 按月分组 + 每月小计。
 */

const WEEKDAY = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function workhourStatusBadge(s: string) {
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600 font-normal text-[10px]">
        已批准
      </Badge>
    );
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600 font-normal text-[10px]">
        审批中
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600 font-normal text-[10px]">
        已驳回
      </Badge>
    );
  return (
    <Badge variant="secondary" className="font-normal text-[10px]">
      草稿
    </Badge>
  );
}

function monthKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export default async function ProjectWorkhourByUserPage({
  params,
}: {
  params: Promise<{ id: string; userId: string }>;
}) {
  await requirePageAuth();
  const { id: idStr, userId: userIdStr } = await params;
  const projectId = Number(idStr);
  const userId = Number(userIdStr);
  if (!Number.isFinite(projectId) || !Number.isFinite(userId)) notFound();

  const [project, user, entries] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, code: true, name: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      include: { department: { select: { name: true } } },
    }),
    prisma.workhourEntry.findMany({
      where: { userId, projectId },
      orderBy: { workDate: 'asc' },
    }),
  ]);
  if (!project) notFound();
  if (!user) notFound();

  const hourlyCost = Number(user.hourlyCost ?? 0);

  let totalHours = 0;
  let approvedHours = 0;
  let pendingHours = 0; // draft + reviewing
  for (const e of entries) {
    const h = Number(e.hours);
    totalHours += h;
    if (e.status === 'approved') approvedHours += h;
    else if (e.status === 'draft' || e.status === 'reviewing') pendingHours += h;
  }
  const wageEquivalent = approvedHours * hourlyCost;

  // 按月分组 (entries 已按 workDate asc 排序)
  const groups: { month: string; entries: typeof entries; subtotal: number }[] = [];
  for (const e of entries) {
    const key = monthKey(e.workDate);
    let g = groups[groups.length - 1];
    if (!g || g.month !== key) {
      g = { month: key, entries: [], subtotal: 0 };
      groups.push(g);
    }
    g.entries.push(e);
    g.subtotal += Number(e.hours);
  }

  return (
    <div className="bg-slate-50 min-h-[calc(100vh-3.5rem)]">
      {/* sticky header */}
      <div className="sticky top-0 z-20 bg-white border-b-2 border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-8 py-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href={`/projects/${projectId}/detail/workhour`}
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              返回工时明细
            </Link>
            <ChevronRight size={12} />
            <span>{user.name} · 逐日工时</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900">
              {user.name}
            </h1>
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums text-xs">
              {user.employeeId}
            </code>
            <span className="text-sm text-muted-foreground">
              {user.department?.name ?? '—'}
            </span>
            <span className="text-xs text-muted-foreground">
              · {project.code} {project.name}
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        {/* KPI */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MiniKpi label="总工时" value={`${fmtNum(totalHours, 1)} h`} />
          <MiniKpi label="已审批工时" value={`${fmtNum(approvedHours, 1)} h`} tone="blue" />
          <MiniKpi label="待审批工时" value={`${fmtNum(pendingHours, 1)} h`} />
          <MiniKpi
            label="工资折算"
            value={fmtMoney(wageEquivalent)}
            note={hourlyCost > 0 ? `已审批 × ${fmtMoney(hourlyCost)}/h` : '未设小时成本'}
            tone="blue"
          />
        </div>

        {/* 逐日工时表 (按月分组) */}
        {entries.length === 0 ? (
          <Card className="border-slate-300 shadow-md">
            <CardContent className="py-12 text-center text-sm text-muted-foreground">
              该成员在本项目暂无工时记录
            </CardContent>
          </Card>
        ) : (
          <Card className="border-slate-300 shadow-md">
            <CardContent className="px-0 pb-0">
              <Table>
                <TableHeader>
                  <TableRow className="h-10">
                    <TableHead className="w-28">日期</TableHead>
                    <TableHead className="w-16">星期</TableHead>
                    <TableHead className="text-right w-20">工时</TableHead>
                    <TableHead>工作内容</TableHead>
                    <TableHead className="w-20">状态</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groups.map((g) => (
                    <Fragment key={g.month}>
                      <TableRow className="bg-slate-100 hover:bg-slate-100 h-8">
                        <TableCell colSpan={2} className="py-1.5 font-mono tabular-nums text-xs font-medium text-slate-700">
                          {g.month}
                        </TableCell>
                        <TableCell className="py-1.5 text-right font-mono tabular-nums text-xs font-medium text-slate-700">
                          {fmtNum(g.subtotal, 1)} h
                        </TableCell>
                        <TableCell colSpan={2} className="py-1.5 text-xs text-muted-foreground">
                          月小计 · {g.entries.length} 条
                        </TableCell>
                      </TableRow>
                      {g.entries.map((e) => (
                        <TableRow key={e.id} className="h-10 hover:bg-blue-50/50">
                          <TableCell className="font-mono tabular-nums text-xs py-2">
                            {fmtDate(e.workDate)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-muted-foreground">
                            {WEEKDAY[e.workDate.getDay()]}
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums py-2">
                            {fmtNum(Number(e.hours), 1)}
                          </TableCell>
                          <TableCell className="py-2 text-xs text-slate-700 whitespace-pre-wrap">
                            {e.workContent}
                          </TableCell>
                          <TableCell className="py-2">{workhourStatusBadge(e.status)}</TableCell>
                        </TableRow>
                      ))}
                    </Fragment>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
        <div className="text-xs text-muted-foreground">
          提示: 工资折算 = 已审批工时 × 小时成本. 草稿 / 审批中工时不计入折算.
        </div>
      </div>
    </div>
  );
}
