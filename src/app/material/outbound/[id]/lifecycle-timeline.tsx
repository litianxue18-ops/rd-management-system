'use client';
import { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/**
 * 物料领料单完整生命周期时间线 (三级钻取 T2)。
 *
 * 汇总: 申请 → 审批通过 → 出库 → 消耗事件们 → 退库们, 按时间排序。
 * 复用 ApprovalHistory 的竖线 + 圆点风格, 颜色区分事件类型。
 */

const EVENT_LABEL: Record<string, string> = {
  testing: '测试试验',
  trial_prep: '试制备料',
  sample_making: '样品制备',
  loss: '损耗',
  other: '其他',
};

interface UsageLog {
  id: number;
  usageDate: string;
  quantity: string;
  eventType: string;
  description: string;
}

interface OutboundData {
  requestedQty: string;
  issuedQty: string;
  createdAt: string;
  approvedAt: string | null;
  issuedAt: string | null;
  returns: Array<{ id: number; quantity: string; reason: string | null; returnedAt: string }>;
}

type Tone = 'slate' | 'blue' | 'emerald' | 'amber' | 'rose';

interface TimelineEvent {
  ts: number;
  date: string;
  title: string;
  detail?: string;
  tone: Tone;
}

const DOT: Record<Tone, string> = {
  slate: 'bg-slate-400 ring-slate-200',
  blue: 'bg-blue-600 ring-blue-200',
  emerald: 'bg-emerald-600 ring-emerald-200',
  amber: 'bg-amber-500 ring-amber-200',
  rose: 'bg-rose-600 ring-rose-200',
};

function fmtDate(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtNum(n: number) {
  return n.toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export function LifecycleTimeline({ outboundId, unit }: { outboundId: number; unit: string }) {
  const [outbound, setOutbound] = useState<OutboundData | null>(null);
  const [logs, setLogs] = useState<UsageLog[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch(`/api/inventory/outbound/${outboundId}`).then((x) => x.json()),
      fetch(`/api/inventory/usage?outboundId=${outboundId}`).then((x) => x.json()),
    ]).then(([o, u]) => {
      if (cancelled) return;
      setOutbound(o.data ?? null);
      setLogs(u.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [outboundId]);

  if (!outbound || logs === null) {
    return (
      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">物料流转时间线</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  const events: TimelineEvent[] = [];

  events.push({
    ts: new Date(outbound.createdAt).getTime(),
    date: fmtDate(outbound.createdAt),
    title: `提交领料申请 ${fmtNum(Number(outbound.requestedQty))} ${unit}`,
    tone: 'slate',
  });
  if (outbound.approvedAt) {
    events.push({
      ts: new Date(outbound.approvedAt).getTime(),
      date: fmtDate(outbound.approvedAt),
      title: '审批通过',
      tone: 'emerald',
    });
  }
  if (outbound.issuedAt) {
    events.push({
      ts: new Date(outbound.issuedAt).getTime(),
      date: fmtDate(outbound.issuedAt),
      title: `出库 ${fmtNum(Number(outbound.issuedQty))} ${unit}`,
      tone: 'blue',
    });
  }
  for (const l of logs) {
    events.push({
      ts: new Date(l.usageDate).getTime(),
      date: fmtDate(l.usageDate),
      title: `${EVENT_LABEL[l.eventType] ?? l.eventType} 消耗 ${fmtNum(Number(l.quantity))} ${unit}`,
      detail: l.description,
      tone: 'amber',
    });
  }
  for (const r of outbound.returns) {
    events.push({
      ts: new Date(r.returnedAt).getTime(),
      date: fmtDate(r.returnedAt),
      title: `退库 ${fmtNum(Number(r.quantity))} ${unit}`,
      detail: r.reason ?? undefined,
      tone: 'emerald',
    });
  }

  events.sort((a, b) => a.ts - b.ts);

  return (
    <Card className="border-slate-300 shadow-md rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          物料流转时间线
          <span className="text-xs font-normal text-muted-foreground">· {events.length} 个节点</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ol className="relative">
          {events.map((e, idx) => {
            const isLast = idx === events.length - 1;
            return (
              <li key={idx} className={cn('relative pl-6', !isLast && 'pb-4')}>
                {!isLast && (
                  <span
                    aria-hidden
                    className="absolute left-[3px] top-3 bottom-0 w-px bg-slate-200"
                  />
                )}
                <span
                  aria-hidden
                  className={cn('absolute left-0 top-1.5 w-2 h-2 rounded-full ring-2', DOT[e.tone])}
                />
                <div className="flex items-center gap-2 flex-wrap text-sm">
                  <span className="font-medium text-slate-900">{e.title}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">· {e.date}</span>
                </div>
                {e.detail && (
                  <div className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                    {e.detail}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}
