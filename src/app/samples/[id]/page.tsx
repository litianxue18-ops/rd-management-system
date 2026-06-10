'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type SampleType = 'sample' | 'scrap';
type Disposal = 'retained' | 'destroyed' | 'sold' | 'internal_use';
type Status = 'draft' | 'supervised';

interface Detail {
  id: number;
  docNo: string;
  projectId: number;
  type: SampleType;
  sourceOutboundId: number | null;
  materialId: number;
  warehouseId: number;
  consumedQty: string;
  productName: string | null;
  productQty: string | null;
  productUnit: string | null;
  disposalMethod: Disposal;
  disposalIncome: string | null;
  note: string | null;
  status: Status;
  registeredById: number;
  supervisedById: number | null;
  registeredAt: string;
  supervisedAt: string | null;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
}

interface Me {
  id: number;
  roles: { code: string }[];
}

const DISPOSAL_LABEL: Record<Disposal, string> = {
  retained: '留样',
  destroyed: '销毁',
  sold: '出售',
  internal_use: '内部使用',
};

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

export default function SampleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [data, setData] = useState<Detail | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/samples/${id}`);
    const j = await r.json();
    if (j.error) {
      toast.error(j.error.message);
      return;
    }
    setData(j.data);
  }

  useEffect(() => {
    load();
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => setMe(j.data));
  }, [id]);

  const canSupervise =
    !!me &&
    me.roles.some(
      (r) => r.code === 'finance_lead' || r.code === 'super_admin',
    );

  async function supervise() {
    setBusy(true);
    try {
      const r = await fetch(`/api/samples/${id}/supervise`, { method: 'POST' });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success('已监销');
      setDialogOpen(false);
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) {
    return (
      <div className="max-w-4xl mx-auto px-8 py-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/samples"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              样品/废料台账
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 flex items-center gap-3">
            <code className="font-mono text-base bg-slate-100 px-2 py-1 rounded tabular-nums">
              {data.docNo}
            </code>
            {data.type === 'sample' ? (
              <Badge className="bg-blue-100 text-blue-800 border-blue-300 hover:bg-blue-100">
                样品
              </Badge>
            ) : (
              <Badge className="bg-rose-100 text-rose-800 border-rose-300 hover:bg-rose-100">
                废料
              </Badge>
            )}
            {data.status === 'supervised' ? (
              <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 hover:bg-emerald-100">
                <CheckCircle2 size={12} className="mr-1" />
                已监销
              </Badge>
            ) : (
              <Badge variant="secondary">待监销</Badge>
            )}
          </h1>
        </div>
        {data.status === 'draft' && canSupervise && (
          <Button onClick={() => setDialogOpen(true)} className="shrink-0">
            <CheckCircle2 size={14} className="mr-1.5" />
            财务监销
          </Button>
        )}
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm">基本信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">项目</dt>
              <dd className="font-medium text-slate-900">{data.project.name}</dd>
              <dd className="text-xs text-muted-foreground font-mono">
                {data.project.code}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">登记时间</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {fmtDateTime(data.registeredAt)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">关联领料单</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {data.sourceOutboundId ?? '—'}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm">原料消耗</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">物料</dt>
              <dd className="font-medium text-slate-900">{data.material.name}</dd>
              <dd className="text-xs text-muted-foreground font-mono">
                {data.material.code}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">消耗量</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {Number(data.consumedQty).toLocaleString()} {data.material.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">仓库 ID</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {data.warehouseId}
              </dd>
            </div>
          </dl>
          {data.type === 'scrap' && (
            <p className="mt-3 text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle size={12} className="text-amber-600" />
              废料已写入库存账本 (scrap, -{Number(data.consumedQty).toLocaleString()}{' '}
              {data.material.unit})
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm">产出与处置</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">产出名称</dt>
              <dd className="font-medium text-slate-900">
                {data.productName ?? <span className="text-muted-foreground">—</span>}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">产出数量</dt>
              <dd className="font-mono tabular-nums text-slate-900">
                {data.productQty
                  ? `${Number(data.productQty).toLocaleString()} ${data.productUnit ?? ''}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">处置方式</dt>
              <dd className="font-medium text-slate-900">
                {DISPOSAL_LABEL[data.disposalMethod]}
                {data.disposalMethod === 'sold' && data.disposalIncome && (
                  <span className="ml-2 text-blue-700 font-mono tabular-nums">
                    +¥{Number(data.disposalIncome).toLocaleString()}
                  </span>
                )}
              </dd>
            </div>
          </dl>
          {data.note && (
            <div className="mt-4">
              <dt className="text-xs text-muted-foreground mb-1">备注</dt>
              <dd className="text-sm text-slate-700 whitespace-pre-wrap p-3 bg-slate-50 rounded-md">
                {data.note}
              </dd>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader>
          <CardTitle className="text-sm">监销</CardTitle>
        </CardHeader>
        <CardContent>
          {data.status === 'supervised' ? (
            <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">监销人 ID</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {data.supervisedById}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">监销时间</dt>
                <dd className="font-mono tabular-nums text-slate-900">
                  {fmtDateTime(data.supervisedAt)}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">
              待财务部完成监销
            </p>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认监销</DialogTitle>
            <DialogDescription>
              {data.docNo} · {data.project.name}
              {data.disposalMethod === 'sold' && data.disposalIncome && (
                <span className="block mt-2 text-rose-600 text-sm">
                  本单含出售收入 ¥{Number(data.disposalIncome).toLocaleString()},
                  监销通过后需冲减项目成本
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={busy}
            >
              取消
            </Button>
            <Button onClick={supervise} disabled={busy}>
              确认监销
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
