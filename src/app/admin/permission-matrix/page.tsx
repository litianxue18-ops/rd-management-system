'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { PERMISSION_NODES, ROLE_CODES } from '@/modules/permission/nodes';

type RaciCell = '' | 'R' | 'A' | 'RA';

interface Entry { roleCode: string; nodeCode: string; raci: 'R' | 'A'; }

const NODE_LIST = Object.values(PERMISSION_NODES);
const ROLE_LIST = Object.values(ROLE_CODES).filter((r) => r !== ROLE_CODES.SUPER_ADMIN);

const ROLE_LABELS: Record<string, string> = {
  project_lead: '项目负责人', rd_director: '研发中心', tech_committee: '技委会',
  researcher: '研发员', production_lead: '生产部', purchase_lead: '采购部',
  warehouse_keeper: '仓管', equipment_lead: '设备部', hr_lead: '人资',
  finance_lead: '财务部', audit_lead: '审计部', ceo: '总经理',
};

const NODE_LABELS: Record<string, string> = {
  project_create: '立项报告编制', project_initial_review: '立项初审',
  project_tech_review: '立项技术评审', project_budget_review: '立项预算审核',
  project_final_approval: '立项最终批准', project_register: '项目台账登记',
  workhour_create: '工时日填报', workhour_weekly_review: '工时周审',
  workhour_monthly_aggregate: '工时月汇总', monthly_report_submit: '月度进展报告',
  project_change_approval: '重大变更审批',
  material_request_create: '研发领料申请', material_request_approve: '研发领料审批',
  inventory_inbound: '入库登记', inventory_outbound_exec: '仓库出库',
  sample_scrap_register: '样品废料登记', sample_scrap_supervise: '样品废料监销',
  trial_material_produce: '试制材料生产',
  trial_transfer_submit: '试制费用转嫁单提交', trial_transfer_approve: '试制费用转嫁审批',
  trial_transfer_settle: '试制费务结转', shared_resource_config: '共用资源分摊配置',
  outsource_contract_review: '委外研发合同审核', commissioned_rd_review: '受托研发计入研发判断',
  capitalization_evaluate: '资本化时点评估', capitalization_approve: '资本化报告批准',
  monthly_reconciliation: '月度数据勾稽', exception_note_trigger: '异常核对单触发',
  quarterly_audit: '季度内审',
  closing_report_draft: '结项报告编制', closing_acceptance: '结项验收', archive: '档案归档',
};

const CYCLE: RaciCell[] = ['', 'R', 'A', 'RA'];

function CellBadge({ value }: { value: RaciCell }) {
  if (value === '') return <span className="text-slate-300">—</span>;
  if (value === 'R') {
    return (
      <Badge
        variant="outline"
        className="text-blue-800 border-blue-300 bg-blue-100 px-1.5"
      >
        R
      </Badge>
    );
  }
  if (value === 'A') {
    return (
      <Badge
        variant="outline"
        className="text-emerald-800 border-emerald-300 bg-emerald-100 px-1.5"
      >
        A
      </Badge>
    );
  }
  return (
    <Badge className="bg-blue-600 text-white px-1.5 hover:bg-blue-600">RA</Badge>
  );
}

export default function MatrixPage() {
  const [cells, setCells] = useState<Map<string, RaciCell>>(new Map());
  const [loading, setLoading] = useState(true);

  function key(node: string, role: string) { return `${node}::${role}`; }

  async function load() {
    setLoading(true);
    const r = await fetch('/api/permission-matrix');
    const j = await r.json();
    const m = new Map<string, RaciCell>();
    for (const e of (j.data as Entry[])) {
      const k = key(e.nodeCode, e.roleCode);
      const cur = m.get(k);
      m.set(k, (cur === 'R' && e.raci === 'A') || (cur === 'A' && e.raci === 'R') ? 'RA' : (e.raci as RaciCell));
    }
    setCells(m); setLoading(false);
  }
  useEffect(() => { load(); }, []);

  function cycleCell(node: string, role: string) {
    const cur = cells.get(key(node, role)) ?? '';
    const next = CYCLE[(CYCLE.indexOf(cur) + 1) % CYCLE.length];
    const m = new Map(cells);
    m.set(key(node, role), next);
    setCells(m);
  }

  async function save() {
    const entries: Entry[] = [];
    for (const [k, v] of cells) {
      const [node, role] = k.split('::');
      if (v === 'R' || v === 'RA') entries.push({ nodeCode: node, roleCode: role, raci: 'R' });
      if (v === 'A' || v === 'RA') entries.push({ nodeCode: node, roleCode: role, raci: 'A' });
    }
    const r = await fetch('/api/permission-matrix', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entries }),
    });
    const j = await r.json();
    if (j.error) toast.error(j.error.message); else toast.success('已保存');
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            权限矩阵
          </h1>
          <p className="text-sm md:text-[15px] text-muted-foreground mt-1">
            R = 执行人 · A = 审批人 · RA = 同一角色执行且审批 · C/I 走通知,不在此表
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" disabled>重置默认</Button>
          <Button onClick={save}>保存</Button>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">角色 × 流程节点</CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            点击任意单元格切换:空 → R → A → RA → 空
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <div className="max-h-[70vh] overflow-auto rounded-md border border-slate-200">
              <table className="text-xs border-collapse w-full">
                <thead className="sticky top-0 z-20 bg-white">
                  <tr>
                    <th className="sticky left-0 z-30 bg-slate-100 border-b border-r border-slate-300 px-3 py-2 text-left font-medium text-slate-800 min-w-[240px]">
                      流程节点
                    </th>
                    {ROLE_LIST.map((r) => (
                      <th
                        key={r}
                        className="bg-slate-100 border-b border-slate-300 px-2 py-2 text-center font-medium text-slate-800"
                        style={{ minWidth: 88 }}
                      >
                        {ROLE_LABELS[r] ?? r}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {NODE_LIST.map((node, rowIdx) => (
                    <tr
                      key={node}
                      className={cn(rowIdx % 2 === 1 && 'bg-slate-50/40')}
                    >
                      <td
                        className={cn(
                          'sticky left-0 z-10 border-b border-r border-slate-200 px-3 py-2 font-medium text-slate-900 min-w-[240px]',
                          rowIdx % 2 === 1 ? 'bg-slate-50' : 'bg-white'
                        )}
                      >
                        {NODE_LABELS[node] ?? node}
                      </td>
                      {ROLE_LIST.map((role) => {
                        const v = cells.get(key(node, role)) ?? '';
                        return (
                          <td
                            key={role}
                            className="border-b border-slate-100 text-center p-0"
                            style={{ minWidth: 88 }}
                          >
                            <Button
                              variant="ghost"
                              size="sm"
                              className="w-[72px] h-8 p-0 rounded-none hover:bg-slate-100 mx-auto"
                              onClick={() => cycleCell(node, role)}
                            >
                              <CellBadge value={v} />
                            </Button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mt-4 text-[13px] text-muted-foreground">
            <span className="font-medium text-slate-700">图例:</span>
            <div className="flex items-center gap-1.5">
              <CellBadge value="R" />
              <span>执行人</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CellBadge value="A" />
              <span>审批人</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CellBadge value="RA" />
              <span>执行且审批</span>
            </div>
            <div className="flex items-center gap-1.5">
              <CellBadge value="" />
              <span>无权限</span>
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            提示: 改动后点右上 "保存" 才生效。super_admin 角色不在此表显示,默认拥有全部节点权限。
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
