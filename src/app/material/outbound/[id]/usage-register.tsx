'use client';
import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';

export type UsageEvent =
  | 'testing'
  | 'trial_prep'
  | 'sample_making'
  | 'loss'
  | 'other';

interface UsageLog {
  id: number;
  usageDate: string;
  quantity: string;
  eventType: UsageEvent;
  description: string;
  operatorId: number;
}

interface Balance {
  issued: number;
  returned: number;
  consumed: number;
  inHand: number;
}

const EVENT_LABEL: Record<UsageEvent, string> = {
  testing: '测试试验',
  trial_prep: '试制备料',
  sample_making: '样品制备',
  loss: '损耗',
  other: '其他',
};

function eventBadge(e: UsageEvent) {
  const cls: Record<UsageEvent, string> = {
    testing: 'text-blue-800 border-blue-300 bg-blue-100',
    trial_prep: 'text-amber-800 border-amber-300 bg-amber-100',
    sample_making: 'text-emerald-800 border-emerald-300 bg-emerald-100',
    loss: 'text-rose-800 border-rose-300 bg-rose-100',
    other: 'text-slate-700 border-slate-300 bg-slate-100',
  };
  return (
    <Badge variant="outline" className={`font-normal ${cls[e]}`}>
      {EVENT_LABEL[e]}
    </Badge>
  );
}

function fmtDate(s: string) {
  return new Date(s).toISOString().slice(0, 10);
}

function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export function UsageRegister({
  outboundId,
  unit,
  canRegister,
  onChanged,
}: {
  outboundId: number;
  unit: string;
  canRegister: boolean;
  onChanged?: () => void;
}) {
  const [logs, setLogs] = useState<UsageLog[] | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // 表单
  const [usageDate, setUsageDate] = useState(todayISO());
  const [quantity, setQuantity] = useState('');
  const [eventType, setEventType] = useState<UsageEvent>('testing');
  const [description, setDescription] = useState('');

  async function load() {
    const r = await fetch(
      `/api/inventory/usage?outboundId=${outboundId}`,
    ).then((x) => x.json());
    setLogs(r.data ?? []);
    // 在手量: 从 outbound 详情算 (issued/returned) + consumed(logs)
    const o = await fetch(`/api/inventory/outbound/${outboundId}`).then((x) =>
      x.json(),
    );
    if (o.data) {
      const issued = Number(o.data.issuedQty);
      const returned = Number(o.data.returnedQty);
      const consumed = (r.data ?? []).reduce(
        (s: number, l: UsageLog) => s + Number(l.quantity),
        0,
      );
      setBalance({ issued, returned, consumed, inHand: issued - returned - consumed });
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outboundId]);

  async function submit() {
    const qty = Number(quantity);
    if (!(qty > 0)) {
      toast.error('消耗数量必须 > 0');
      return;
    }
    if (!description.trim()) {
      toast.error('请填写用途说明');
      return;
    }
    setBusy(true);
    try {
      const r = await fetch('/api/inventory/usage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outboundId,
          usageDate,
          quantity: qty,
          eventType,
          description: description.trim(),
        }),
      });
      const j = await r.json();
      if (j.error) {
        toast.error(j.error.message);
      } else {
        toast.success('已登记消耗');
        setOpen(false);
        setQuantity('');
        setDescription('');
        setEventType('testing');
        setUsageDate(todayISO());
        await load();
        onChanged?.();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-slate-300 shadow-md rounded-xl">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          消耗记录
          {logs && (
            <span className="text-xs font-normal text-muted-foreground">
              · {logs.length} 笔
            </span>
          )}
          {canRegister && (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="ml-auto -my-1">
                  <Plus size={14} className="mr-1.5" />
                  登记消耗
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>登记物料消耗</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="usage-date">消耗日期</Label>
                    <Input
                      id="usage-date"
                      type="date"
                      value={usageDate}
                      onChange={(e) => setUsageDate(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="usage-qty">
                      消耗数量
                      <span className="text-xs text-muted-foreground ml-1">
                        ({unit})
                      </span>
                    </Label>
                    <Input
                      id="usage-qty"
                      type="number"
                      step="0.5"
                      min="0"
                      value={quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      placeholder="0"
                    />
                    {balance && (
                      <p className="text-xs text-muted-foreground">
                        当前在手量 {balance.inHand} {unit}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <Label>事件类型</Label>
                    <Select
                      value={eventType}
                      onValueChange={(v) => setEventType(v as UsageEvent)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.keys(EVENT_LABEL) as UsageEvent[]
                        ).map((k) => (
                          <SelectItem key={k} value={k}>
                            {EVENT_LABEL[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="usage-desc">用途说明</Label>
                    <Textarea
                      id="usage-desc"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="如: 第三批强度测试取样 200g"
                      rows={3}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    取消
                  </Button>
                  <Button onClick={submit} disabled={busy}>
                    提交
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 在手量 KPI */}
        {balance && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-muted-foreground">已出库</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {balance.issued}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-muted-foreground">已退库</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {balance.returned}
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="text-xs text-muted-foreground">已消耗</div>
              <div className="text-lg font-semibold tabular-nums text-slate-900 mt-0.5">
                {balance.consumed}
              </div>
            </div>
            <div className="rounded-lg border border-blue-300 bg-blue-50/50 px-3 py-2">
              <div className="text-xs text-blue-700">在手</div>
              <div className="text-lg font-bold tabular-nums text-blue-700 mt-0.5">
                {balance.inHand}
              </div>
            </div>
          </div>
        )}

        {/* 消耗记录列表 */}
        {logs === null ? (
          <div className="py-4 text-sm text-muted-foreground">加载中…</div>
        ) : logs.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            还没有消耗登记
          </div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {logs.map((l) => (
              <li
                key={l.id}
                className="flex items-start justify-between gap-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono tabular-nums text-sm text-slate-900">
                      {Number(l.quantity).toLocaleString()} {unit}
                    </span>
                    {eventBadge(l.eventType)}
                  </div>
                  <div className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">
                    {l.description}
                  </div>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums shrink-0">
                  {fmtDate(l.usageDate)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
