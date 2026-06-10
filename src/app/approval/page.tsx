'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, ClipboardCheck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';

/** 单据类型 → 中文映射 (审批记录列表用) */
const ENTITY_TYPE_LABELS: Record<string, string> = {
  project: '立项',
  project_change: '项目变更',
  monthly_report: '月报',
  material_request: '领料',
  trial_production_order: '试制任务',
  trial_cost_transfer: '试制转嫁',
  outsource_contract: '委外合同',
  capitalization_report: '资本化',
  closing_report: '结项',
};

function entityLabel(t: string) {
  return ENTITY_TYPE_LABELS[t] ?? t;
}

interface ApprovalRecord {
  stepId: number;
  instanceId: number;
  entityType: string;
  entityId: number;
  workflowCode: string;
  stepName: string;
  action: 'approved' | 'rejected';
  actedAt: string | null;
  comments: string | null;
}

function actionBadge(action: ApprovalRecord['action']) {
  if (action === 'approved')
    return (
      <Badge className="bg-emerald-600 text-white border-transparent font-normal">
        通过
      </Badge>
    );
  return (
    <Badge className="bg-rose-600 text-white border-transparent font-normal">
      驳回
    </Badge>
  );
}

export default function MyApprovalsPage() {
  const [records, setRecords] = useState<ApprovalRecord[] | null>(null);

  useEffect(() => {
    fetch('/api/workflow/my-approvals')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => setRecords(j?.data ?? []))
      .catch(() => setRecords([]));
  }, []);

  const total = records?.length ?? 0;
  const approvedCount = records?.filter((r) => r.action === 'approved').length ?? 0;
  const rejectedCount = records?.filter((r) => r.action === 'rejected').length ?? 0;

  return (
    <div className="max-w-[100rem] mx-auto px-6 py-6">
      <div className="mb-4">
        <Link
          href="/workbench"
          className="text-xs text-muted-foreground hover:text-slate-900 inline-flex items-center gap-1 mb-2"
        >
          <ArrowLeft size={12} />
          返回工作台
        </Link>
        <h1 className="text-xl md:text-2xl font-semibold tracking-tight text-slate-900 flex items-center gap-2">
          <ClipboardCheck size={20} className="text-blue-600" />
          我的审批记录
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          我处理过的所有审批动作
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-4 text-sm text-slate-600 tabular-nums">
        {records === null ? (
          <Skeleton className="h-5 w-48" />
        ) : (
          <span>
            共 {total} 条 ·{' '}
            <span className="text-emerald-700 font-medium">{approvedCount} 通过</span>{' '}
            · <span className="text-rose-700 font-medium">{rejectedCount} 驳回</span>
          </span>
        )}
      </div>

      <Card className="border-slate-300 shadow-md">
        <CardContent className="p-0">
          {records === null ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : records.length === 0 ? (
            <div className="px-3 py-16 text-center text-sm text-muted-foreground">
              暂无审批记录
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>时间</TableHead>
                  <TableHead>单据类型</TableHead>
                  <TableHead>步骤名</TableHead>
                  <TableHead>动作</TableHead>
                  <TableHead>备注</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map((r) => (
                  <TableRow key={r.stepId} className="hover:bg-blue-50/50">
                    <TableCell className="font-mono text-xs tabular-nums text-slate-600 py-2 whitespace-nowrap">
                      {r.actedAt
                        ? new Date(r.actedAt).toLocaleString('zh-CN')
                        : '—'}
                    </TableCell>
                    <TableCell className="py-2">
                      <Badge variant="secondary" className="font-normal">
                        {entityLabel(r.entityType)}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-sm">{r.stepName}</TableCell>
                    <TableCell className="py-2">{actionBadge(r.action)}</TableCell>
                    <TableCell className="py-2 text-sm text-slate-600 max-w-xs truncate">
                      {r.comments || '—'}
                    </TableCell>
                    <TableCell className="py-2 text-right">
                      <Link
                        href={`/approval/${r.instanceId}`}
                        className="text-blue-600 hover:text-blue-700 hover:underline text-sm inline-flex items-center gap-1"
                      >
                        查看
                        <ArrowRight size={12} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
