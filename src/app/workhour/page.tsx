'use client';

import { useState } from 'react';
import { WeekGrid } from '@/shared/components/week-grid';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight } from 'lucide-react';

function getWeekStart(d: Date): Date {
  const day = d.getDay() || 7; // 周日 → 7
  const monday = new Date(d);
  monday.setDate(d.getDate() - day + 1);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function fmtDate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function WorkhourPage() {
  const [weekStart, setWeekStart] = useState<Date>(getWeekStart(new Date()));

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  function shift(days: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + days);
    d.setHours(0, 0, 0, 0);
    setWeekStart(d);
  }

  function backToThisWeek() {
    setWeekStart(getWeekStart(new Date()));
  }

  const isThisWeek = ymd(weekStart) === ymd(getWeekStart(new Date()));

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl md:text-2xl xl:text-3xl font-semibold tracking-tight">
            我的工时
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            按周填报, 提交后由项目负责人审核
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => shift(-7)}>
            <ChevronLeft size={16} />
          </Button>
          <span className="text-sm font-mono tabular-nums px-3 min-w-[180px] text-center">
            {fmtDate(weekStart)} ~ {fmtDate(weekEnd)}
          </span>
          <Button variant="outline" size="sm" onClick={() => shift(7)}>
            <ChevronRight size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={backToThisWeek}
            disabled={isThisWeek}
          >
            本周
          </Button>
        </div>
      </div>
      <WeekGrid weekStart={weekStart} />
    </div>
  );
}

function ymd(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}
