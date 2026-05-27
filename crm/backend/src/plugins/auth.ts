import fp from 'fastify-plugin';
import fastifyJwt from '@fastify/jwt';
import fastifyCookie from '@fastify/cookie';
import type { FastifyReply, FastifyRequest } from 'fastify';

type JwtPayload = {
  sub: string;
  email: string;
  name: string;
  role: 'admin' | 'agent' | 'viewer';
};

declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (req: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }

  interface FastifyRequest {
    user: JwtPayload;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: JwtPayload;
  }
}

export default fp(async (app) => {
  const accessSecret = process.env.JWT_SECRET;
  const refreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!accessSecret) throw new Error('JWT_SECRET env var is not set');
  if (!refreshSecret) throw new Error('JWT_REFRESH_SECRET env var is not set');

  await app.register(fastifyCookie);

  await app.register(fastifyJwt, {
    secret: accessSecret,
    sign: { expiresIn: '15m' },
  });

  app.decorate('authenticate', async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      await req.jwtVerify();
    } catch {
      reply.code(401).send({ error: { message: 'Unauthorized', code: 'UNAUTHORIZED' } });
    }
  });
});
