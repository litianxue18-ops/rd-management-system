'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Inbox, RefreshCw, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ReviewEntry {
  id: number;
  userId: number;
  projectId: number;
  workDate: string;
  hours: string;
  workContent: string;
  status: string;
  submittedAt: string | null;
  user: { id: number; name: string; employeeId: string };
  project: { id: number; code: string; name: string };
}

function fmtDate(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(s: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${mi}`;
}

export default function WorkhourReviewPage() {
  const [entries, setEntries] = useState<ReviewEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/workhours/review', { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '加载失败');
      }
      const body = await res.json();
      setEntries(body.data ?? []);
      setSelected(new Set());
    } catch (e: any) {
      toast.error(e?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === entries.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(entries.map((e) => e.id)));
    }
  }

  async function doApprove() {
    if (selected.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch('/api/workhours/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ action: 'approve', entryIds: [...selected] }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '操作失败');
      }
      toast.success(`已批准 ${selected.size} 条`);
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? '操作失败');
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (selected.size === 0) return;
    if (!rejectReason.trim()) {
      toast.error('请填驳回原因');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/workhours/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          entryIds: [...selected],
          reason: rejectReason,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message ?? '操作失败');
      }
      toast.success(`已驳回 ${selected.size} 条`);
      setRejectOpen(false);
      setRejectReason('');
      await loadData();
    } catch (e: any) {
      toast.error(e?.message ?? '操作失败');
    } finally {
      setBusy(false);
    }
  }

  const uniqueUsers = new Set(entries.map((e) => e.userId)).size;
  const uniqueProjects = new Set(entries.map((e) => e.projectId)).size;
  const allSelected = entries.length > 0 && selected.size === entries.length;

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6 pb-24">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight">
            工时周审
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            审核研发员提交的工时
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          刷新
        </Button>
      </div>

      {!loading && entries.length > 0 && (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-3 flex items-center gap-6 text-sm text-muted-foreground">
            <span>
              共{' '}
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {entries.length}
              </span>{' '}
              条
            </span>
            <span>·</span>
            <span>
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {uniqueUsers}
              </span>{' '}
              个研发员
            </span>
            <span>·</span>
            <span>
              <span className="font-mono tabular-nums font-semibold text-foreground">
                {uniqueProjects}
              </span>{' '}
              个项目
            </span>
          </CardContent>
        </Card>
      )}

      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">待审核列表</CardTitle>
          <CardDescription>
            勾选多条后可批量批准 / 驳回
          </CardDescription>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          {loading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground gap-2">
              <Loader2 className="animate-spin" size={16} />
              加载中…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <Inbox className="mx-auto text-slate-400" size={32} />
              <div className="text-sm font-medium">暂无待审核工时</div>
              <div className="text-xs text-muted-foreground">
                研发员提交后会出现在这里
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleAll}
                      className="h-4 w-4 cursor-pointer"
                      aria-label="全选"
                    />
                  </TableHead>
                  <TableHead>研发员</TableHead>
                  <TableHead>工号</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>日期</TableHead>
                  <TableHead className="text-right">工时</TableHead>
                  <TableHead>工作内容</TableHead>
                  <TableHead>提交于</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((e) => {
                  const checked = selected.has(e.id);
                  return (
                    <TableRow
                      key={e.id}
                      data-state={checked ? 'selected' : undefined}
                      className="cursor-pointer"
                      onClick={() => toggle(e.id)}
                    >
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggle(e.id)}
                          onClick={(ev) => ev.stopPropagation()}
                          className="h-4 w-4 cursor-pointer"
                          aria-label={`选择 ${e.id}`}
                        />
                      </TableCell>
                      <TableCell className="font-medium">{e.user.name}</TableCell>
                      <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                        {e.user.employeeId}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-mono tabular-nums text-xs text-muted-foreground">
                            {e.project.code}
                          </span>
                          <span>{e.project.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-xs">
                        {fmtDate(e.workDate)}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums">
                        {Number(e.hours).toFixed(1)}
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm" title={e.workContent}>
                          {e.workContent}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono tabular-nums text-xs text-muted-foreground">
                        {fmtDateTime(e.submittedAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {selected.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur z-50">
          <div className="max-w-7xl mx-auto px-8 py-3 flex items-center justify-between gap-4">
            <div className="text-sm">
              已选{' '}
              <Badge variant="secondary" className="font-mono tabular-nums">
                {selected.size}
              </Badge>{' '}
              条
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
                disabled={busy}
              >
                <X size={14} />
                驳回选中
              </Button>
              <Button onClick={doApprove} disabled={busy}>
                {busy ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Check size={14} />
                )}
                批准选中
              </Button>
            </div>
          </div>
        </div>
      )}

      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回 {selected.size} 条工时</DialogTitle>
            <DialogDescription>
              请填写驳回原因, 研发员将看到此说明
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="比如: 工作内容写得太简单, 请补充细节"
            className="min-h-24"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRejectOpen(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button onClick={doReject} disabled={busy || !rejectReason.trim()}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
