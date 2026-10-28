// src/http/plugins/authenticate.ts
// Hook de autenticação JWT — verifica token e popula request.user
// Também valida se a sessão foi revogada (logout, troca de senha)
// e se o profissional de saúde já validou o TOTP nesta sessão

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../infrastructure/database/prisma.client';
import { UnauthorizedError, ForbiddenError } from '../errors/handler';
import { Role } from '../../domain/enums';
import { requiresMfa } from '../../shared/constants';

/** Somente access tokens: refresh tokens não têm `type: 'access'` nem papel */
const AccessClaimsSchema = z.object({
  sub: z.string().min(1),
  email: z.string(),
  role: z.enum(Role),
  sessionId: z.string().min(1),
  type: z.literal('access'),
});

/**
 * Decora o Fastify com os hooks de autenticação e autorização.
 * Uso nas rotas:
 *   { preHandler: [fastify.authenticate] }
 *   { preHandler: [fastify.authenticate, fastify.requireRole('DOCTOR')] }
 */
export default fp(async (fastify: FastifyInstance) => {
  /**
   * Verifica o JWT e valida a sessão no banco.
   * Rejeita tokens de sessões revogadas (logout, MFA reset) e, para
   * médicos e nutricionistas, sessões que ainda não passaram pelo TOTP.
   */
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const claims = AccessClaimsSchema.safeParse(await request.jwtVerify());
      if (!claims.success) {
        throw new UnauthorizedError('Token inválido.');
      }
      const { sub: userId, email, role, sessionId } = claims.data;

      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { userId: true, revokedAt: true, expiresAt: true, mfaVerifiedAt: true },
      });

      if (!session || session.userId !== userId || session.revokedAt !== null) {
        throw new UnauthorizedError('Sessão encerrada. Faça login novamente.');
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
      }

      if (
        requiresMfa(role) &&
        session.mfaVerifiedAt === null &&
        request.routeOptions.config.allowPendingMfa !== true
      ) {
        throw new ForbiddenError(
          'Verificação em duas etapas pendente. Conclua em /auth/mfa/setup e /auth/mfa/verify.',
          'MFA_REQUIRED',
        );
      }

      request.user = { id: userId, email, role, sessionId };
    },
  );

  /**
   * Middleware de autorização por papel.
   * Deve ser usado APÓS fastify.authenticate.
   */
  fastify.decorate(
    'requireRole',
    (...roles: Role[]) =>
      async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
        if (!roles.includes(request.user.role)) {
          throw new ForbiddenError(
            'Seu perfil não tem permissão para esta ação.',
          );
        }
      },
  );
});

// Extensão dos tipos Fastify para os decorators
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    requireRole: (
      ...roles: Role[]
    ) => (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
