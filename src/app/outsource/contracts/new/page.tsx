'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Plus } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Project {
  id: number;
  code: string;
  name: string;
}

interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function NewContractPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);

  const [supplierForm, setSupplierForm] = useState({
    code: '',
    name: '',
    contactPerson: '',
    contactPhone: '',
  });
  const [creatingSupplier, setCreatingSupplier] = useState(false);

  const [form, setForm] = useState({
    contractNo: '',
    projectId: 0,
    supplierId: 0,
    title: '',
    scope: '',
    ipOwnership: '本次委外加工形成的工艺、数据、模具、专利等成果归我方所有。',
    totalAmount: '' as string,
    signedDate: todayStr(),
    startDate: todayStr(),
    endDate: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/projects?status=active')
      .then((r) => r.json())
      .then((j) => setProjects(j.data ?? []));
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    const r = await fetch('/api/outsource/suppliers');
    const j = await r.json();
    setSuppliers(j.data ?? []);
  }

  async function submitSupplier() {
    if (!supplierForm.code.trim() || !supplierForm.name.trim()) {
      toast.error('编码 / 名称必填');
      return;
    }
    setCreatingSupplier(true);
    try {
      const r = await fetch('/api/outsource/suppliers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(supplierForm),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已新建供应商 ${j.data.name}`);
      await loadSuppliers();
      setForm((f) => ({ ...f, supplierId: j.data.id }));
      setSupplierDialogOpen(false);
      setSupplierForm({
        code: '',
        name: '',
        contactPerson: '',
        contactPhone: '',
      });
    } finally {
      setCreatingSupplier(false);
    }
  }

  function validate(): string | null {
    if (!form.contractNo.trim()) return '合同号必填';
    if (!form.projectId) return '项目必选';
    if (!form.supplierId) return '供应商必选';
    if (!form.title.trim()) return '标题必填';
    if (!form.scope.trim()) return '范围必填';
    if (!form.ipOwnership.trim()) return '成果归属必填';
    if (!(Number(form.totalAmount) > 0)) return '总金额必须 > 0';
    if (!form.signedDate || !form.startDate || !form.endDate)
      return '日期必填';
    if (new Date(form.endDate) <= new Date(form.startDate))
      return '结束日期必须晚于开始日期';
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
        contractNo: form.contractNo.trim(),
        projectId: form.projectId,
        supplierId: form.supplierId,
        title: form.title,
        scope: form.scope,
        ipOwnership: form.ipOwnership,
        totalAmount: Number(form.totalAmount),
        signedDate: form.signedDate,
        startDate: form.startDate,
        endDate: form.endDate,
      };
      const r = await fetch('/api/outsource/contracts', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success(`已保存草稿 ${j.data.contractNo}`);
      router.push(`/outsource/contracts/${j.data.id}`);
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
              href="/outsource/contracts"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              委外合同
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建委外合同
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            保存草稿后, 在详情页提交 4 步审批 (研发中心 → 技委会 → 财务部 → 总经理)
          </p>
        </div>
        <Button onClick={submit} disabled={saving} className="shrink-0">
          <Save size={14} className="mr-1.5" />
          保存草稿
        </Button>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="cno">合同号</Label>
              <Input
                id="cno"
                value={form.contractNo}
                onChange={(e) =>
                  setForm({ ...form, contractNo: e.target.value })
                }
                placeholder="如 CT-2026-001"
                className="font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <Label>项目</Label>
              <Select
                value={form.projectId ? String(form.projectId) : ''}
                onValueChange={(v) =>
                  setForm({ ...form, projectId: Number(v) })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="选择 active 项目" />
                </SelectTrigger>
                <SelectContent>
                  {projects.length === 0 && (
                    <div className="text-xs text-muted-foreground px-3 py-2">
                      暂无 active 项目
                    </div>
                  )}
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({p.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>供应商</Label>
            <div className="flex gap-2">
              <Select
                value={form.supplierId ? String(form.supplierId) : ''}
                onValueChange={(v) =>
                  setForm({ ...form, supplierId: Number(v) })
                }
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="选择供应商" />
                </SelectTrigger>
                <SelectContent>
                  {suppliers.length === 0 && (
                    <div className="text-xs text-muted-foreground px-3 py-2">
                      暂无供应商, 点右侧 &quot;新建供应商&quot;
                    </div>
                  )}
                  {suppliers.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Dialog
                open={supplierDialogOpen}
                onOpenChange={setSupplierDialogOpen}
              >
                <DialogTrigger asChild>
                  <Button variant="outline" type="button">
                    <Plus size={14} className="mr-1.5" />
                    新建供应商
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>新建供应商</DialogTitle>
                    <DialogDescription>
                      供应商档案为系统字典, 创建后可在合同中复用. 需 super_admin 权限.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <Label>编码</Label>
                      <Input
                        value={supplierForm.code}
                        onChange={(e) =>
                          setSupplierForm({
                            ...supplierForm,
                            code: e.target.value,
                          })
                        }
                        placeholder="如 SUP-001"
                        className="font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>名称</Label>
                      <Input
                        value={supplierForm.name}
                        onChange={(e) =>
                          setSupplierForm({
                            ...supplierForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="如 上海材料厂"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>联系人</Label>
                      <Input
                        value={supplierForm.contactPerson}
                        onChange={(e) =>
                          setSupplierForm({
                            ...supplierForm,
                            contactPerson: e.target.value,
                          })
                        }
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>联系电话</Label>
                      <Input
                        value={supplierForm.contactPhone}
                        onChange={(e) =>
                          setSupplierForm({
                            ...supplierForm,
                            contactPhone: e.target.value,
                          })
                        }
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setSupplierDialogOpen(false)}
                    >
                      取消
                    </Button>
                    <Button onClick={submitSupplier} disabled={creatingSupplier}>
                      创建
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="title">标题</Label>
            <Input
              id="title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="如: 高温烧结炉委外加工"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="scope">范围</Label>
            <Textarea
              id="scope"
              rows={3}
              value={form.scope}
              onChange={(e) => setForm({ ...form, scope: e.target.value })}
              placeholder="详细描述委外加工内容、规格、交付物等"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ip">
              成果归属 <span className="text-rose-600">*</span>
            </Label>
            <Textarea
              id="ip"
              rows={3}
              value={form.ipOwnership}
              onChange={(e) =>
                setForm({ ...form, ipOwnership: e.target.value })
              }
            />
            <p className="text-xs text-rose-600">
              制度 6.5: 委外形成的成果 (工艺/数据/模具/专利等) 须明确归属公司
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="amount">总金额 (元)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={form.totalAmount}
                onChange={(e) =>
                  setForm({ ...form, totalAmount: e.target.value })
                }
                className="font-mono tabular-nums"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sd">签订日期</Label>
              <Input
                id="sd"
                type="date"
                value={form.signedDate}
                onChange={(e) =>
                  setForm({ ...form, signedDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="st">开始日期</Label>
              <Input
                id="st"
                type="date"
                value={form.startDate}
                onChange={(e) =>
                  setForm({ ...form, startDate: e.target.value })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ed">结束日期</Label>
              <Input
                id="ed"
                type="date"
                value={form.endDate}
                onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
