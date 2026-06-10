import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { prisma } from '@/shared/prisma';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_VIEW);
  const data = await prisma.rolePermissionNode.findMany({
    include: { role: true },
    orderBy: [{ nodeCode: 'asc' }, { roleId: 'asc' }],
  });
  return Response.json({
    data: data.map((e) => ({ roleCode: e.role.code, nodeCode: e.nodeCode, raci: e.raci })),
  });
});

const UpdateInput = z.object({
  entries: z.array(z.object({ roleCode: z.string(), nodeCode: z.string(), raci: z.enum(['R', 'A']) })),
});

export const PUT = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_MATRIX_EDIT);
  const { entries } = UpdateInput.parse(await readJson(req));
  const roles = new Map((await prisma.role.findMany()).map((r) => [r.code, r.id]));
  await prisma.$transaction([
    prisma.rolePermissionNode.deleteMany(),
    prisma.rolePermissionNode.createMany({
      data: entries.map((e) => ({
        roleId: roles.get(e.roleCode)!,
        nodeCode: e.nodeCode,
        raci: e.raci,
      })),
    }),
  ]);
  return Response.json({ data: { ok: true, count: entries.length } });
});
