import { Badge } from '@/components/ui/badge';

/** 测试数据标签. show 为假时不渲染. 真实数据上线后用于区分 demo/测试数据. */
export function TestBadge({ show }: { show: boolean | null | undefined }) {
  if (!show) return null;
  return (
    <Badge className="bg-amber-100 text-amber-800 border border-amber-300 font-normal">
      测试
    </Badge>
  );
}
