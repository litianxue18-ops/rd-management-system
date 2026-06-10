'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Package, PackageCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface Row {
  id: number;
  docNo: string;
  projectId: number;
  materialId: number;
  warehouseId: number;
  requestedQty: string;
  purpose: string;
  requesterId: number;
  createdAt: string;
  project: { id: number; code: string; name: string };
  material: { id: number; code: string; name: string; unit: string };
  warehouse: { id: number; code: string; name: string };
}

interface BalanceRow {
  materialId: number;
  warehouseId: number;
  balance: number;
  unit: string;
}

function fmtDateTime(s: string) {
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

export default function InventoryIssuePage() {
  const [list, setList] = useState<Row[] | null>(null);
  const [activeRow, setActiveRow] = useState<Row | null>(null);
  const [issuedQty, setIssuedQty] = useState<string>('');
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch('/api/inventory/outbound?status=approved');
    const j = await r.json();
    setList(j.data ?? []);
  }

  useEffect(() => {
    load();
  }, []);

  async function openDialog(row: Row) {
    setActiveRow(row);
    setIssuedQty(String(Number(row.requestedQty)));
    setBalance(null);
    try {
      const r = await fetch(
        `/api/inventory/balance?materialId=${row.materialId}&warehouseId=${row.warehouseId}`,
      );
      const j = await r.json();
      const rows = (j.data ?? []) as BalanceRow[];
      setBalance(rows[0]?.balance ?? 0);
    } catch {
      setBalance(0);
    }
  }

  async function confirmIssue() {
    if (!activeRow) return;
    const qty = Number(issuedQty);
    if (!(qty > 0)) {
      toast.error('出库数量必须 > 0');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/inventory/outbound/issue', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ outboundId: activeRow.id, issuedQty: qty }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success('已出库');
      setActiveRow(null);
      await load();
    } finally {
      setBusy(false);
    }
  }

  const count = list?.length ?? 0;
  const projectCount = new Set(list?.map((r) => r.projectId)).size;

  const projects = projectCount; // alias for readability in stat bar

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
            <Link
              href="/workbench"
              className="hover:text-slate-900 inline-flex items-center gap-1"
            >
              <ArrowLeft size={12} />
              工作台
            </Link>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            出库执行
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            审批通过待出库的领料单
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
        <span>
          共 <span className="font-medium text-slate-900 tabular-nums">{count}</span> 条待出库
        </span>
        <span>·</span>
        <span className="tabular-nums">{projects} 个项目</span>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
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
                  <TableHead>领料单号</TableHead>
                  <TableHead>项目</TableHead>
                  <TableHead>物料</TableHead>
                  <TableHead>仓库</TableHead>
                  <TableHead className="text-right">申请量</TableHead>
                  <TableHead>用途</TableHead>
                  <TableHead>申请时间</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-12">
                      <div className="flex flex-col items-center justify-center text-center">
                        <Package size={40} className="text-slate-200" />
                        <div className="mt-3 text-base font-medium text-slate-500">
                          暂无待出库领料单
                        </div>
                        <div className="mt-1 text-sm text-muted-foreground">
                          所有审批通过的领料单都已出库
                        </div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  list.map((r) => (
                    <TableRow key={r.id} className="h-10 hover:bg-blue-50/50">
                      <TableCell className="py-2">
                        <code className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded tabular-nums">
                          {r.docNo}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-slate-900 truncate max-w-[180px]">
                          {r.project.name}
                        </div>
                        <code className="text-xs text-muted-foreground font-mono">
                          {r.project.code}
                        </code>
                      </TableCell>
                      <TableCell className="py-2">
                        <div className="font-medium text-slate-900">
                          {r.material.name}
                        </div>
                        <div className="text-xs text-muted-foreground font-mono">
                          {r.material.code}
                        </div>
                      </TableCell>
                      <TableCell className="py-2 text-slate-700">
                        {r.warehouse.name}
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums">
                        {Number(r.requestedQty).toLocaleString()}
                        <span className="text-xs text-muted-foreground ml-1">
                          {r.material.unit}
                        </span>
                      </TableCell>
                      <TableCell className="py-2 text-sm text-slate-700 truncate max-w-[220px]">
                        {r.purpose}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground tabular-nums">
                        {fmtDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell className="py-2 text-right">
                        <Button size="sm" onClick={() => openDialog(r)}>
                          <PackageCheck size={14} className="mr-1" />
                          出库
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
              {list.length > 0 && (
                <TableCaption>共 {list.length} 条待出库</TableCaption>
              )}
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!activeRow}
        onOpenChange={(v) => {
          if (!v) setActiveRow(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认出库</DialogTitle>
            <DialogDescription>
              {activeRow?.docNo} · {activeRow?.project.name}
            </DialogDescription>
          </DialogHeader>
          {activeRow && (
            <div className="space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 p-3 bg-slate-50 rounded-md">
                <div>
                  <dt className="text-xs text-muted-foreground">物料</dt>
                  <dd className="font-medium text-slate-900">
                    {activeRow.material.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">仓库</dt>
                  <dd className="font-medium text-slate-900">
                    {activeRow.warehouse.name}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">申请量</dt>
                  <dd className="font-mono tabular-nums text-slate-900">
                    {Number(activeRow.requestedQty).toLocaleString()}{' '}
                    {activeRow.material.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">当前库存</dt>
                  <dd className="font-mono tabular-nums text-blue-700 font-semibold">
                    {balance === null
                      ? '加载中…'
                      : `${balance.toLocaleString()} ${activeRow.material.unit}`}
                  </dd>
                </div>
              </dl>
              <div className="space-y-1.5">
                <Label htmlFor="issued-qty">实际出库数量</Label>
                <Input
                  id="issued-qty"
                  type="number"
                  step="0.01"
                  min="0"
                  max={Number(activeRow.requestedQty)}
                  value={issuedQty}
                  onChange={(e) => setIssuedQty(e.target.value)}
                  className="font-mono tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  默认按申请量出库; 实际出库量不能超过申请量
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setActiveRow(null)}
              disabled={busy}
            >
              取消
            </Button>
            <Button onClick={confirmIssue} disabled={busy}>
              确认出库
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
