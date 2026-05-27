import type { FastifyInstance } from 'fastify';
import { loginSchema } from '@tax/shared/types/user';
import {
  findUserByEmail,
  findUserById,
  signTokens,
  toPublicUser,
  verifyPassword,
  verifyRefreshToken,
} from '../services/auth.js';

const REFRESH_COOKIE = 'refresh_token';
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/auth',
    maxAge: REFRESH_MAX_AGE_SECONDS,
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post('/auth/login', async (req, reply) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { message: 'Invalid login payload', code: 'VALIDATION' } });
    }

    const user = await findUserByEmail(parsed.data.email);
    if (!user || !user.isActive) {
      return reply
        .code(401)
        .send({ error: { message: 'Invalid email or password', code: 'BAD_CREDENTIALS' } });
    }

    const ok = await verifyPassword(parsed.data.password, user.passwordHash);
    if (!ok) {
      return reply
        .code(401)
        .send({ error: { message: 'Invalid email or password', code: 'BAD_CREDENTIALS' } });
    }

    const publicUser = toPublicUser(user);
    const { accessToken, refreshToken } = signTokens(app, publicUser);

    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return reply.send({ data: { accessToken, user: publicUser } });
  });

  app.post('/auth/refresh', async (req, reply) => {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) {
      return reply
        .code(401)
        .send({ error: { message: 'Missing refresh token', code: 'NO_REFRESH' } });
    }

    let decoded: { sub: string };
    try {
      decoded = verifyRefreshToken(app, token);
    } catch {
      reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      return reply
        .code(401)
        .send({ error: { message: 'Invalid refresh token', code: 'BAD_REFRESH' } });
    }

    const user = await findUserById(decoded.sub);
    if (!user || !user.isActive) {
      reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
      return reply
        .code(401)
        .send({ error: { message: 'User not found', code: 'USER_GONE' } });
    }

    const publicUser = toPublicUser(user);
    const { accessToken, refreshToken } = signTokens(app, publicUser);

    reply.setCookie(REFRESH_COOKIE, refreshToken, refreshCookieOptions());

    return reply.send({ data: { accessToken, user: publicUser } });
  });

  app.post('/auth/logout', async (_req, reply) => {
    reply.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return reply.send({ data: { ok: true } });
  });

  app.get('/auth/me', { preHandler: [app.authenticate] }, async (req) => {
    const { sub, email, name, role } = req.user;
    return { data: { user: { id: sub, email, name, role } } };
  });
}
