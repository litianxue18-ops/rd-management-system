import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { appendLedger, getBalance } from './ledger';

let matA: number, matB: number, whMain: number, whTrial: number, opId: number;

beforeEach(async () => {
  matA = (
    await prisma.material.create({
      data: { code: 'M-A', name: '物料 A', unit: 'kg' },
    })
  ).id;
  matB = (
    await prisma.material.create({
      data: { code: 'M-B', name: '物料 B', unit: '个' },
    })
  ).id;
  whMain = (
    await prisma.warehouse.create({ data: { code: 'wh-main', name: '主仓' } })
  ).id;
  whTrial = (
    await prisma.warehouse.create({ data: { code: 'wh-trial', name: '试制仓' } })
  ).id;
  opId = (
    await prisma.user.create({
      data: {
        username: 'op',
        employeeId: 'OP',
        name: 'op',
        passwordHash: 'x',
      },
    })
  ).id;
});

describe('appendLedger', () => {
  it('写一笔入库 → balanceAfter = changeQty', async () => {
    const e = await prisma.$transaction((tx) =>
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
    expect(Number(e.balanceAfter)).toBe(100);
  });

  it('多笔后 getBalance = SUM(change_qty)', async () => {
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'init',
        changeQty: 50,
        sourceType: 'init',
        sourceId: 1,
        operatorId: opId,
      }),
    );
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 30,
        sourceType: 'inbound',
        sourceId: 2,
        operatorId: opId,
      }),
    );
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'outbound',
        changeQty: -20,
        sourceType: 'outbound',
        sourceId: 3,
        operatorId: opId,
      }),
    );
    expect(await getBalance(matA, whMain)).toBe(60);
  });

  it('不同 (material, warehouse) 组合余量独立计算', async () => {
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 10,
        sourceType: 'inbound',
        sourceId: 1,
        operatorId: opId,
      }),
    );
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matA,
        warehouseId: whTrial,
        changeType: 'inbound',
        changeQty: 20,
        sourceType: 'inbound',
        sourceId: 2,
        operatorId: opId,
      }),
    );
    await prisma.$transaction((tx) =>
      appendLedger(tx, {
        materialId: matB,
        warehouseId: whMain,
        changeType: 'inbound',
        changeQty: 30,
        sourceType: 'inbound',
        sourceId: 3,
        operatorId: opId,
      }),
    );
    expect(await getBalance(matA, whMain)).toBe(10);
    expect(await getBalance(matA, whTrial)).toBe(20);
    expect(await getBalance(matB, whMain)).toBe(30);
    expect(await getBalance(matB, whTrial)).toBe(0);
  });
});
