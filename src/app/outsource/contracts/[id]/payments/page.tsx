'use client';
import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';

type Status =
  | 'draft'
  | 'reviewing'
  | 'active'
  | 'completed'
  | 'rejected'
  | 'cancelled';

interface Payment {
  id: number;
  amount: string;
  paidDate: string;
  installmentNo: number;
  note: string | null;
  registeredById: number;
  createdAt: string;
}

interface Contract {
  id: number;
  contractNo: string;
  title: string;
  totalAmount: string;
  status: Status;
  project: { id: number; code: string; name: string };
  supplier: { id: number; code: string; name: string };
  payments: Payment[];
}

interface Me {
  id: number;
  name: string;
  roles: { code: string; isPrimary: boolean }[];
}

function fmtDate(s: string | null) {
  if (!s) return '—';
  const d = new Date(s);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function PaymentsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const contractId = Number(id);

  const [contract, setContract] = useState<Contract | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    amount: '' as string,
    paidDate: todayStr(),
    installmentNo: '' as string,
    note: '',
  });
  const [saving, setSaving] = useState(false);

  async function load() {
    const [c, m] = await Promise.all([
      fetch(`/api/outsource/contracts/${contractId}`).then((x) => x.json()),
      fetch('/api/auth/me').then((x) => x.json()),
    ]);
    setContract(c.data ?? null);
    setMe(m.data ?? null);
    if (c.data) {
      const next = (c.data.payments?.length ?? 0) + 1;
      setForm((f) => ({ ...f, installmentNo: String(next) }));
    }
  }

  useEffect(() => {
    if (!Number.isFinite(contractId)) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractId]);

  function canRegister(): boolean {
    if (!me) return false;
    const roles = me.roles.map((r) => r.code);
    return (
      roles.includes('finance_lead') || roles.includes('super_admin')
    );
  }

  async function submitPayment() {
    if (!(Number(form.amount) > 0)) {
      toast.error('金额必须 > 0');
      return;
    }
    if (!(Number(form.installmentNo) > 0)) {
      toast.error('期数必须 > 0');
      return;
    }
    if (!form.paidDate) {
      toast.error('付款日期必填');
      return;
    }
    setSaving(true);
    try {
      const r = await fetch('/api/outsource/payments', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contractId,
          amount: Number(form.amount),
          paidDate: form.paidDate,
          installmentNo: Number(form.installmentNo),
          note: form.note || undefined,
        }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
        return;
      }
      toast.success('已登记付款');
      setDialogOpen(false);
      setForm({
        amount: '',
        paidDate: todayStr(),
        installmentNo: '',
        note: '',
      });
      load();
    } finally {
      setSaving(false);
    }
  }

  if (!contract) {
    return (
      <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const totalAmount = Number(contract.totalAmount);
  const paid = contract.payments.reduce((acc, p) => acc + Number(p.amount), 0);
  const remaining = totalAmount - paid;
  const showRegisterBtn = canRegister() && contract.status === 'active';

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-8 py-6 space-y-6">
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
            <ChevronRight size={12} />
            <Link
              href={`/outsource/contracts/${contractId}`}
              className="hover:text-slate-900"
            >
              {contract.contractNo}
            </Link>
            <ChevronRight size={12} />
            <span>付款</span>
          </div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900">
            付款登记
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            {contract.title} · 供应商 {contract.supplier.name}
          </p>
        </div>
        {showRegisterBtn && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="shrink-0">
                <Plus size={14} className="mr-1.5" />
                新增付款
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>新增付款</DialogTitle>
                <DialogDescription>
                  仅财务部 (finance_lead) 可登记. 累计 == 合同总额时自动 → completed.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>本期金额 (元)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.amount}
                      onChange={(e) =>
                        setForm({ ...form, amount: e.target.value })
                      }
                      className="font-mono tabular-nums"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>期数</Label>
                    <Input
                      type="number"
                      min="1"
                      value={form.installmentNo}
                      onChange={(e) =>
                        setForm({ ...form, installmentNo: e.target.value })
                      }
                      className="font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>付款日期</Label>
                  <Input
                    type="date"
                    value={form.paidDate}
                    onChange={(e) =>
                      setForm({ ...form, paidDate: e.target.value })
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>备注</Label>
                  <Textarea
                    rows={3}
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="如: 首付 30%, 银行转账"
                  />
                </div>
                <div className="text-xs text-muted-foreground p-2 bg-slate-50 rounded">
                  合同总额{' '}
                  <span className="font-mono tabular-nums text-slate-900">
                    ¥{totalAmount.toLocaleString()}
                  </span>{' '}
                  · 已付{' '}
                  <span className="font-mono tabular-nums text-slate-900">
                    ¥{paid.toLocaleString()}
                  </span>{' '}
                  · 本期之后剩余{' '}
                  <span className="font-mono tabular-nums text-amber-700">
                    ¥{(remaining - Number(form.amount || 0)).toLocaleString()}
                  </span>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                >
                  取消
                </Button>
                <Button onClick={submitPayment} disabled={saving}>
                  登记
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">合同总额</div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-slate-900">
              ¥{totalAmount.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">已付</div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-emerald-700">
              ¥{paid.toLocaleString()}
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-300 shadow-md">
          <CardContent className="py-4">
            <div className="text-xs text-muted-foreground mb-1">剩余</div>
            <div className="font-mono tabular-nums text-2xl font-semibold text-amber-700">
              ¥{remaining.toLocaleString()}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-slate-300 shadow-md rounded-xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            付款明细 (共 {contract.payments.length} 期)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contract.payments.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              暂无付款记录
              {showRegisterBtn && '; 点击右上 "新增付款"'}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="h-10">
                  <TableHead>期数</TableHead>
                  <TableHead className="text-right">金额</TableHead>
                  <TableHead>付款日期</TableHead>
                  <TableHead>备注</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...contract.payments]
                  .sort((a, b) => a.installmentNo - b.installmentNo)
                  .map((p) => (
                    <TableRow key={p.id} className="h-10">
                      <TableCell className="py-2">
                        <Badge variant="secondary" className="font-normal">
                          第 {p.installmentNo} 期
                        </Badge>
                      </TableCell>
                      <TableCell className="py-2 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ¥{Number(p.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2 text-xs tabular-nums text-muted-foreground">
                        {fmtDate(p.paidDate)}
                      </TableCell>
                      <TableCell className="py-2 text-xs text-muted-foreground">
                        {p.note ?? '—'}
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
