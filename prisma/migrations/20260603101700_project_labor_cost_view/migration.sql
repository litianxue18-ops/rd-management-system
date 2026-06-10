-- 项目人工费归集 view: 已批准工时 × 用户小时成本 = 人工费
-- 用 CREATE OR REPLACE 保持幂等 (CI 多次跑无副作用)
CREATE OR REPLACE VIEW v_project_labor_cost AS
SELECT
  p.id AS project_id,
  p.code,
  p.name,
  COALESCE(SUM(w.hours * u.hourly_cost), 0)::numeric(14,2) AS labor_cost,
  COALESCE(SUM(w.hours), 0)::numeric(10,1) AS total_hours,
  COUNT(DISTINCT w.user_id)::int AS participant_count
FROM project p
LEFT JOIN workhour_entry w ON w.project_id = p.id AND w.status = 'approved'
LEFT JOIN "user" u ON u.id = w.user_id
GROUP BY p.id, p.code, p.name;
