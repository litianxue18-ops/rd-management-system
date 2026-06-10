'use client';
import { useEffect, useState } from 'react';
import { Plus, Warehouse as WarehouseIcon, Search } from 'lucide-react';
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

interface Warehouse {
  id: number;
  code: string;
  name: string;
  location: string | null;
  enabled: boolean;
}

export default function WarehousesPage() {
  const [list, setList] = useState<Warehouse[] | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [location, setLocation] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch('/api/warehouses?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => { load(); }, []);

  async function create() {
    const body: any = { code: code.trim(), name: name.trim() };
    if (location) body.location = location.trim();
    const r = await fetch('/api/warehouses', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else {
      toast.success('已创建');
      setCode(''); setName(''); setLocation('');
      setOpen(false);
      load();
    }
  }

  async function toggleEnabled(w: Warehouse) {
    const r = await fetch(`/api/warehouses/${w.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !w.enabled }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else load();
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((w) => w.enabled).length ?? 0;
  const disabledCount = count - activeCount;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            仓库
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            管理研发可用仓库，编码用于库存账本和出入库单匹配
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建仓库
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建仓库</DialogTitle>
              <DialogDescription>编码创建后不可改</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="wh-code">编码</Label>
                <Input
                  id="wh-code"
                  placeholder="如 rd-warehouse"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-name">名称</Label>
                <Input
                  id="wh-name"
                  placeholder="如 R&D 主仓"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="wh-location">地点</Label>
                <Input
                  id="wh-location"
                  placeholder="如 研发楼 1F"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
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
            共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 个仓库
          </span>
          <span>·</span>
          <span className="tabular-nums">{activeCount} 启用</span>
          <span>·</span>
          <span className="tabular-nums">{disabledCount} 停用</span>
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
                  <TableHead className="w-16">ID</TableHead>
                  <TableHead>编码</TableHead>
                  <TableHead>名称</TableHead>
                  <TableHead>地点</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <WarehouseIcon size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无仓库
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建仓库" 创建第一条
                        </div>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setOpen(true)}
                        >
                          <Plus size={14} className="mr-1.5" />
                          新建仓库
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((w) => (
                    <TableRow key={w.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="text-muted-foreground py-2 font-mono tabular-nums text-xs">
                        {w.id}
                      </TableCell>
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                          {w.code}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium py-2">{w.name}</TableCell>
                      <TableCell className="text-muted-foreground py-2">{w.location ?? '—'}</TableCell>
                      <TableCell className="py-2">
                        {w.enabled ? (
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
                        <Button variant="ghost" size="sm" onClick={() => toggleEnabled(w)}>
                          {w.enabled ? '停用' : '启用'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {count} 个仓库</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
