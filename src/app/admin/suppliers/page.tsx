'use client';
import { useEffect, useState } from 'react';
import { Plus, Truck, Search } from 'lucide-react';
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

interface Supplier {
  id: number;
  code: string;
  name: string;
  contactPerson: string | null;
  contactPhone: string | null;
  enabled: boolean;
}

export default function SuppliersPage() {
  const [list, setList] = useState<Supplier[] | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [contactPerson, setContactPerson] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  async function load() {
    const r = await fetch('/api/outsource/suppliers?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const body: any = { code: code.trim(), name: name.trim() };
    if (contactPerson) body.contactPerson = contactPerson.trim();
    if (contactPhone) body.contactPhone = contactPhone.trim();
    const r = await fetch('/api/outsource/suppliers', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else {
      toast.success('已创建');
      setCode(''); setName(''); setContactPerson(''); setContactPhone('');
      setOpen(false);
      load();
    }
  }

  async function toggleEnabled(s: Supplier) {
    const r = await fetch(`/api/outsource/suppliers/${s.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !s.enabled }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else load();
  }

  const filtered = (list ?? []).filter((s) => {
    if (!q.trim()) return true;
    const t = q.trim().toLowerCase();
    return (
      s.code.toLowerCase().includes(t) ||
      s.name.toLowerCase().includes(t) ||
      (s.contactPerson ?? '').toLowerCase().includes(t) ||
      (s.contactPhone ?? '').toLowerCase().includes(t)
    );
  });

  const count = list?.length ?? 0;
  const activeCount = list?.filter((s) => s.enabled).length ?? 0;
  const disabledCount = count - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            供应商
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            管理委外加工供应商, 编码用于合同 / 付款单关联
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建供应商
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建供应商</DialogTitle>
              <DialogDescription>编码创建后不可改</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sup-code">编码</Label>
                <Input
                  id="sup-code"
                  placeholder="如 sup-jiangsu-001"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-name">名称</Label>
                <Input
                  id="sup-name"
                  placeholder="如 江苏 X 机械加工厂"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-cp">联系人</Label>
                <Input
                  id="sup-cp"
                  placeholder="可选"
                  value={contactPerson}
                  onChange={(e) => setContactPerson(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sup-tel">联系电话</Label>
                <Input
                  id="sup-tel"
                  placeholder="可选"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                />
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
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个供应商
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 启用</span>
          <span>·</span>
          <span className="tabular-nums">{disabledCount} 停用</span>
        </div>
        <div className="relative max-w-xs flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            placeholder="搜索..."
            className="pl-8 h-8 text-sm"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
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
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>联系人</TableHead>
                  <TableHead>电话</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Truck size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          {count === 0 ? '暂无供应商' : '没匹配的供应商'}
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          {count === 0 ? '点击右上 "新建供应商" 创建第一条' : '换个关键字试试'}
                        </div>
                        {count === 0 && (
                          <Button
                            className="mt-4"
                            variant="outline"
                            onClick={() => setOpen(true)}
                          >
                            <Plus size={14} className="mr-1.5" />
                            新建供应商
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((s) => (
                    <TableRow key={s.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {s.id}
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {s.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium py-2">{s.name}</TableCell>
                      <TableCell className="text-muted-foreground py-2">{s.contactPerson ?? '—'}</TableCell>
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {s.contactPhone ?? '—'}
                      </TableCell>
                      <TableCell className="py-2">
                        {s.enabled ? (
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
                        <Button variant="ghost" size="sm" onClick={() => toggleEnabled(s)}>
                          {s.enabled ? '停用' : '启用'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {filtered.length > 0 && (
                <TableCaption>共 {filtered.length} 个供应商</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
