import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileQuestion } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
      <FileQuestion size={48} className="text-slate-300 mb-4" />
      <h1 className="text-2xl font-semibold text-slate-900 mb-2">404 · 页面不存在</h1>
      <p className="text-sm text-muted-foreground mb-4">该地址不存在或已被移除</p>
      <Button asChild>
        <Link href="/workbench">回到工作台</Link>
      </Button>
    </div>
  );
}
