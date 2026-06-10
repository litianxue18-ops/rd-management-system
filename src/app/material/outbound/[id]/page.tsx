'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ChevronRight,
  Send,
  X,
  Check,
  PackageMinus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApprovalHistory } from '@/components/approval-history';
import { UsageRegister } from './usage-register';
import { LifecycleTimeline } from './lifecycle-timeline';
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'reviewing'
  | 'approved'
  | 'issued'
  | 'rejected'
  | 'cancelled'
  | 'returned';

interface OutboundDetail {
  id: number;
  docNo: string;
  projectId: number;
  materialId: number;
  warehouseId: number;
  requestedQty: string;
  issuedQty: string;
  returnedQty: string;
  purpose: string;
  status: Status;
  requesterId: number;
  approvedById: number | null;
  issuedById: number | null;
  rejectedReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  issuedAt: string | null;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
  returns: Array<{
    id: number;
    quantity: string;
    reason: string | null;
    returnedAt: string;
  }>;
}

interface Me {
  id: number;
  name: string;
}

interface Step {
  id: number;
  stepIndex: number;
  stepName: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
  assignedUserId: number | null;
}
interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  currentStepId: number | null;
  steps: Step[];
}

function statusBadge(s: Status) {
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'reviewing')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-emerald-800 border-emerald-300 bg-emerald-100">
        待出库
      </Badge>
    );
  if (s === 'issued')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">已出库</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  if (s === 'cancelled') return <Badge variant="secondary">已撤回</Badge>;
  if (s === 'returned') return <Badge variant="secondary">已退库</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function OutboundDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [outbound, setOutbound] = useState<OutboundDetail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [memberIds, setMemberIds] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/inventory/outbound/${id}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=material_request&entityId=${id}`,
      ).then((x) => x.json()),
    ]);
    setOutbound(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
    // 项目成员 (用于判断当前用户能否登记消耗)
    if (r.data?.projectId) {
      const p = await fetch(`/api/projects/${r.data.projectId}`).then((x) =>
        x.json(),
      );
      const ids: number[] = (p.data?.members ?? []).map(
        (mm: { userId: number }) => mm.userId,
      );
      if (p.data?.leadUserId) ids.push(p.data.leadUserId);
      setMemberIds(ids);
    }
  }

  useEffect(() => {
    if (!isFinite(id)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'material_request_v1',
          entityId: id,
        }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已提交审批');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function withdrawInstance(instanceId: number) {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instanceId }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已撤回');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!outbound) {
    return (
      <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isRequester = me?.id === outbound.requesterId;
  const canEdit = outbound.status === 'draft' && isRequester;

  const runningInst = instances.find((i) => i.status === 'running');
  const currentStep = runningInst?.steps.find(
    (s) => s.id === runningInst.currentStepId,
  );
  const canApprove =
    !!currentStep &&
    currentStep.assignedUserId === me?.id &&
    currentStep.status === 'pending';
  const canWithdraw =
    !!runningInst &&
    runningInst.submittedBy === me?.id &&
    runningInst.steps.find((s) => s.stepIndex === 1)?.status === 'pending';

  const canReturn = outbound.status === 'issued' && isRequester;

  // 消耗登记: status issued/returned 且 当前用户=领料人 或 项目成员
  const isMember = !!me && memberIds.includes(me.id);
  const canRegisterUsage =
    (outbound.status === 'issued' || outbound.status === 'returned') &&
    (isRequester || isMember);

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/material/outbound"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              领料申请
            </Link>
            <ChevronRight size={12} />
            <span>领料详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {outbound.project.name}
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">
              {outbound.docNo}
            </code>
            {statusBadge(outbound.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
              {outbound.project.code}
            </code>
            <span>·</span>
            <span>申请于 {fmtDate(outbound.createdAt)}</span>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {canEdit && (
            <Button onClick={submitForApproval} disabled={busy}>
              <Send size={14} className="mr-1.5" />
              提交审批
            </Button>
          )}
          {canWithdraw && runningInst && (
            <Button
              variant="outline"
              onClick={() => withdrawInstance(runningInst.id)}
              disabled={busy}
            >
              <X size={14} className="mr-1.5" />
              撤回审批
            </Button>
          )}
          {canApprove && runningInst && (
            <Button asChild>
              <Link href={`/approval/${runningInst.id}`}>
                <Check size={14} className="mr-1.5" />
                处理审批
              </Link>
            </Button>
          )}
          {canReturn && (
            <Button variant="outline" asChild>
              <Link href={`/material/outbound/${id}/return`}>
                <PackageMinus size={14} className="mr-1.5" />
                退库
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">物料</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {outbound.material.name}
                <span className="text-xs text-muted-foreground ml-1">
                  ({outbound.material.unit})
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">仓库</dt>
              <dd className="font-medium text-slate-900 mt-0.5">
                {outbound.warehouse.name}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">申请数量</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {Number(outbound.requestedQty).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">已出库 / 已退库</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {Number(outbound.issuedQty).toLocaleString()} /{' '}
                {Number(outbound.returnedQty).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">批准时间</dt>
              <dd className="text-slate-700 mt-0.5 tabular-nums">
                {fmtDate(outbound.approvedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">出库时间</dt>
              <dd className="text-slate-700 mt-0.5 tabular-nums">
                {fmtDate(outbound.issuedAt)}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">用途</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {outbound.purpose || (
              <span className="text-muted-foreground">—</span>
            )}
          </div>
        </CardContent>
      </Card>

      {outbound.rejectedReason && (
        <Card className="border-rose-200 shadow-sm rounded-xl bg-rose-50/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold text-rose-700">
              驳回原因
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-rose-700 whitespace-pre-wrap leading-relaxed">
              {outbound.rejectedReason}
            </div>
          </CardContent>
        </Card>
      )}

      {outbound.returns.length > 0 && (
        <Card className="border-slate-300 shadow-md rounded-xl">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">退库记录</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-slate-100">
              {outbound.returns.map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between py-2.5"
                >
                  <div className="text-sm text-slate-700">
                    <span className="font-mono tabular-nums">
                      {Number(r.quantity).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {r.reason ?? '—'}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">
                    {fmtDate(r.returnedAt)}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {(outbound.status === 'issued' || outbound.status === 'returned') && (
        <>
          <UsageRegister
            outboundId={id}
            unit={outbound.material.unit}
            canRegister={canRegisterUsage}
          />
          <LifecycleTimeline outboundId={id} unit={outbound.material.unit} />
        </>
      )}

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批历史</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType="material_request" entityId={id} />
        </CardContent>
      </Card>
    </div>
  );
}
