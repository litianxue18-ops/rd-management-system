'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
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

interface Material {
  id: number;
  code: string;
  name: string;
  unit: string;
}
interface Warehouse {
  id: number;
  code: string;
  name: string;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewInboundPage() {
  const router = useRouter();
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({
    materialId: 0,
    warehouseId: 0,
    quantity: '' as string,
    unitPrice: '' as string,
    changeType: 'inbound' as 'inbound' | 'adjust',
    supplier: '',
    batchNo: '',
    expiryDate: '',
    receivedAt: todayStr(),
    note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/materials')
      .then((r) => r.json())
      .then((j) => setMaterials(j.data ?? []));
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((j) => setWarehouses(j.data ?? []));
  }, []);

  function validate(): string | null {
    if (!form.materialId) return '物料必选';
    if (!form.warehouseId) return '仓库必选';
    const q = Number(form.quantity);
    if (!(q > 0)) return '数量必须 > 0';
    if (!form.receivedAt) return '入库日期必填';
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
      const body: any = {
        materialId: form.materialId,
        warehouseId: form.warehouseId,
        quantity: Number(form.quantity),
        changeType: form.changeType,
        receivedAt: form.receivedAt,
      };
      if (form.unitPrice) body.unitPrice = Number(form.unitPrice);
      if (form.supplier) body.supplier = form.supplier;
      if (form.batchNo) body.batchNo = form.batchNo;
      if (form.expiryDate) body.expiryDate = form.expiryDate;
      if (form.note) body.note = form.note;
      const r = await fetch('/api/inventory/inbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已入库 ${j.data.docNo}`);
      router.push('/inventory/inbound');
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
              href="/inventory/inbound"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              入库单
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建入库
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            提交后自动生成 IN- 单号并同步库存账本
          </p>
        </div>
        <Button onClick={submit} disabled={saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          提交入库
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>物料</Label>
              <Select
                value={form.materialId ? String(form.materialId) : ''}
                onValueChange={(v) => setForm({ ...form, materialId: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择物料" />
                </SelectTrigger>
                <SelectContent>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name} ({m.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>仓库</Label>
              <Select
                value={form.warehouseId ? String(form.warehouseId) : ''}
                onValueChange={(v) => setForm({ ...form, warehouseId: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择仓库" />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.id} value={String(w.id)}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="in-qty">数量</Label>
              <Input
                id="in-qty"
                type="number"
                step="0.01"
                value={form.quantity}
                onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-price">单价 (元)</Label>
              <Input
                id="in-price"
                type="number"
                step="0.01"
                value={form.unitPrice}
                onChange={(e) => setForm({ ...form, unitPrice: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label>类型</Label>
              <Select
                value={form.changeType}
                onValueChange={(v) =>
                  setForm({ ...form, changeType: v as 'inbound' | 'adjust' })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inbound">普通入库</SelectItem>
                  <SelectItem value="adjust">调整</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="in-supplier">供应商</Label>
              <Input
                id="in-supplier"
                value={form.supplier}
                onChange={(e) => setForm({ ...form, supplier: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-batch">批次号</Label>
              <Input
                id="in-batch"
                value={form.batchNo}
                onChange={(e) => setForm({ ...form, batchNo: e.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="in-exp">过期日期</Label>
              <Input
                id="in-exp"
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm({ ...form, expiryDate: e.target.value })}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="in-received">入库日期</Label>
              <Input
                id="in-received"
                type="date"
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="in-note">备注</Label>
            <Textarea
              id="in-note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="选填"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
