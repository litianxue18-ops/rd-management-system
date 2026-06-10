'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Inbox, ChevronRight, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

interface Todo {
  stepId: number;
  instanceId: number;
  entityType: string;
  entityId: number;
  workflowCode: string;
  stepName: string;
  submittedBy: number;
  submittedAt: string;
}

const ENTITY_LABELS: Record<string, string> = {
  project: '立项审批',
  project_change: '变更申请',
};

function fmtTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function TodoPage() {
  const [list, setList] = useState<Todo[] | null>(null);

  useEffect(() => {
    fetch('/api/workflow/todo')
      .then((r) => r.json())
      .then((j) => setList(j.data ?? []));
  }, []);

  const grouped = useMemo(() => {
    if (!list) return null;
    const g = new Map<string, Todo[]>();
    for (const t of list) {
      if (!g.has(t.entityType)) g.set(t.entityType, []);
      g.get(t.entityType)!.push(t);
    }
    return g;
  }, [list]);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/workbench" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            我的待办
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            所有等你处理的审批步骤,按业务类型分组
          </p>
        </div>
      </div>

      {!grouped ? (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="pt-6 space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </CardContent>
        </Card>
      ) : list && list.length === 0 ? (
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <Inbox size={48} className="text-slate-200" />
              <div className="mt-3 text-base font-medium text-slate-500">
                暂无待办
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                你已经清空所有待办事项
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Array.from(grouped.entries()).map(([entityType, items]) => (
            <Card key={entityType} className="border-slate-300 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  {ENTITY_LABELS[entityType] ?? entityType}
                  <span className="text-xs font-normal text-muted-foreground">
                    · {items.length} 条
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="divide-y divide-slate-100">
                  {items.map((t) => (
                    <li key={t.stepId}>
                      <Link
                        href={`/approval/${t.instanceId}`}
                        className="flex items-center gap-3 -mx-3 px-3 py-3 rounded-md bg-blue-50/30 border-l-2 border-blue-500 hover:bg-blue-50"
                      >
                        <Clock size={16} className="text-slate-400 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm text-slate-900">
                              {t.stepName}
                            </span>
                            <Badge variant="secondary" className="font-normal text-xs">
                              {t.entityType}#{t.entityId}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                            提交于 {fmtTime(t.submittedAt)}
                          </div>
                        </div>
                        <ChevronRight size={16} className="text-slate-400 shrink-0" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
