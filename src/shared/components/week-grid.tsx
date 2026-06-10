'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Save, Send, Loader2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  projectType?: { name: string };
}

interface WorkhourEntry {
  id: number;
  userId: number;
  projectId: number;
  workDate: string;
  hours: string | number;
  workContent: string;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  submittedAt?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
}

interface CellState {
  id?: number;
  hours: string;          // 字符串方便受控 input
  workContent: string;
  status: 'draft' | 'reviewing' | 'approved' | 'rejected';
  rejectedReason?: string | null;
  dirty: boolean;
}

const WEEK_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function shortMD(d: Date): string {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function cellKey(projectId: number, dateISO: string): string {
  return `${projectId}|${dateISO}`;
}

function statusLabel(s: CellState['status']): { text: string; cls: string } {
  switch (s) {
    case 'reviewing':
      return { text: '审核中', cls: 'border-blue-300 text-blue-700 bg-blue-50' };
    case 'approved':
      return { text: '已批准', cls: 'border-emerald-300 text-emerald-700 bg-emerald-50' };
    case 'rejected':
      return { text: '已驳回', cls: 'border-rose-300 text-rose-700 bg-rose-50' };
    default:
      return { text: '草稿', cls: 'border-slate-300 text-slate-600 bg-slate-50' };
  }
}

export function WeekGrid({ weekStart }: { weekStart: Date }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [cells, setCells] = useState<Record<string, CellState>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // 7 天日期 (周一到周日)
  const days = useMemo(() => {
    return Array.from({ length: 7 }).map((_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      return d;
    });
  }, [weekStart]);

  const todayISO = ymd(new Date());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [pRes, wRes] = await Promise.all([
        fetch('/api/projects?status=active', { credentials: 'include' }),
        fetch(`/api/workhours?weekStart=${ymd(weekStart)}`, { credentials: 'include' }),
      ]);
      if (!pRes.ok || !wRes.ok) {
        throw new Error('加载失败');
      }
      const pBody = await pRes.json();
      const wBody = await wRes.json();
      const projList: Project[] = pBody.data ?? [];
      const entries: WorkhourEntry[] = wBody.data ?? [];

      // 从 entries 构造 cells map
      const newCells: Record<string, CellState> = {};
      for (const e of entries) {
        // workDate 后端返回 ISO yyyy-mm-ddTHH:MM:SS.sssZ, 截取日期部分
        const dISO = e.workDate.slice(0, 10);
        newCells[cellKey(e.projectId, dISO)] = {
          id: e.id,
          hours: String(Number(e.hours)),
          workContent: e.workContent,
          status: e.status,
          rejectedReason: e.rejectedReason ?? null,
          dirty: false,
        };
      }

      setProjects(projList);
      setCells(newCells);
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, [weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function updateCell(projectId: number, dateISO: string, patch: Partial<CellState>) {
    setCells((prev) => {
      const key = cellKey(projectId, dateISO);
      const existing = prev[key] ?? {
        hours: '',
        workContent: '',
        status: 'draft' as const,
        dirty: false,
      };
      return {
        ...prev,
        [key]: { ...existing, ...patch, dirty: true },
      };
    });
  }

  // 收集所有 dirty 且 hours > 0 的 cells, 用于 batch upsert
  function collectDirtyEntries(): Array<{
    projectId: number;
    workDate: string;
    hours: number;
    workContent: string;
  }> {
    const out: Array<{
      projectId: number;
      workDate: string;
      hours: number;
      workContent: string;
    }> = [];
    for (const [key, cell] of Object.entries(cells)) {
      if (!cell.dirty) continue;
      const [projectIdStr, dateISO] = key.split('|');
      const projectId = Number(projectIdStr);
      const hoursNum = Number(cell.hours);
      if (!cell.hours || isNaN(hoursNum) || hoursNum <= 0) continue;
      out.push({
        projectId,
        workDate: dateISO,
        hours: hoursNum,
        workContent: cell.workContent ?? '',
      });
    }
    return out;
  }

  async function saveDraft(opts: { silent?: boolean } = {}): Promise<boolean> {
    const entries = collectDirtyEntries();
    if (entries.length === 0) {
      if (!opts.silent) toast.info('没有需要保存的修改');
      return true;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/workhours', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ entries }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '保存失败');
      }
      if (!opts.silent) toast.success(`已保存 ${entries.length} 条`);
      await loadData();
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? '保存失败');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function submitThisWeek() {
    setSubmitting(true);
    try {
      // 先保存所有 dirty 的
      const ok = await saveDraft({ silent: true });
      if (!ok) return;
      const res = await fetch('/api/workhours/submit-week', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ weekStart: ymd(weekStart) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '提交失败');
      }
      const body = await res.json();
      toast.success(`已提交 ${body?.data?.count ?? 0} 条给项目负责人`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? '提交失败');
    } finally {
      setSubmitting(false);
    }
  }

  // 总计计算
  const dayTotals = days.map((d) => {
    const dISO = ymd(d);
    let sum = 0;
    for (const p of projects) {
      const c = cells[cellKey(p.id, dISO)];
      if (c && c.hours) {
        const n = Number(c.hours);
        if (!isNaN(n)) sum += n;
      }
    }
    return sum;
  });
  const weekTotal = dayTotals.reduce((a, b) => a + b, 0);

  if (loading) {
    return (
      <Card className="border-slate-300 shadow-md">
        <CardContent className="py-12 flex items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="animate-spin" size={16} />
          加载中…
        </CardContent>
      </Card>
    );
  }

  if (projects.length === 0) {
    return (
      <Card className="border-slate-300 shadow-md">
        <CardContent className="py-16 text-center text-muted-foreground space-y-2">
          <div className="text-base">还没参与任何活跃项目</div>
          <div className="text-xs">等项目立项通过后, 你会出现在项目成员列表里</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-slate-300 shadow-md overflow-hidden">
        <CardHeader>
          <CardTitle>周历填报</CardTitle>
          <CardDescription>
            每个项目每天最多 1 条 · 0.5 小时步长 · 0-24 之间
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-y border-slate-200 bg-slate-50/60">
                  <th className="text-left font-medium text-slate-600 px-3 py-2 w-44 sticky left-0 bg-slate-50/60 z-10">
                    项目
                  </th>
                  {days.map((d, i) => {
                    const dISO = ymd(d);
                    const isToday = dISO === todayISO;
                    return (
                      <th
                        key={dISO}
                        className={`text-center font-medium text-slate-600 px-2 py-2 w-36 ${
                          isToday ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        <div>{WEEK_LABELS[i]}</div>
                        <div className="text-xs font-mono tabular-nums text-slate-500">
                          {shortMD(d)}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100 align-top">
                    <td className="px-3 py-2 sticky left-0 bg-white z-10">
                      <div className="font-mono text-xs tabular-nums text-slate-500">
                        {p.code}
                      </div>
                      <div className="text-sm font-medium leading-tight">{p.name}</div>
                      {p.projectType?.name && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {p.projectType.name}
                        </div>
                      )}
                    </td>
                    {days.map((d) => {
                      const dISO = ymd(d);
                      const isToday = dISO === todayISO;
                      const key = cellKey(p.id, dISO);
                      const cell = cells[key];
                      const status = cell?.status ?? 'draft';
                      const locked = status === 'reviewing' || status === 'approved';
                      const lab = statusLabel(status);
                      const rejected = status === 'rejected';

                      return (
                        <td
                          key={dISO}
                          className={`px-2 py-2 align-top ${isToday ? 'bg-blue-50/30' : ''}`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <Input
                                type="number"
                                step={0.5}
                                min={0}
                                max={24}
                                disabled={locked}
                                value={cell?.hours ?? ''}
                                placeholder="—"
                                onChange={(e) =>
                                  updateCell(p.id, dISO, { hours: e.target.value })
                                }
                                className={`h-8 text-sm tabular-nums text-center ${
                                  rejected
                                    ? 'border-rose-400 focus-visible:border-rose-500 focus-visible:ring-rose-400/40'
                                    : ''
                                }`}
                                title={rejected && cell?.rejectedReason ? `驳回原因: ${cell.rejectedReason}` : undefined}
                              />
                              {cell && cell.status !== 'draft' && (
                                <Badge
                                  variant="outline"
                                  className={`h-5 px-1.5 text-[10px] ${lab.cls}`}
                                  title={
                                    rejected && cell.rejectedReason
                                      ? `驳回原因: ${cell.rejectedReason}`
                                      : lab.text
                                  }
                                >
                                  {lab.text}
                                </Badge>
                              )}
                            </div>
                            <Textarea
                              disabled={locked}
                              value={cell?.workContent ?? ''}
                              placeholder="工作内容"
                              onChange={(e) =>
                                updateCell(p.id, dISO, { workContent: e.target.value })
                              }
                              className="h-14 min-h-14 text-xs resize-none px-2 py-1"
                            />
                            {rejected && cell?.rejectedReason && (
                              <div className="flex items-start gap-1 text-[11px] text-rose-600 leading-tight">
                                <AlertCircle size={11} className="mt-0.5 shrink-0" />
                                <span className="line-clamp-2">{cell.rejectedReason}</span>
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50/60 font-medium">
                  <td className="px-3 py-2 sticky left-0 bg-slate-50/60 z-10">总计</td>
                  {dayTotals.map((sum, i) => {
                    const isToday = ymd(days[i]) === todayISO;
                    return (
                      <td
                        key={i}
                        className={`text-center px-2 py-2 font-mono tabular-nums ${
                          isToday ? 'bg-blue-50/60' : ''
                        }`}
                      >
                        {sum > 0 ? sum.toFixed(1) : '—'}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm text-muted-foreground">
          本周总计 <span className="font-mono tabular-nums font-semibold text-foreground text-base">{weekTotal.toFixed(1)}</span> 小时
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => saveDraft()}
            disabled={saving || submitting}
          >
            {saving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
            保存草稿
          </Button>
          <Button onClick={submitThisWeek} disabled={saving || submitting}>
            {submitting ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
            提交本周给负责人
          </Button>
        </div>
      </div>
    </div>
  );
}
