import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { getClosing, markArchived } from '@/modules/closing/closing-service';
import { generateArchiveMetadata } from '@/modules/closing/archive-service';
import { BusinessError } from '@/shared/errors';

/**
 * 下载档案 (JSON), 同时把 closingReport.archivedAt 标记为当前时间.
 * 当前实现为 JSON; 后续可扩展打包为 ZIP.
 */
export const GET = withErrorHandler(
  async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    await requireAuth(req);
    const { id } = await params;
    const closingId = Number(id);

    const closing = await getClosing(closingId);
    if (!closing) throw new BusinessError('结项报告不存在', 'NOT_FOUND');

    const metadata = await generateArchiveMetadata(closing.projectId);
    await markArchived(closingId);

    const today = new Date().toISOString().slice(0, 10);
    const filename = `${closing.project.code}-档案-${today}.json`;
    const encodedFilename = encodeURIComponent(filename);

    return new Response(JSON.stringify(metadata, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      },
    });
  },
);
