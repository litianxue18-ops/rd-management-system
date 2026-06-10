-- 库存余量 view: 从 inventory_ledger SUM(change_qty) 聚合, 同步带物料/仓库基础属性
-- 入库写 +, 出库写 -, 退库写 + → 任意时刻 SUM = 当前余量
-- 用 CREATE OR REPLACE 保持幂等 (CI 多次跑无副作用)
CREATE OR REPLACE VIEW v_inventory_balance AS
SELECT
  l.material_id,
  l.warehouse_id,
  SUM(l.change_qty)::numeric(14,2) AS balance,
  MAX(l.occurred_at) AS last_movement_at,
  m.code AS material_code,
  m.name AS material_name,
  m.unit,
  m.safety_stock,
  m.max_stock,
  w.code AS warehouse_code,
  w.name AS warehouse_name
FROM inventory_ledger l
JOIN material m ON m.id = l.material_id
JOIN warehouse w ON w.id = l.warehouse_id
GROUP BY l.material_id, l.warehouse_id, m.code, m.name, m.unit, m.safety_stock, m.max_stock, w.code, w.name;
