import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { appendLedger } from './ledger';
import { listBalance } from './balance-query';

let matA: number, whMain: number, opId: number;

beforeEach(async () => {
  matA = (
    await prisma.material.create({
      data: { code: 'M-A', name: '物料 A', unit: 'kg' },
    })
  ).id;
  whMain = (
    await prisma.warehouse.create({ data: { code: 'wh-main', name: '主仓' } })
  ).id;
  opId = (
    await prisma.user.create({
      data: { username: 'op', employeeId: 'OP', name: 'op', passwordHash: 'x' },
    })
  ).id;
});

describe('listBalance 滚动指标', () => {
  it('入库100出库30 → inbound30d=100 / outbound30d=30 / 库存价值=余量×单价', async () => {
    // 入库 100 (带单价 5)
    await prisma.inventoryInbound.create({
      data: {
        docNo: 'IN-1',
        materialId: matA,
        warehouseId: whMain,
        quantity: 100,
        unitPrice: 5,
        receivedAt: new Date(),
        operatorId: opId,
      },
    });
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 100,
        sourceType: 'inbound',
        sourceId: 1,
        operatorId: opId,
      }),
    );
    // 出库 30 (change_qty 为负)
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'outbound',
        changeQty: -30,
        sourceType: 'outbound',
        sourceId: 1,
        operatorId: opId,
      }),
    );

    const rows = await listBalance({ materialId: matA, warehouseId: whMain });
    expect(rows).toHaveLength(1);
    const r = rows[0];
    expect(r.balance).toBe(70);
    expect(r.inbound30d).toBe(100);
    expect(r.outbound30d).toBe(30); // 取绝对值
    expect(r.unitPrice).toBe(5);
    expect(r.stockValue).toBe(350); // 余量 70 × 单价 5
  });

  it('周转天数 = 余量 / (近90天出库总量 / 90); 无出库 → null', async () => {
    // 余量 90, 近 90 天出库总量 30 → 日均 30/90=0.333 → 周转 90/0.333=270 天
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 120,
        sourceType: 'inbound',
        sourceId: 1,
        operatorId: opId,
      }),
    );
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'outbound',
        changeQty: -30,
        sourceType: 'outbound',
        sourceId: 1,
        operatorId: opId,
      }),
    );
    const rows = await listBalance({ materialId: matA, warehouseId: whMain });
    expect(rows).toHaveLength(1);
    expect(rows[0].balance).toBe(90);
    // 90 / (30 / 90) = 270
    expect(rows[0].turnoverDays).toBeCloseTo(270, 5);
    expect(rows[0].unitPrice).toBeNull(); // 无 inbound 记录单价
    expect(rows[0].stockValue).toBe(0); // 无单价 → 0

    // 无出库的物料 → turnoverDays null
    const matB = (
      await prisma.material.create({
        data: { code: 'M-B', name: '物料 B', unit: '个' },
      })
    ).id;
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matB,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 50,
        sourceType: 'inbound',
        sourceId: 2,
        operatorId: opId,
      }),
    );
    const rowsB = await listBalance({ materialId: matB, warehouseId: whMain });
    expect(rowsB[0].turnoverDays).toBeNull();
  });
});
