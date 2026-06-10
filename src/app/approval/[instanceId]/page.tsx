'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Check, X, ArrowRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ApprovalHistory } from '@/components/approval-history';
import { toast } from 'sonner';

interface Step {
  id: number;
  stepIndex: number;
  stepName: string;
  requiredRole: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped' | 'transferred';
  assignedUserId: number | null;
}

interface Instance {
  id: number;
  entityType: string;
  entityId: number;
  workflowCode: string;
  status: 'draft' | 'running' | 'approved' | 'rejected' | 'cancelled';
  submittedBy: number;
  submittedAt: string;
  finishedAt: string | null;
  currentStepId: number | null;
  steps: Step[];
  entitySummary: { name?: string; code?: string } | null;
}

interface Me {
  id: number;
}

interface User {
  id: number;
  name: string;
  username: string;
}

function statusBadge(s: Instance['status']) {
  if (s === 'running')
    return (
      <Badge variant="outline" className="text-white border-blue-700 bg-blue-600">审批中</Badge>
    );
  if (s === 'approved')
    return (
      <Badge variant="outline" className="text-white border-emerald-700 bg-emerald-600">已通过</Badge>
    );
  if (s === 'rejected')
    return (
      <Badge variant="outline" className="text-white border-rose-700 bg-rose-600">已驳回</Badge>
    );
  if (s === 'cancelled') return <Badge variant="secondary">已撤回</Badge>;
  return <Badge variant="secondary">草稿</Badge>;
}

function entityHref(entityType: string, entityId: number) {
  if (entityType === 'project') return `/projects/${entityId}`;
  // for project_change we don't know the parent project id from instance alone — store summary code prefix
  return null;
}

export default function ApprovalDetailPage() {
  const params = useParams<{ instanceId: string }>();
  const router = useRouter();
  const instanceId = Number(params.instanceId);
  const [inst, setInst] = useState<Instance | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [busy, setBusy] = useState(false);

  // Dialog state
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [comments, setComments] = useState('');
  const [transferTo, setTransferTo] = useState<number>(0);

  async function loadAll() {
    const [i, m, u] = await Promise.all([
      fetch(`/api/workflow/instances/${instanceId}`).then((r) => r.json()),
      fetch('/api/auth/me').then((r) => r.json()),
      fetch('/api/users').then((r) => r.json()),
    ]);
    setInst(i.data ?? null);
    setMe(m.data ?? null);
    setUsers(u.data ?? []);
  }

  useEffect(() => {
    if (!isFinite(instanceId)) return;
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId]);

  async function doApprove() {
    if (!inst?.currentStepId) return;
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/approve', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepId: inst.currentStepId, comments: comments || undefined }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已通过');
        setApproveOpen(false);
        setComments('');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doReject() {
    if (!inst?.currentStepId) return;
    if (!comments.trim()) {
      toast.error('驳回需填写意见');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/reject', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stepId: inst.currentStepId, comments }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已驳回');
        setRejectOpen(false);
        setComments('');
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doTransfer() {
    if (!inst?.currentStepId) return;
    if (!transferTo) {
      toast.error('请选择转交目标');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/transfer', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          stepId: inst.currentStepId,
          toUserId: transferTo,
          comments: comments || undefined,
        }),
      });
      const j = await r.json();
      if (j.error) toast.error(j.error.message);
      else {
        toast.success('已转交');
        setTransferOpen(false);
        setComments('');
        setTransferTo(0);
        loadAll();
      }
    } finally {
      setBusy(false);
    }
  }

  async function doWithdraw() {
    if (!inst) return;
    setBusy(true);
    try {
      const r = await fetch('/api/workflow/withdraw', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ instanceId: inst.id }),
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

  if (!inst) {
    return (
      <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const currentStep = inst.steps.find((s) => s.id === inst.currentStepId);
  const canAct =
    !!currentStep &&
    currentStep.status === 'pending' &&
    currentStep.assignedUserId === me?.id;
  const canWithdraw =
    inst.status === 'running' &&
    inst.submittedBy === me?.id &&
    inst.steps.find((s) => s.stepIndex === 1)?.status === 'pending';
  const entityLink = entityHref(inst.entityType, inst.entityId);

  return (
    <div className="max-w-7xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link href="/todo" className="hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} />
              我的待办
            </Link>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
              审批 #{inst.id}
            </h1>
            {statusBadge(inst.status)}
          </div>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
            <span>workflow: <code className="font-mono">{inst.workflowCode}</code></span>
            <span>·</span>
            <span>entity: <code className="font-mono">{inst.entityType}#{inst.entityId}</code></span>
            {entityLink && (
              <>
                <span>·</span>
                <Link href={entityLink} className="text-blue-700 hover:underline">
                  查看业务实体
                </Link>
              </>
            )}
          </div>
        </div>
        <div className="flex gap-2 shrink-0 flex-wrap">
          {canAct && (
            <>
              <Button onClick={() => setApproveOpen(true)} disabled={busy}>
                <Check size={14} className="mr-1.5" />
                通过
              </Button>
              <Button
                variant="outline"
                onClick={() => setRejectOpen(true)}
                disabled={busy}
                className="text-rose-700 hover:text-rose-800 border-rose-200"
              >
                <X size={14} className="mr-1.5" />
                驳回
              </Button>
              <Button
                variant="outline"
                onClick={() => setTransferOpen(true)}
                disabled={busy}
              >
                <ArrowRight size={14} className="mr-1.5" />
                转交
              </Button>
            </>
          )}
          {canWithdraw && (
            <Button variant="outline" onClick={doWithdraw} disabled={busy}>
              <RotateCcw size={14} className="mr-1.5" />
              撤回
            </Button>
          )}
        </div>
      </div>

      {/* 业务实体摘要 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">业务实体</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1.5">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-muted-foreground">类型:</span>
            <Badge variant="secondary" className="font-normal">
              {inst.entityType}
            </Badge>
          </div>
          {inst.entitySummary?.name && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">名称:</span>
              <span className="font-medium">{inst.entitySummary.name}</span>
            </div>
          )}
          {inst.entitySummary?.code && !inst.entitySummary.code.startsWith('DRAFT-') && (
            <div className="flex items-center gap-3">
              <span className="text-muted-foreground">编号:</span>
              <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                {inst.entitySummary.code}
              </code>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 当前步 */}
      {currentStep && (
        <Card className="border-slate-300 shadow-md">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">当前待处理</CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <span className="text-muted-foreground">步骤:</span>
              <span className="ml-2 font-medium">
                {currentStep.stepIndex}. {currentStep.stepName}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">需要角色:</span>
              <code className="ml-2 font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                {currentStep.requiredRole}
              </code>
            </div>
            <div>
              <span className="text-muted-foreground">分配给:</span>
              <span className="ml-2">
                {users.find((u) => u.id === currentStep.assignedUserId)?.name ??
                  (currentStep.assignedUserId
                    ? `#${currentStep.assignedUserId}`
                    : '未分配')}
              </span>
            </div>
            {!canAct && (
              <div className="text-xs text-muted-foreground pt-1">
                你不是当前步处理人,只能查看
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 审批历史 */}
      <Card className="border-slate-300 shadow-md">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">审批时间轴</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalHistory entityType={inst.entityType} entityId={inst.entityId} />
        </CardContent>
      </Card>

      {/* 通过 dialog */}
      <Dialog open={approveOpen} onOpenChange={setApproveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>通过审批</DialogTitle>
            <DialogDescription>可选填审批意见</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="approve-comments">审批意见 (可选)</Label>
            <Textarea
              id="approve-comments"
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="如有需要补充的信息"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setApproveOpen(false)}>取消</Button>
            <Button onClick={doApprove} disabled={busy}>
              确认通过
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 驳回 dialog */}
      <Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>驳回审批</DialogTitle>
            <DialogDescription>驳回必须填写原因</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="reject-comments">驳回原因</Label>
            <Textarea
              id="reject-comments"
              rows={4}
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              placeholder="请详细说明驳回理由"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRejectOpen(false)}>取消</Button>
            <Button
              onClick={doReject}
              disabled={busy}
              className="bg-rose-600 hover:bg-rose-700"
            >
              确认驳回
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 转交 dialog */}
      <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>转交审批</DialogTitle>
            <DialogDescription>
              转交目标必须拥有相同角色 ({currentStep?.requiredRole})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>转交给</Label>
              <Select
                value={transferTo ? String(transferTo) : ''}
                onValueChange={(v) => setTransferTo(Number(v))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择目标用户" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((u) => u.id !== me?.id)
                    .map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.name} ({u.username})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="transfer-comments">备注 (可选)</Label>
              <Textarea
                id="transfer-comments"
                rows={3}
                value={comments}
                onChange={(e) => setComments(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTransferOpen(false)}>取消</Button>
            <Button onClick={doTransfer} disabled={busy}>
              确认转交
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
