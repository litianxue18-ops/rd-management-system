import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import {
  getProjectLaborCost,
  getProjectLaborCostBreakdown,
} from '@/modules/workhour/labor-cost';

export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const projectId = Number(id);
    const [summary, breakdown] = await Promise.all([
      getProjectLaborCost(projectId),
      getProjectLaborCostBreakdown(projectId),
    ]);
    return Response.json({ data: { summary, breakdown } });
  },
);
