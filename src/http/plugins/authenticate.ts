// src/http/plugins/authenticate.ts
// Hook de autenticação JWT — verifica token e popula request.user
// Também valida se a sessão foi revogada (logout, troca de senha)

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../infrastructure/database/prisma.client';
import { UnauthorizedError, ForbiddenError } from '../errors/handler';
import { Role } from '../../domain/enums';
import { MFA_REQUIRED_ROLES } from '../../shared/constants';

/**
 * Decora o Fastify com os hooks de autenticação e autorização.
 * Uso nas rotas:
 *   { preHandler: [fastify.authenticate] }
 *   { preHandler: [fastify.authenticate, fastify.requireRole('DOCTOR')] }
 */
export default fp(async (fastify: FastifyInstance) => {
  /**
   * Verifica o JWT e valida a sessão no banco.
   * Rejeita tokens de sessões revogadas (logout, MFA reset).
   */
  fastify.decorate(
    'authenticate',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      await request.jwtVerify();

      const { sub: userId, sessionId } = request.user as {
        sub: string;
        sessionId: string;
        email: string;
        role: Role;
      };

      // Verifica se a sessão ainda é válida no banco
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { revokedAt: true, expiresAt: true },
      });

      if (!session || session.revokedAt !== null) {
        throw new UnauthorizedError('Sessão encerrada. Faça login novamente.');
      }

      if (session.expiresAt < new Date()) {
        throw new UnauthorizedError('Sessão expirada. Faça login novamente.');
      }

      // Popula request.user com os dados do JWT (já validados)
      const payload = request.user as {
        sub: string;
        email: string;
        role: Role;
        sessionId: string;
      };

      request.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        sessionId: payload.sessionId,
      };

      void userId; // usado indiretamente via payload.sub
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

  /**
   * Valida que profissionais completaram o MFA antes de acessar rotas clínicas.
   */
  fastify.decorate(
    'requireMfa',
    async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      if (
        (MFA_REQUIRED_ROLES as readonly string[]).includes(request.user.role)
      ) {
        const user = await prisma.user.findUnique({
          where: { id: request.user.id },
          select: { mfaEnabled: true },
        });

        if (!user?.mfaEnabled) {
          throw new ForbiddenError(
            'MFA obrigatório para profissionais de saúde. Configure em /auth/mfa/setup.',
          );
        }
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
    requireMfa: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
  }
}
