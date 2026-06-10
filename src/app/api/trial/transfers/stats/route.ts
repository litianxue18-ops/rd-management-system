import '@/app/bootstrap';
import { NextRequest } from 'next/server';
import { withErrorHandler, requireAuth } from '@/shared/api-helpers';
import { statsByProject } from '@/modules/trial/transfer-service';

/** 报表 1.5 数据源: 按项目聚合试制费用转嫁额 (含 settled 子集). */
export const GET = withErrorHandler(async (req: NextRequest) => {
  await requireAuth(req);
  return Response.json({ data: await statsByProject() });
});
