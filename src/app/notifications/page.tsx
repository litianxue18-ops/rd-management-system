'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Bell, BellOff, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface Notification {
  id: number;
  eventType: string;
  entityType: string | null;
  entityId: number | null;
  message: string;
  readAt: string | null;
  createdAt: string;
}

function fmtTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function entityHref(entityType: string | null, entityId: number | null): string | null {
  if (!entityType || !entityId) return null;
  if (entityType === 'project') return `/projects/${entityId}`;
  if (entityType === 'project_change') return null; // 需要 projectId, 这里走 approval 入口
  return null;
}

export default function NotificationsPage() {
  const router = useRouter();
  const [list, setList] = useState<Notification[] | null>(null);

  async function load() {
    const r = await fetch('/api/notifications');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function handleClick(n: Notification) {
    if (!n.readAt) {
      await fetch(`/api/notifications/${n.id}`, { method: 'PATCH' });
    }
    const href = entityHref(n.entityType, n.entityId);
    if (href) router.push(href);
    else load();
  }

  const unread = list?.filter((n) => !n.readAt).length ?? 0;
  const total = list?.length ?? 0;

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/workbench" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            通知中心
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            系统事件 / 审批结果 / 业务进展
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          共 <span className="font-medium text-slate-900 tabular-nums">{total}</span> 条
        </span>
        <span>·</span>
        <span className="tabular-nums">{unread} 未读</span>
      </div>

      {list === null ? (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : list.length === 0 ? (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <BellOff size={48} className="text-slate-200" />
              <div className="mt-3 text-base font-medium text-slate-500">暂无通知</div>
              <div className="mt-1 text-sm text-muted-foreground">
                立项 / 变更等审批完成会推送
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="pt-2 pb-2">
            <ul className="divide-y divide-slate-100">
              {list.map((n) => {
                const isUnread = !n.readAt;
                return (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => handleClick(n)}
                      className={cn(
                        'w-full text-left flex items-start gap-3 px-3 py-3 rounded-md',
                        isUnread
                          ? 'bg-blue-50/30 border-l-2 border-blue-500 hover:bg-blue-50'
                          : 'bg-white hover:bg-slate-50',
                      )}
                    >
                      <Bell
                        size={16}
                        className={cn(
                          'shrink-0 mt-0.5',
                          isUnread ? 'text-slate-400' : 'text-slate-300',
                        )}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-2 flex-wrap">
                          <span
                            className={cn(
                              'text-sm',
                              isUnread ? 'font-medium text-slate-900' : 'text-slate-700',
                            )}
                          >
                            {n.message}
                          </span>
                          {isUnread && (
                            <Badge
                              variant="outline"
                              className="text-blue-800 border-blue-300 bg-blue-100 font-normal text-[10px]"
                            >
                              未读
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                          <code className="font-mono">{n.eventType}</code>
                          {n.entityType && (
                            <>
                              <span>·</span>
                              <span>
                                {n.entityType}#{n.entityId}
                              </span>
                            </>
                          )}
                          <span>·</span>
                          <span className="tabular-nums">{fmtTime(n.createdAt)}</span>
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-400 shrink-0 mt-0.5" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
