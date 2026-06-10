import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth, readJson } from '@/shared/api-helpers';
import { createProjectType, listProjectTypes } from '@/modules/dict/project-type-service';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';
import { z } from 'zod';

export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  const includeDisabled = req.nextUrl.searchParams.get('includeDisabled') === '1';
  return Response.json({ data: await listProjectTypes({ includeDisabled }) });
});

const CreateInput = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
});

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_DICT_MANAGE);
  const input = CreateInput.parse(await readJson(req));
  return Response.json({ data: await createProjectType(input) });
});
