import jwt, { type SignOptions } from 'jsonwebtoken';

export interface JwtPayload {
  userId: number;
  roles: string[];
  primaryRole: string;
  tokenVersion: number;
}

function secret(): string {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error('JWT_SECRET not set');
  return s;
}

export function signToken(payload: JwtPayload): string {
  const ttl = process.env.JWT_EXPIRES_IN || '12h';
  const opts: SignOptions = { expiresIn: ttl as SignOptions['expiresIn'] };
  return jwt.sign(payload, secret(), opts);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, secret()) as JwtPayload;
}
