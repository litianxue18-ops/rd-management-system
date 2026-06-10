-- 试制生产任务单 status 增加 rejected (workflow 驳回时用)
ALTER TYPE "TrialOrderStatus" ADD VALUE 'rejected';
