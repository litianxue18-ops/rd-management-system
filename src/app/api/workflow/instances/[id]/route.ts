import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { BusinessError } from '@/shared/errors';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const instance = await prisma.approvalInstance.findUnique({
      where: { id: Number(id) },
      include: { steps: { orderBy: { stepIndex: 'asc' } } },
    });
    if (!instance) throw new BusinessError('审批实例不存在', 'NOT_FOUND');

    // 拉一下业务实体摘要 (按 entityType 分支)
    let entitySummary: { name?: string; code?: string } | null = null;
    if (instance.entityType === 'project') {
      const p = await prisma.project.findUnique({
        where: { id: instance.entityId },
        select: { name: true, code: true },
      });
      if (p) entitySummary = { name: p.name, code: p.code };
    } else if (instance.entityType === 'project_change') {
      const ch = await prisma.projectChangeRequest.findUnique({
        where: { id: instance.entityId },
        select: { reason: true, projectId: true },
      });
      if (ch) {
        const p = await prisma.project.findUnique({
          where: { id: ch.projectId },
          select: { name: true, code: true },
        });
        entitySummary = {
          name: `${p?.name ?? '项目'} 变更: ${ch.reason}`,
          code: p?.code,
        };
      }
    }

    return Response.json({ data: { ...instance, entitySummary } });
  },
);
