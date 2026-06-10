import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '@/shared/prisma';
import { upsertBookEntry, getBookEntry } from './finance-book-service';

let userId: number;

beforeEach(async () => {
  userId = (
    await prisma.user.create({
      data: { username: 'u', employeeId: 'U1', name: 'u', passwordHash: 'x' },
    })
  ).id;
});

describe('upsertBookEntry', () => {
  it('新建 + 同月再 upsert 覆盖', async () => {
    const a = await upsertBookEntry(userId, 2026, 5, 120000, '5月账面');
    expect(Number(a.bookAmount)).toBeCloseTo(120000, 2);
    expect(a.note).toBe('5月账面');

    const b = await upsertBookEntry(userId, 2026, 5, 130000);
    expect(b.id).toBe(a.id); // 同 (year,month) 同一条
    expect(Number(b.bookAmount)).toBeCloseTo(130000, 2);
    expect(b.note).toBeNull();

    await expect(upsertBookEntry(userId, 2026, 5, -1)).rejects.toThrow(/不能为负/);
  });
});

describe('getBookEntry', () => {
  it('查已录入 + 未录入返 null', async () => {
    await upsertBookEntry(userId, 2026, 6, 50000);
    const got = await getBookEntry(2026, 6);
    expect(got).not.toBeNull();
    expect(Number(got!.bookAmount)).toBeCloseTo(50000, 2);

    const none = await getBookEntry(2026, 7);
    expect(none).toBeNull();
  });
});
