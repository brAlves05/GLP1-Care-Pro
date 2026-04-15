// src/http/plugins/audit.ts
// Hook de auditoria LGPD — registra toda ação sobre dados sensíveis
// REGRA: AuditLog é append-only (sem UPDATE/DELETE)

import fp from 'fastify-plugin';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../../infrastructure/database/prisma.client';

/** Mapeamento de método+rota para recurso e ação auditáveis */
interface AuditContext {
  resource: string;
  action: string;
}

/** Rotas que não precisam de auditoria (ex: health check, auth/login já tem log próprio) */
const AUDIT_SKIP_PATHS = new Set(['/health', '/metrics']);

/**
 * Extrai o recurso clínico afetado com base na rota.
 * Ex: PATCH /treatments/abc123/dose → { resource: 'Treatment', action: 'UPDATE' }
 */
function resolveAuditContext(
  method: string,
  routerPath: string,
): AuditContext | null {
  const methodActionMap: Record<string, string> = {
    GET: 'READ',
    POST: 'CREATE',
    PATCH: 'UPDATE',
    PUT: 'UPDATE',
    DELETE: 'DELETE',
  };

  const resourceMap: Array<[RegExp, string]> = [
    [/\/patients/, 'PatientProfile'],
    [/\/treatments/, 'Treatment'],
    [/\/dose-logs/, 'DoseLog'],
    [/\/checkins/, 'WeeklyCheckin'],
    [/\/biometrics/, 'BiometricLog'],
    [/\/alerts/, 'ClinicalAlert'],
    [/\/appointments/, 'Appointment'],
    [/\/nutrition\/plans/, 'NutritionalPlan'],
    [/\/nutrition\/meal-logs/, 'MealLog'],
    [/\/messages/, 'Message'],
    [/\/ai\//, 'AITriage'],
    [/\/auth/, 'Auth'],
  ];

  const action = methodActionMap[method] ?? 'ACCESS';
  const match = resourceMap.find(([pattern]) => pattern.test(routerPath));

  if (!match) return null;

  return { resource: match[1], action };
}

export default fp(async (fastify: FastifyInstance) => {
  /**
   * Hook executado após cada resposta bem-sucedida em rotas autenticadas.
   * Registra: quem acessou, o quê, quando, de onde.
   */
  fastify.addHook(
    'onResponse',
    async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
      // Só audita rotas autenticadas com usuário identificado
      if (!request.user?.id) return;
      if (AUDIT_SKIP_PATHS.has(request.url)) return;
      // Só registra respostas bem-sucedidas (2xx e 3xx)
      if (reply.statusCode >= 400) return;

      const ctx = resolveAuditContext(
        request.method,
        request.routeOptions?.url ?? request.url,
      );
      if (!ctx) return;

      // Extrai resourceId do path quando disponível (ex: /patients/abc123)
      const idMatch = request.url.match(
        /\/[a-z-]+\/([a-z0-9]{25,})/i,
      );
      const resourceId = idMatch?.[1] ?? null;

      // LGPD: nunca registrar o body — pode conter dados clínicos sensíveis
      await prisma.auditLog.create({
        data: {
          userId: request.user.id,
          action: ctx.action,
          resource: ctx.resource,
          resourceId,
          ipAddress: request.ip,
          userAgent: request.headers['user-agent'] ?? null,
          metadata: {
            method: request.method,
            path: request.url,
            statusCode: reply.statusCode,
          },
        },
      });
    },
  );
});
