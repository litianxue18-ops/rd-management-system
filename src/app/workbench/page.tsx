import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { verifyToken } from '@/modules/auth/jwt';
import { prisma } from '@/shared/prisma';
import { ROLE_CODES as R } from '@/modules/permission/nodes';
import GenericWorkbench from './generic-page';

/**
 * 服务端按 primaryRole 路由到具体 workbench:
 * - super_admin / rd_director → 暂无专门工作台, 走 admin 配置入口
 * - project_lead → /workbench/project-lead
 * - researcher → /workbench/researcher
 * - 其他 → fallback 通用 DingTalk app grid
 *
 * 注: 子路径 (/workbench/researcher 等) 用 `?force=1` 或直接访问就不会触发 redirect.
 */
export default async function WorkbenchEntry() {
  const token = (await cookies()).get('token')?.value;
  if (!token) redirect('/login?redirect=/workbench');

  let payload;
  try {
    payload = verifyToken(token);
  } catch {
    redirect('/login?redirect=/workbench');
  }

  // tokenVersion 校验, 失效就回登录
  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { tokenVersion: true, isActive: true },
  });
  if (!user || !user.isActive || user.tokenVersion !== payload.tokenVersion) {
    redirect('/login?redirect=/workbench');
  }

  const primary = payload.primaryRole;
  if (primary === R.PROJECT_LEAD) redirect('/workbench/project-lead');
  if (primary === R.RESEARCHER) redirect('/workbench/researcher');
  if (primary === R.WAREHOUSE_KEEPER) redirect('/workbench/warehouse');
  if (primary === R.PRODUCTION_LEAD) redirect('/workbench/production');
  if (primary === R.FINANCE_LEAD) redirect('/workbench/finance');
  if (primary === R.RD_DIRECTOR) redirect('/workbench/rd-director');
  if (primary === R.CEO) redirect('/workbench/ceo');
  if (primary === R.TECH_COMMITTEE) redirect('/workbench/tech-committee');
  if (primary === R.AUDIT_LEAD) redirect('/workbench/audit');
  // super_admin / purchase_lead / equipment_lead / hr_lead 暂走通用 grid
  return <GenericWorkbench />;
}
