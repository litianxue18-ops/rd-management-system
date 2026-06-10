'use client';
import { useEffect, useState } from 'react';
import { Plus, Package as PackageIcon, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Material {
  id: number;
  code: string;
  name: string;
  spec: string | null;
  unit: string;
  category: string | null;
  isHazmat: boolean;
  safetyStock: string | null;
  maxStock: string | null;
  shelfLifeDays: number | null;
  enabled: boolean;
}

const EMPTY_FORM = {
  code: '',
  name: '',
  spec: '',
  unit: '',
  category: '',
  isHazmat: false,
  safetyStock: '',
  maxStock: '',
  shelfLifeDays: '',
};

export default function MaterialsPage() {
  const [list, setList] = useState<Material[] | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch('/api/materials?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const body: any = {
      code: form.code.trim(),
      name: form.name.trim(),
      unit: form.unit.trim(),
    };
    if (form.spec) body.spec = form.spec.trim();
    if (form.category) body.category = form.category.trim();
    body.isHazmat = !!form.isHazmat;
    if (form.safetyStock !== '') body.safetyStock = Number(form.safetyStock);
    if (form.maxStock !== '') body.maxStock = Number(form.maxStock);
    if (form.shelfLifeDays !== '') body.shelfLifeDays = Number(form.shelfLifeDays);

    const r = await fetch('/api/materials', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else {
      toast.success('已创建');
      setForm({ ...EMPTY_FORM });
      setOpen(false);
      load();
    }
  }

  async function toggleEnabled(m: Material) {
    const r = await fetch(`/api/materials/${m.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !m.enabled }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else load();
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((m) => m.enabled).length ?? 0;
  const disabledCount = count - activeCount;
  const hazmatCount = list?.filter((m) => m.isHazmat).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            物料目录
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            管理研发可领用的物料字典，编码用于入库/领料/期初导入匹配
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建物料
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>新建物料</DialogTitle>
              <DialogDescription>编码创建后不可改，请按公司物料编码规范填写</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="mat-code">编码</Label>
                <Input
                  id="mat-code"
                  placeholder="如 BOPET-12-001"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2">
                <Label htmlFor="mat-name">名称</Label>
                <Input
                  id="mat-name"
                  placeholder="如 BOPET 双向拉伸聚酯薄膜"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-spec">规格</Label>
                <Input
                  id="mat-spec"
                  placeholder="如 12μm × 1000mm"
                  value={form.spec}
                  onChange={(e) => setForm({ ...form, spec: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-unit">单位</Label>
                <Input
                  id="mat-unit"
                  placeholder="如 kg / L / 片"
                  value={form.unit}
                  onChange={(e) => setForm({ ...form, unit: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-category">类别</Label>
                <Input
                  id="mat-category"
                  placeholder="如 原材料 / 辅材 / 试剂"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-shelf">保质期 (天)</Label>
                <Input
                  id="mat-shelf"
                  type="number"
                  min="0"
                  value={form.shelfLifeDays}
                  onChange={(e) => setForm({ ...form, shelfLifeDays: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-safety">安全库存</Label>
                <Input
                  id="mat-safety"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.safetyStock}
                  onChange={(e) => setForm({ ...form, safetyStock: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="mat-max">库存上限</Label>
                <Input
                  id="mat-max"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.maxStock}
                  onChange={(e) => setForm({ ...form, maxStock: e.target.value })}
                />
              </div>
              <div className="flex items-center gap-2 col-span-2 pt-1">
                <input
                  id="mat-hazmat"
                  type="checkbox"
                  checked={form.isHazmat}
                  onChange={(e) => setForm({ ...form, isHazmat: e.target.checked })}
                />
                <Label htmlFor="mat-hazmat" className="cursor-pointer">危化品</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>取消</Button>
              <Button onClick={create}>提交</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats bar */}
      <div className="flex items-center justify-between gap-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-4 flex-wrap">
          <span>
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个物料
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 启用</span>
          <span>·</span>
          <span className="tabular-nums">{disabledCount} 停用</span>
          <span>·</span>
          <span className="tabular-nums">{hazmatCount} 危化品</span>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input placeholder="搜索..." className="pl-8 h-8 text-sm" />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {list === null ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>规格</TableHead>
                  <TableHead>单位</TableHead>
                  <TableHead>类别</TableHead>
                  <TableHead className="text-right">安全库存</TableHead>
                  <TableHead className="text-right">上限</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <PackageIcon size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无物料
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建物料" 创建第一条
                        </div>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setOpen(true)}
                        >
                          <Plus size={14} className="mr-1.5" />
                          新建物料
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((m) => (
                    <TableRow key={m.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {m.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        {m.name}
                        {m.isHazmat && (
                          <Badge
                            variant="outline"
                            className="ml-1.5 text-rose-600 border-rose-200 bg-rose-50"
                          >
                            危化品
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground py-2">{m.spec ?? '—'}</TableCell>
                      <TableCell className="py-2">{m.unit}</TableCell>
                      <TableCell className="py-2">{m.category ?? '—'}</TableCell>
                      <TableCell className="text-right py-2 tabular-nums">
                        {m.safetyStock ? Number(m.safetyStock) : '—'}
                      </TableCell>
                      <TableCell className="text-right py-2 tabular-nums">
                        {m.maxStock ? Number(m.maxStock) : '—'}
                      </TableCell>
                      <TableCell className="py-2">
                        {m.enabled ? (
                          <Badge
                            variant="outline"
                            className="text-emerald-600 border-emerald-200 bg-emerald-50"
                          >
                            启用
                          </Badge>
                        ) : (
                          <Badge variant="secondary">已停用</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right py-2">
                        <Button variant="ghost" size="sm" onClick={() => toggleEnabled(m)}>
                          {m.enabled ? '停用' : '启用'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {count} 个物料</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
