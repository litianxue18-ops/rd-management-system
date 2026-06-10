import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { superviseDirectly } from '@/modules/sample/sample-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

export const POST = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const jwt = await requireAuth(req);
    await requireNode(jwt, PERMISSION_NODES.SAMPLE_SCRAP_SUPERVISE);
    const { id } = await params;
    await superviseDirectly(Number(id), jwt.userId);
    return Response.json({ data: { ok: true } });
  },
);
