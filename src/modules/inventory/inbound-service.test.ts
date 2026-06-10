import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { createInbound, importInitInbound } from './inbound-service';
import { getBalance } from './ledger';

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

describe('createInbound', () => {
  it('happy path 写 inbound + ledger 一致 (balanceAfter)', async () => {
    const inb = await createInbound(opId, {
      materialId: matA,
      warehouseId: whMain,
      quantity: 50,
      unitPrice: 12.5,
      supplier: 'ACME',
      batchNo: 'B1',
      receivedAt: new Date('2026-06-01'),
    });
    expect(inb.docNo).toMatch(/^IN-\d{4}-\d{3}$/);
    expect(Number(inb.quantity)).toBe(50);
    expect(inb.changeType).toBe('inbound');
    expect(inb.operatorId).toBe(opId);

    const ledger = await prisma.inventoryLedger.findFirstOrThrow({
      where: { sourceType: 'inbound', sourceId: inb.id, materialId: matA },
    });
    expect(Number(ledger.changeQty)).toBe(50);
    expect(Number(ledger.balanceAfter)).toBe(50);

    expect(await getBalance(matA, whMain)).toBe(50);
  });

  it('quantity <= 0 抛 BusinessError', async () => {
    await expect(
      createInbound(opId, {
        materialId: matA,
        warehouseId: whMain,
        quantity: 0,
        receivedAt: new Date(),
      }),
    ).rejects.toThrow(/入库数量必须 > 0/);
    await expect(
      createInbound(opId, {
        materialId: matA,
        warehouseId: whMain,
        quantity: -10,
        receivedAt: new Date(),
      }),
    ).rejects.toThrow(/入库数量必须 > 0/);
  });
});

describe('importInitInbound', () => {
  it('正常 3 行: created=3, skipped=0, errors=0', async () => {
    const res = await importInitInbound(opId, [
      { materialCode: 'M-A', warehouseCode: 'wh-main', quantity: 100 },
      { materialCode: 'M-A', warehouseCode: 'wh-trial', quantity: 30 },
      { materialCode: 'M-B', warehouseCode: 'wh-main', quantity: 50 },
    ]);
    expect(res.created).toBe(3);
    expect(res.skipped).toBe(0);
    expect(res.errors).toEqual([]);
    expect(await getBalance(matA, whMain)).toBe(100);
    expect(await getBalance(matA, whTrial)).toBe(30);
    expect(await getBalance(matB, whMain)).toBe(50);
  });

  it('同 material+warehouse 重复 init 跳过', async () => {
    await importInitInbound(opId, [
      { materialCode: 'M-A', warehouseCode: 'wh-main', quantity: 100 },
    ]);
    const res2 = await importInitInbound(opId, [
      { materialCode: 'M-A', warehouseCode: 'wh-main', quantity: 999 }, // dup
      { materialCode: 'M-B', warehouseCode: 'wh-main', quantity: 20 }, // new
    ]);
    expect(res2.created).toBe(1);
    expect(res2.skipped).toBe(1);
    expect(res2.errors).toEqual([]);
    // 第一笔 100 不被覆盖
    expect(await getBalance(matA, whMain)).toBe(100);
    expect(await getBalance(matB, whMain)).toBe(20);
  });

  it('物料编码不存在 → 该行进 errors, 其他行不受影响', async () => {
    const res = await importInitInbound(opId, [
      { materialCode: 'M-A', warehouseCode: 'wh-main', quantity: 10 },
      { materialCode: 'M-NOPE', warehouseCode: 'wh-main', quantity: 20 },
      { materialCode: 'M-B', warehouseCode: 'wh-WAT', quantity: 30 },
      { materialCode: 'M-B', warehouseCode: 'wh-main', quantity: 0 },
    ]);
    expect(res.created).toBe(1);
    expect(res.errors).toHaveLength(3);
    expect(res.errors[0]).toMatchObject({ row: 3, message: /物料编码不存在/ });
    expect(res.errors[1]).toMatchObject({ row: 4, message: /仓库编码不存在/ });
    expect(res.errors[2]).toMatchObject({ row: 5, message: /数量必须 > 0/ });
    expect(await getBalance(matA, whMain)).toBe(10);
  });
});
