import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './password';

describe('password', () => {
  it('hash 然后 verify 通过', async () => {
    const h = await hashPassword('hello123');
    expect(await verifyPassword('hello123', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
  });
});
