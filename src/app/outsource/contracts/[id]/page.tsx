'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Send, X, Check, Receipt } from 'lucide-react';
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
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'reviewing'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled';

interface Payment {
  id: number;
  amount: string;
  paidDate: string;
  installmentNo: number;
  note: string | null;
}

interface Detail {
  id: number;
  contractNo: string;
  projectId: number;
  supplierId: number;
  title: string;
  scope: string;
  ipOwnership: string;
  totalAmount: string;
  signedDate: string;
  startDate: string;
  endDate: string;
  status: Status;
  requesterId: number;
  rejectedReason: string | null;
  createdAt: string;
  project: { id: number; code: string; name: string };
  supplier: {
    id: number;
    code: string;
    name: string;
    contactPerson: string | null;
    contactPhone: string | null;
  };
  payments: Payment[];
}

interface Me {
  id: number;
  name: string;
}

interface Instance {
  id: number;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  currentStepId: number | null;
  steps: Array<{
    id: number;
    stepIndex: number;
    status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
    assignedUserId: number | null;
  }>;
}

function statusBadge(s: Status) {
  if (s === 'draft') return <Badge variant="secondary">草稿</Badge>;
  if (s === 'reviewing')
    return (
      <Badge className="bg-blue-600 text-white border-blue-700 hover:bg-blue-600">审批中</Badge>
    );
  if (s === 'active')
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
        执行中
      </Badge>
    );
  if (s === 'completed')
    return (
      <Badge className="bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-100">
        已完成
      </Badge>
    );
  if (s === 'rejected')
    return (
      <Badge className="bg-rose-600 text-white border-rose-700 hover:bg-rose-600">已驳回</Badge>
    );
  return <Badge variant="secondary">已取消</Badge>;
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fmtDateTime(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function OutsourceContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const contractId = Number(id);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [busy, setBusy] = useState(false);

  async function loadAll() {
    const [r, m, ins] = await Promise.all([
      fetch(`/api/outsource/contracts/${contractId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
      fetch(
        `/api/workflow/instances?entityType=outsource_contract&entityId=${contractId}`,
      ).then((x) => x.json()),
    ]);
    setData(r.data ?? null);
    setMe(m.data ?? null);
    setInstances(ins.data ?? []);
  }

  useEffect(() => {
    if (!Number.isFinite(contractId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  async function submitForApproval() {
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          workflowCode: 'outsource_contract_v1',
          entityId: contractId,
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

  if (!data) {
    return (
      <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const isRequester = me?.id === data.requesterId;
  const canEdit = data.status === 'draft' && isRequester;
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

  const paidTotal = data.payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const remaining = Number(data.totalAmount) - paidTotal;

  return (
    <div className="max-w-5xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/outsource/contracts"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              委外合同
            </Link>
            <ChevronRight size={12} />
            <span>合同详情</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              {data.title}
            </h1>
            <code className="font-mono text-sm tabular-nums text-slate-600">
              {data.contractNo}
            </code>
            {statusBadge(data.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span>项目</span>
            <Link
              href={`/projects/${data.projectId}`}
              className="hover:text-slate-900"
            >
              {data.project.name}
            </Link>
            <code className="font-mono bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
              {data.project.code}
            </code>
            <span>·</span>
            <span>供应商</span>
            <span className="text-slate-700">{data.supplier.name}</span>
            <span>·</span>
            <span>创建于 {fmtDateTime(data.createdAt)}</span>
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
          {data.status === 'active' && (
            <Button asChild variant="outline">
              <Link href={`/outsource/contracts/${data.id}/payments`}>
                <Receipt size={14} className="mr-1.5" />
                去登记付款
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">合同信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">总金额</dt>
              <dd className="font-mono tabular-nums text-lg font-semibold text-slate-900 mt-0.5">
                ¥{Number(data.totalAmount).toLocaleString()}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">签订日期</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {fmtDate(data.signedDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">开始</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {fmtDate(data.startDate)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">结束</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {fmtDate(data.endDate)}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-4">
              <dt className="text-xs text-muted-foreground">范围</dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md mt-1">
                {data.scope}
              </dd>
            </div>
            <div className="col-span-2 md:col-span-4">
              <dt className="text-xs text-muted-foreground">
                成果归属 <span className="text-rose-600">(制度 6.5)</span>
              </dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-amber-50/60 border border-amber-100 rounded-md mt-1">
                {data.ipOwnership}
              </dd>
            </div>
            {data.supplier.contactPerson && (
              <div>
                <dt className="text-xs text-muted-foreground">供应商联系人</dt>
                <dd className="text-slate-900 mt-0.5">
                  {data.supplier.contactPerson}{' '}
                  {data.supplier.contactPhone && (
                    <span className="text-xs text-muted-foreground font-mono tabular-nums">
                      {data.supplier.contactPhone}
                    </span>
                  )}
                </dd>
              </div>
            )}
            {data.rejectedReason && (
              <div className="col-span-2 md:col-span-4">
                <dt className="text-xs text-muted-foreground">驳回原因</dt>
                <dd className="text-sm text-rose-700 whitespace-pre-wrap p-3 bg-rose-50 rounded-md mt-1">
                  {data.rejectedReason}
                </dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold flex items-center gap-3 flex-wrap">
            <span>付款记录</span>
            <span className="text-xs font-normal text-muted-foreground">
              共 {data.payments.length} 期 · 已付{' '}
              <span className="font-mono tabular-nums text-slate-900">
                ¥{paidTotal.toLocaleString()}
              </span>{' '}
              · 剩余{' '}
              <span className="font-mono tabular-nums text-amber-700">
                ¥{remaining.toLocaleString()}
              </span>
            </span>
            <Link
              href={`/outsource/contracts/${data.id}/payments`}
              className="ml-auto text-xs text-blue-700 hover:underline"
            >
              查看 / 登记付款 →
            </Link>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.payments.length === 0 ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              暂无付款记录
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.payments.map((p) => (
                <li key={p.id} className="py-2 flex items-center gap-3">
                  <Badge variant="secondary" className="font-normal">
                    第 {p.installmentNo} 期
                  </Badge>
                  <span className="font-mono tabular-nums font-medium text-slate-900">
                    ¥{Number(p.amount).toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {fmtDate(p.paidDate)}
                  </span>
                  {p.note && (
                    <span className="text-xs text-muted-foreground truncate">
                      {p.note}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            审批历史 (4 步: 研发中心 → 技委会 → 财务部 → 总经理)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory
            entityType="outsource_contract"
            entityId={contractId}
          />
        </CardContent>
      </Card>
    </div>
  );
}
