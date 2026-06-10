'use client';
import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save, Send } from 'lucide-react';
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

interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  leadUserId: number;
  members?: { userId: number }[];
}

interface Me {
  id: number;
  name: string;
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

export default function NewOutboundPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [form, setForm] = useState({
    projectId: 0,
    materialId: 0,
    warehouseId: 0,
    requestedQty: '' as string,
    purpose: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((j) => setMe(j.data));
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

  const myProjects = useMemo(() => {
    if (!me) return [];
    return projects.filter(
      (p) =>
        p.status === 'active' &&
        (p.leadUserId === me.id || p.members?.some((m) => m.userId === me.id)),
    );
  }, [projects, me]);

  function validate(): string | null {
    if (!form.projectId) return '项目必选';
    if (!form.materialId) return '物料必选';
    if (!form.warehouseId) return '仓库必选';
    const q = Number(form.requestedQty);
    if (!(q > 0)) return '数量必须 > 0';
    if (!form.purpose.trim()) return '用途必填';
    return null;
  }

  async function saveDraft(): Promise<number | null> {
    const err = validate();
    if (err) {
      toast.error(err);
      return null;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/inventory/outbound', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          projectId: form.projectId,
          materialId: form.materialId,
          warehouseId: form.warehouseId,
          requestedQty: Number(form.requestedQty),
          purpose: form.purpose,
        }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return null;
      }
      return j.data.id as number;
    } finally {
      setSaving(false);
    }
  }

  async function onSaveDraft() {
    const id = await saveDraft();
    if (id) {
      toast.success('已保存草稿');
      router.push(`/material/outbound/${id}`);
    }
  }

  async function onSubmit() {
    const id = await saveDraft();
    if (!id) return;
    const r = await fetch('/api/workflow/submit', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        workflowCode: 'material_request_v1',
        entityId: id,
      }),
    });
    const j = await r.json();
    if (j.error) {
      toast.error(`提交审批失败: ${j.error.message}`);
      router.push(`/material/outbound/${id}`);
      return;
    }
    toast.success('已提交审批');
    router.push(`/material/outbound/${id}`);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-8 py-6 space-y-6">
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
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            新建领料
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            填写后保存草稿或直接提交审批 (项目负责人 → 研发中心)
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={onSaveDraft} disabled={saving}>
            <Save size={14} className="mr-1.5" />
            保存草稿
          </Button>
          <Button onClick={onSubmit} disabled={saving}>
            <Send size={14} className="mr-1.5" />
            提交审批
          </Button>
        </div>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardContent className="pt-6 space-y-5">
          <div className="space-y-1.5">
            <Label>项目</Label>
            <Select
              value={form.projectId ? String(form.projectId) : ''}
              onValueChange={(v) => setForm({ ...form, projectId: Number(v) })}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择项目" />
              </SelectTrigger>
              <SelectContent>
                {myProjects.length === 0 ? (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    暂无可选项目 (需 active + 你是负责人或成员)
                  </div>
                ) : (
                  myProjects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-qty">数量</Label>
            <Input
              id="ob-qty"
              type="number"
              step="0.01"
              value={form.requestedQty}
              onChange={(e) => setForm({ ...form, requestedQty: e.target.value })}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ob-purpose">用途</Label>
            <Textarea
              id="ob-purpose"
              rows={4}
              value={form.purpose}
              onChange={(e) => setForm({ ...form, purpose: e.target.value })}
              placeholder="说明本次领料的用途, 阶段, 预期产出"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
