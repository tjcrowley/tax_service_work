import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { db } from '../db/index.js';
import { users, type UserRow } from '../db/schema/users.js';

export type AuthenticatedUser = {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
};

export type TokenPair = {
  accessToken: string;
  refreshToken: string;
};

export async function findUserByEmail(email: string): Promise<UserRow | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase()),
  });
  return row ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const row = await db.query.users.findFirst({
    where: eq(users.id, id),
  });
  return row ?? null;
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function toPublicUser(row: UserRow): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
  };
}

export function signTokens(app: FastifyInstance, user: AuthenticatedUser): TokenPair {
  const accessToken = app.jwt.sign(
    { sub: user.id, email: user.email, role: user.role, name: user.name },
    { expiresIn: '15m' },
  );
  const refreshPayload = { sub: user.id, email: user.email, role: user.role, name: user.name };
  const refreshToken = app.jwt.sign(refreshPayload, {
    key: process.env.JWT_REFRESH_SECRET as string,
    expiresIn: '7d',
  });
  return { accessToken, refreshToken };
}

export function verifyRefreshToken(app: FastifyInstance, token: string): { sub: string } {
  return app.jwt.verify<{ sub: string }>(token, {
    key: process.env.JWT_REFRESH_SECRET as string,
  });
}
