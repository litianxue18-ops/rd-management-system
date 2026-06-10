'use client';
import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface TrialOrder {
  id: number;
  docNo: string;
  title: string;
  status: string;
  project: { id: number; code: string; name: string };
}

function NewTransferInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const preselectOrderId = sp.get('orderId');

  const [orders, setOrders] = useState<TrialOrder[]>([]);
  const [form, setForm] = useState({
    trialOrderId: 0,
    laborCost: '' as string,
    machineCost: '' as string,
    materialCost: '' as string,
    description: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/trial/orders?status=completed')
      .then((r) => r.json())
      .then((j) => {
        const list = (j.data ?? []) as TrialOrder[];
        setOrders(list);
        if (preselectOrderId) {
          const pid = Number(preselectOrderId);
          if (list.some((o) => o.id === pid)) {
            setForm((f) => ({ ...f, trialOrderId: pid }));
          }
        }
      });
  }, [preselectOrderId]);

  const total = useMemo(() => {
    const l = Number(form.laborCost) || 0;
    const m = Number(form.machineCost) || 0;
    const mat = Number(form.materialCost) || 0;
    return l + m + mat;
  }, [form.laborCost, form.machineCost, form.materialCost]);

  function validate(): string | null {
    if (!form.trialOrderId) return '试制任务必选';
    if (Number(form.laborCost || 0) < 0) return '人工费不能为负';
    if (Number(form.machineCost || 0) < 0) return '机台费不能为负';
    if (Number(form.materialCost || 0) < 0) return '材料费不能为负';
    if (!(total > 0)) return '总额必须 > 0';
    if (!form.description.trim()) return '转嫁说明必填';
    return null;
  }

  async function submit() {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const body = {
        trialOrderId: form.trialOrderId,
        laborCost: Number(form.laborCost || 0),
        machineCost: Number(form.machineCost || 0),
        materialCost: Number(form.materialCost || 0),
        description: form.description,
      };
      const r = await fetch('/api/trial/transfers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已保存草稿 ${j.data.docNo}`);
      router.push(`/trial/transfers/${j.data.id}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/trial/transfers"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              试制费用转嫁单
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建试制费用转嫁单
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            仅完成的试制任务可发起; 保存草稿后, 在详情页提交 4 步审批
          </p>
        </div>
        <Button onClick={submit} disabled={saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          保存草稿
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>试制任务</Label>
            <Select
              value={form.trialOrderId ? String(form.trialOrderId) : ''}
              onValueChange={(v) =>
                setForm({ ...form, trialOrderId: Number(v) })
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择已完成的试制任务" />
              </SelectTrigger>
              <SelectContent>
                {orders.length === 0 && (
                  <div className="text-xs text-muted-foreground px-3 py-2">
                    暂无已完成的试制任务
                  </div>
                )}
                {orders.map((o) => (
                  <SelectItem key={o.id} value={String(o.id)}>
                    {o.docNo} · {o.title} ({o.project.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-xs font-medium text-slate-700">
              费用明细 (元)
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="lc">人工费</Label>
                <Input
                  id="lc"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.laborCost}
                  onChange={(e) =>
                    setForm({ ...form, laborCost: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mc">机台费</Label>
                <Input
                  id="mc"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.machineCost}
                  onChange={(e) =>
                    setForm({ ...form, machineCost: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="matc">材料费</Label>
                <Input
                  id="matc"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.materialCost}
                  onChange={(e) =>
                    setForm({ ...form, materialCost: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
              </div>
            </div>
            <div className="flex items-baseline justify-end gap-2 pt-2 border-t border-slate-200">
              <span className="text-xs text-muted-foreground">总额:</span>
              <span className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
                ¥{total.toLocaleString()}
              </span>
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <Label htmlFor="desc">转嫁说明</Label>
            <Textarea
              id="desc"
              rows={5}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="附原始工时 / 机台运行记录 / 物料消耗清单 等"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function NewTransferPage() {
  return (
    <Suspense fallback={<div className="px-4 md:px-8 py-6">加载中…</div>}>
      <NewTransferInner />
    </Suspense>
  );
}
