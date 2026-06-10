'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
}
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

export default function NewSamplePage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [type, setType] = useState<'sample' | 'scrap'>('sample');
  const [form, setForm] = useState({
    projectId: 0,
    materialId: 0,
    warehouseId: 0,
    consumedQty: '' as string,
    productName: '',
    productQty: '' as string,
    productUnit: '',
    disposalMethod: 'retained' as
      | 'retained'
      | 'destroyed'
      | 'sold'
      | 'internal_use',
    disposalIncome: '' as string,
    note: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
    fetch('/api/materials')
      .then((r) => r.json())
      .then((j) => setMaterials(j.data ?? []));
    fetch('/api/warehouses')
      .then((r) => r.json())
      .then((j) => setWarehouses(j.data ?? []));
  }, []);

  function validate(): string | null {
    if (!form.projectId) return '项目必选';
    if (!form.materialId) return '物料必选';
    if (!form.warehouseId) return '仓库必选';
    const q = Number(form.consumedQty);
    if (!(q > 0)) return '消耗量必须 > 0';
    if (type === 'sample' && !form.productName.trim())
      return '样品名必填 (废料可空)';
    if (form.disposalMethod === 'sold') {
      const inc = Number(form.disposalIncome);
      if (!(inc > 0)) return '出售时必须填收入金额';
    }
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
      const body: Record<string, unknown> = {
        projectId: form.projectId,
        type,
        materialId: form.materialId,
        warehouseId: form.warehouseId,
        consumedQty: Number(form.consumedQty),
        disposalMethod: form.disposalMethod,
      };
      if (form.productName) body.productName = form.productName;
      if (form.productQty) body.productQty = Number(form.productQty);
      if (form.productUnit) body.productUnit = form.productUnit;
      if (form.disposalMethod === 'sold')
        body.disposalIncome = Number(form.disposalIncome);
      if (form.note) body.note = form.note;

      const r = await fetch('/api/samples', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已登记 ${j.data.docNo}`);
      router.push('/samples');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-8 py-6 space-y-6">
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
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建样品/废料登记
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            登记后状态 = 待监销, 由财务部完成监销; 废料自动写入库存账本
          </p>
        </div>
        <Button onClick={submit} disabled={saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          提交登记
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>类型</Label>
            <Tabs
              value={type}
              onValueChange={(v) => setType(v as 'sample' | 'scrap')}
            >
              <TabsList>
                <TabsTrigger value="sample">样品</TabsTrigger>
                <TabsTrigger value="scrap">废料</TabsTrigger>
              </TabsList>
            </Tabs>
            <p className="text-xs text-muted-foreground">
              {type === 'sample'
                ? '合格品留样 — 不重复扣库存 (出库已扣过)'
                : '废料 — 自动写一条 scrap 流水, 扣减库存'}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>项目</Label>
            <Select
              value={form.projectId ? String(form.projectId) : ''}
              onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择 active 项目" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name} ({p.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label>原料</Label>
              <Select
                value={form.materialId ? String(form.materialId) : ''}
                onValueChange={(v) => setForm({ ...form, materialId: Number(v) })}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="请选择原料" />
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
                onValueChange={(v) =>
                  setForm({ ...form, warehouseId: Number(v) })
                }
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
            <div className="space-y-1.5">
              <Label htmlFor="cqty">消耗量</Label>
              <Input
                id="cqty"
                type="number"
                step="0.01"
                min="0"
                value={form.consumedQty}
                onChange={(e) =>
                  setForm({ ...form, consumedQty: e.target.value })
                }
                className="font-mono tabular-nums"
              />
            </div>
          </div>

          <fieldset className="space-y-3 rounded-md border border-slate-200 p-4">
            <legend className="px-1 text-xs font-medium text-slate-700">
              产出 {type === 'scrap' ? '(废料可不填)' : ''}
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="pname">名称</Label>
                <Input
                  id="pname"
                  value={form.productName}
                  onChange={(e) =>
                    setForm({ ...form, productName: e.target.value })
                  }
                  placeholder={type === 'sample' ? '样品 A' : '废料形态描述'}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pqty">数量</Label>
                <Input
                  id="pqty"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.productQty}
                  onChange={(e) =>
                    setForm({ ...form, productQty: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="punit">单位</Label>
                <Input
                  id="punit"
                  value={form.productUnit}
                  onChange={(e) =>
                    setForm({ ...form, productUnit: e.target.value })
                  }
                  placeholder="件 / kg"
                />
              </div>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>处置方式</Label>
              <Select
                value={form.disposalMethod}
                onValueChange={(v) =>
                  setForm({
                    ...form,
                    disposalMethod: v as typeof form.disposalMethod,
                  })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="retained">留样</SelectItem>
                  <SelectItem value="destroyed">销毁</SelectItem>
                  <SelectItem value="sold">出售</SelectItem>
                  <SelectItem value="internal_use">内部使用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.disposalMethod === 'sold' && (
              <div className="space-y-1.5">
                <Label htmlFor="dinc">收入金额 (元)</Label>
                <Input
                  id="dinc"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.disposalIncome}
                  onChange={(e) =>
                    setForm({ ...form, disposalIncome: e.target.value })
                  }
                  className="font-mono tabular-nums"
                />
                <p className="text-xs text-rose-600 flex items-center gap-1">
                  <AlertTriangle size={12} />
                  对外销售收入需冲减项目成本 (制度第 8.3 节)
                </p>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">备注</Label>
            <Textarea
              id="note"
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
