'use client';
import { useEffect, useState } from 'react';
import { Plus, Share2 } from 'lucide-react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

interface SharedResource {
  id: number;
  year: number;
  resourceName: string;
  annualAmount: string;
  allocBasis: 'workhour' | 'equal';
  note: string | null;
  enabled: boolean;
}

function basisBadge(basis: string) {
  if (basis === 'workhour') {
    return (
      <Badge
        variant="outline"
        className="text-blue-700 border-blue-200 bg-blue-50"
      >
        工时占比
      </Badge>
    );
  }
  return (
    <Badge
      variant="outline"
      className="text-violet-700 border-violet-200 bg-violet-50"
    >
      项目平均
    </Badge>
  );
}

function fmtMoney(s: string) {
  return Number(s).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
}

export default function SharedResourcesPage() {
  const [list, setList] = useState<SharedResource[] | null>(null);
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [resourceName, setResourceName] = useState('');
  const [annualAmount, setAnnualAmount] = useState('');
  const [allocBasis, setAllocBasis] = useState<'workhour' | 'equal'>('workhour');
  const [note, setNote] = useState('');
  const [open, setOpen] = useState(false);

  async function load() {
    const r = await fetch('/api/shared-resources?includeDisabled=1');
    const j = await r.json();
    setList(j.data ?? []);
  }
  useEffect(() => {
    load();
  }, []);

  async function create() {
    const body = {
      year: Number(year),
      resourceName: resourceName.trim(),
      annualAmount: Number(annualAmount),
      allocBasis,
      note: note.trim() || undefined,
    };
    const r = await fetch('/api/shared-resources', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else {
      toast.success('已创建');
      setResourceName('');
      setAnnualAmount('');
      setNote('');
      setOpen(false);
      load();
    }
  }

  async function toggleEnabled(c: SharedResource) {
    const r = await fetch(`/api/shared-resources/${c.id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ enabled: !c.enabled }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message);
    else load();
  }

  const count = list?.length ?? 0;
  const activeCount = list?.filter((c) => c.enabled).length ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            共用资源分摊
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            配置年度共用资源 (设备折旧 / 场地租金 / 水电), 月度按工时占比或项目平均分摊至各研发项目
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0">
              <Plus size={16} className="mr-2" />
              新建分摊项
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>新建共用资源分摊项</DialogTitle>
              <DialogDescription>
                年度总额按月平均 (÷12), 再按分摊依据归集至项目
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="sr-year">年度</Label>
                <Input
                  id="sr-year"
                  type="number"
                  placeholder="如 2026"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-name">资源名称</Label>
                <Input
                  id="sr-name"
                  placeholder="如 设备折旧 / 场地租金"
                  value={resourceName}
                  onChange={(e) => setResourceName(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-amount">年度总额 (元)</Label>
                <Input
                  id="sr-amount"
                  type="number"
                  placeholder="如 120000"
                  value={annualAmount}
                  onChange={(e) => setAnnualAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>分摊依据</Label>
                <Select
                  value={allocBasis}
                  onValueChange={(v) => setAllocBasis(v as 'workhour' | 'equal')}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="workhour">工时占比</SelectItem>
                    <SelectItem value="equal">项目平均</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sr-note">备注</Label>
                <Input
                  id="sr-note"
                  placeholder="可选"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                取消
              </Button>
              <Button onClick={create}>提交</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 flex-wrap text-sm text-muted-foreground">
        <span>
          共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 项
        </span>
        <span>·</span>
        <span className="tabular-nums">{activeCount} 启用</span>
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
                  <TableHead className="w-20">年度</TableHead>
                  <TableHead>资源名称</TableHead>
                  <TableHead className="text-right">年度总额 (¥)</TableHead>
                  <TableHead>分摊依据</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Share2 size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无共用资源分摊项
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          点击右上 "新建分摊项" 创建第一条
                        </div>
                        <Button
                          className="mt-4"
                          variant="outline"
                          onClick={() => setOpen(true)}
                        >
                          <Plus size={14} className="mr-1.5" />
                          新建分摊项
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((c) => (
                    <TableRow key={c.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="font-mono tabular-nums text-sm py-2">
                        {c.year}
                      </TableCell>
                      <TableCell className="font-medium py-2">
                        {c.resourceName}
                        {c.note && (
                          <span className="ml-2 text-xs text-muted-foreground">
                            {c.note}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-mono tabular-nums py-2">
                        ¥{fmtMoney(c.annualAmount)}
                      </TableCell>
                      <TableCell className="py-2">{basisBadge(c.allocBasis)}</TableCell>
                      <TableCell className="py-2">
                        {c.enabled ? (
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleEnabled(c)}
                        >
                          {c.enabled ? '停用' : '启用'}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>
                  月度额 = 年度总额 ÷ 12; 工时占比 = 项目当月工时 / 全公司当月工时; 项目平均 = 月度额 / 当月有工时项目数
                </TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
