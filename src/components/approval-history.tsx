'use client';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  stepIndex: number;
  stepName: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
  actedAt: string | null;
  actedBy: number | null;
  comments: string | null;
  assignedUserId: number | null;
}

interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedAt: string;
  submittedBy: number;
  finishedAt: string | null;
  workflowCode: string;
  steps: Step[];
}

interface User {
  id: number;
  name: string;
}

function fmtTime(s: string | null) {
  if (!s) return '';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function instanceStatusBadge(s: Instance['status']) {
  if (s === 'running')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">
        审批中
      </Badge>
    );
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">
        已通过
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">
        已驳回
      </Badge>
    );
  if (s === 'cancelled')
    return <Badge variant="secondary">已撤回</Badge>;
  return <Badge variant="secondary">草稿</Badge>;
}

function dotColor(status: Step['status']) {
  if (status === 'approved') return 'bg-emerald-600 ring-emerald-200';
  if (status === 'rejected') return 'bg-rose-600 ring-rose-200';
  if (status === 'pending') return 'bg-blue-600 ring-blue-200';
  if (status === 'transferred') return 'bg-slate-500 ring-slate-200';
  return 'bg-slate-400 ring-slate-200';
}

function stepStatusLabel(s: Step['status']) {
  if (s === 'approved') return '已通过';
  if (s === 'rejected') return '已驳回';
  if (s === 'pending') return '待处理';
  if (s === 'transferred') return '已转交';
  return '已跳过';
}

function stepStatusColor(s: Step['status']) {
  if (s === 'approved') return 'text-emerald-600';
  if (s === 'rejected') return 'text-rose-600';
  if (s === 'pending') return 'text-blue-600';
  return 'text-muted-foreground';
}

export function ApprovalHistory({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: number;
}) {
  const [data, setData] = useState<Instance[] | null>(null);
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    fetch(`/api/workflow/instances?entityType=${entityType}&entityId=${entityId}`)
      .then((r) => r.json())
      .then((j) => setData(j.data ?? []));
    fetch('/api/users')
      .then((r) => r.json())
      .then((j) => setUsers(j.data ?? []));
  }, [entityType, entityId]);

  if (!data) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    );
  }
  if (data.length === 0) {
    return <div className="text-sm text-muted-foreground py-2">暂无审批记录</div>;
  }
  return (
    <div className="space-y-4">
      {data.map((inst) => (
        <div
          key={inst.id}
          className="border border-slate-200 rounded-xl shadow-sm p-4 bg-white"
        >
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">#{inst.id}</span>
            {instanceStatusBadge(inst.status)}
            <span className="text-xs text-muted-foreground tabular-nums">
              提交于 {fmtTime(inst.submittedAt)}
            </span>
            {inst.finishedAt && (
              <span className="text-xs text-muted-foreground tabular-nums">
                · 结束于 {fmtTime(inst.finishedAt)}
              </span>
            )}
          </div>

          {/* 时间轴: 竖线 + 状态圆点 */}
          <ol className="mt-4 relative">
            {inst.steps.map((s, idx) => {
              const isLast = idx === inst.steps.length - 1;
              const actor = users.find((u) => u.id === s.actedBy);
              const assignee = users.find((u) => u.id === s.assignedUserId);
              const personName =
                s.status === 'pending'
                  ? assignee?.name ?? (s.assignedUserId ? `#${s.assignedUserId}` : '未分配')
                  : actor?.name ?? (s.actedBy ? `#${s.actedBy}` : '');
              return (
                <li
                  key={s.id}
                  className={cn('relative pl-6', !isLast && 'pb-4')}
                >
                  {/* 竖线 */}
                  {!isLast && (
                    <span
                      aria-hidden
                      className="absolute left-[3px] top-3 bottom-0 w-px bg-slate-200"
                    />
                  )}
                  {/* 圆点 */}
                  <span
                    aria-hidden
                    className={cn(
                      'absolute left-0 top-1.5 w-2 h-2 rounded-full ring-2',
                      dotColor(s.status),
                    )}
                  />
                  <div className="flex items-center gap-2 flex-wrap text-sm">
                    <span className="font-medium text-slate-900">
                      {s.stepIndex}. {s.stepName}
                    </span>
                    <span className={cn('text-xs', stepStatusColor(s.status))}>
                      {stepStatusLabel(s.status)}
                    </span>
                    {personName && (
                      <span className="text-xs text-muted-foreground">· {personName}</span>
                    )}
                    {s.actedAt && (
                      <span className="text-xs text-muted-foreground tabular-nums">
                        · {fmtTime(s.actedAt)}
                      </span>
                    )}
                  </div>
                  {s.comments && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      意见: {s.comments}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
