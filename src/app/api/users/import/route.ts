import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { importRoster } from '@/modules/org/roster-import';
import { requireNode } from '@/modules/permission/engine';
import { PERMISSION_NODES } from '@/modules/permission/nodes';

const MAX_BYTES = 10 * 1024 * 1024; // 10MB

export const POST = withErrorHandler(async (req: NextRequest) => {
  const jwt = await requireAuth(req);
  await requireNode(jwt, PERMISSION_NODES.ADMIN_USER_MANAGE);
  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return Response.json({ error: { code: 'NO_FILE', message: '未上传文件' } }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: { code: 'FILE_TOO_LARGE', message: '文件超过 10MB 上限' } },
      { status: 413 },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const result = await importRoster(buf);
  return Response.json({ data: result });
});
