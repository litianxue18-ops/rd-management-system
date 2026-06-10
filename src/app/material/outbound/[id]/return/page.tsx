'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, PackageMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

interface OutboundDetail {
  id: number;
  docNo: string;
  status: string;
  issuedQty: string;
  returnedQty: string;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
}

export default function ReturnPage() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const router = useRouter();
  const [outbound, setOutbound] = useState<OutboundDetail | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch(`/api/inventory/outbound/${id}`);
    const j = await r.json();
    setOutbound(j.data ?? null);
  }

  useEffect(() => {
    if (!isFinite(id)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!outbound) {
    return (
      <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const issued = Number(outbound.issuedQty);
  const returned = Number(outbound.returnedQty);
  const remaining = issued - returned;
  const isReturnable = outbound.status === 'issued' && remaining > 0;

  async function submit() {
    if (!outbound) return;
    const qty = Number(quantity);
    if (!(qty > 0)) {
      toast.error('退库数量必须 > 0');
      return;
    }
    if (qty > remaining) {
      toast.error(`退库数量不能超过可退量 ${remaining}`);
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/inventory/returns', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outboundId: outbound.id,
          quantity: qty,
          reason: reason || undefined,
        }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success('已退库');
      router.push(`/material/outbound/${id}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
          <Link
            href={`/material/outbound/${id}`}
            className="hover:text-slate-900 inline-flex items-center gap-1"
          >
            <ArrowLeft size={12} />
            领料详情
          </Link>
          <ChevronRight size={12} />
          <span>退库</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            退库
          </h1>
          <code className="font-mono text-sm tabular-nums text-slate-600">
            {outbound.docNo}
          </code>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">领料信息</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">项目</dt>
              <dd className="font-medium text-slate-900 mt-0.5 truncate">
                {outbound.project.name}
              </dd>
            </div>
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
              <dt className="text-xs text-muted-foreground">已出库</dt>
              <dd className="font-mono tabular-nums text-slate-900 mt-0.5">
                {issued.toLocaleString()} {outbound.material.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">已退库</dt>
              <dd className="font-mono tabular-nums text-slate-700 mt-0.5">
                {returned.toLocaleString()} {outbound.material.unit}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">可退</dt>
              <dd className="font-mono tabular-nums text-blue-700 font-semibold mt-0.5">
                {remaining.toLocaleString()} {outbound.material.unit}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">退库信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!isReturnable && (
            <div className="text-sm text-rose-800 bg-rose-100 border border-rose-300 rounded-md px-3 py-2">
              {outbound.status !== 'issued'
                ? `当前状态 ${outbound.status}, 仅已出库的领料单可退库`
                : '没有可退库存'}
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="quantity">退库数量</Label>
            <Input
              id="quantity"
              type="number"
              step="0.5"
              min="0"
              max={remaining}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={!isReturnable || busy}
              className="font-mono tabular-nums"
              placeholder={`最多 ${remaining}`}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="reason">退库原因</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              disabled={!isReturnable || busy}
              rows={3}
              placeholder="选填: 用剩 / 规格不符 / 项目调整 ..."
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" asChild>
              <Link href={`/material/outbound/${id}`}>取消</Link>
            </Button>
            <Button
              onClick={submit}
              disabled={!isReturnable || busy}
            >
              <PackageMinus size={14} className="mr-1.5" />
              提交退库
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
