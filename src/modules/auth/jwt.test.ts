import { describe, it, expect } from 'vitest';
import { signToken, verifyToken } from './jwt';

describe('jwt', () => {
  it('sign 然后 verify 能拿回 payload', () => {
    const token = signToken({ userId: 42, roles: ['rd_director'], primaryRole: 'rd_director', tokenVersion: 0 });
    const payload = verifyToken(token);
    expect(payload.userId).toBe(42);
    expect(payload.roles).toEqual(['rd_director']);
    expect(payload.primaryRole).toBe('rd_director');
    expect(payload.tokenVersion).toBe(0);
  });

  it('错误签名抛错', () => {
    expect(() => verifyToken('not-a-token')).toThrow();
  });
});
