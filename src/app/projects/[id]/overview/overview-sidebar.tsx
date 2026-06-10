'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
}

const SECTIONS: NavItem[] = [
  { id: 'basic', label: '1. 基本信息' },
  { id: 'members', label: '2. 项目成员' },
  { id: 'workhour', label: '3. 工时明细' },
  { id: 'material', label: '4. 物料消耗' },
  { id: 'sample', label: '5. 样品 / 废料' },
  { id: 'trial', label: '6. 试制任务' },
  { id: 'outsource', label: '7. 委外' },
  { id: 'monthly', label: '8. 月度报告' },
  { id: 'changes', label: '9. 项目变更' },
  { id: 'capitalization', label: '10. 资本化' },
  { id: 'cost', label: '11. 费用归集' },
  { id: 'closing', label: '12. 结项档案' },
];

/**
 * sticky 左侧目录 + scroll-spy。
 *
 * 用 IntersectionObserver 监听 12 个 section, 主区滚动时自动高亮当前 section,
 * 且高亮项自动滚入侧栏视野 (主滑动带动侧栏)。
 *
 * rootMargin 顶部负值 ≈ sticky header 高度 (~144px), 让高亮在 section 滚到
 * header 下方时才切换。
 */
export function OverviewSidebar() {
  const [activeId, setActiveId] = useState<string>('basic');
  const navRefs = useRef<Record<string, HTMLAnchorElement | null>>({});

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        // 选取最靠近顶部且可见的 section
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length > 0) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: '-140px 0px -60% 0px', threshold: 0 },
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  // active 项自动滚入侧栏视野 (主滑动带动侧栏)
  useEffect(() => {
    const el = navRefs.current[activeId];
    if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeId]);

  function jump(e: React.MouseEvent<HTMLAnchorElement>, id: string) {
    e.preventDefault();
    setActiveId(id);
    const el = document.getElementById(id);
    if (el) {
      // 顶部 sticky header 占 ~ 9rem, 留点 offset 避免被遮挡
      const top = el.getBoundingClientRect().top + window.scrollY - 140;
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', `#${id}`);
    }
  }

  return (
    <nav className="hidden md:block sticky top-36 w-60 shrink-0 self-start max-h-[calc(100vh-11rem)] overflow-y-auto pr-2 text-sm">
      <div className="text-xs text-muted-foreground mb-3 px-3 font-medium tracking-wide">
        档案目录
      </div>
      <ul className="space-y-1">
        {SECTIONS.map((s) => {
          const isActive = activeId === s.id;
          return (
            <li key={s.id}>
              <a
                ref={(el) => {
                  navRefs.current[s.id] = el;
                }}
                href={`#${s.id}`}
                onClick={(e) => jump(e, s.id)}
                className={cn(
                  'block px-3 py-1.5 rounded-r border-l-4 transition-colors',
                  isActive
                    ? 'bg-blue-100 border-blue-600 font-semibold text-blue-900'
                    : 'border-transparent text-slate-700 hover:bg-slate-100 hover:text-slate-900',
                )}
              >
                {s.label}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
