// src/http/errors/handler.ts
// Handler global de erros — nunca expõe dados de saúde ou stack traces em produção

import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { Prisma } from '@prisma/client';

const isProd = process.env['NODE_ENV'] === 'production';

/** Erros de domínio com código HTTP explícito */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
    /** Código legível para o cliente (ex: "CRM_NOT_FOUND") */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/** Erros de autorização — 403 */
export class ForbiddenError extends AppError {
  constructor(message = 'Acesso negado') {
    super(403, message, 'FORBIDDEN');
  }
}

/** Erros de autenticação — 401 */
export class UnauthorizedError extends AppError {
  constructor(message = 'Não autenticado') {
    super(401, message, 'UNAUTHORIZED');
  }
}

/** Recurso não encontrado — 404 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} não encontrado`, 'NOT_FOUND');
  }
}

/** Conflito de dados — 409 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message, 'CONFLICT');
  }
}

/** Pré-condição de negócio não atendida — 422 */
export class BusinessRuleError extends AppError {
  constructor(message: string, code?: string) {
    super(422, message, code ?? 'BUSINESS_RULE_VIOLATION');
  }
}

/**
 * Handler global registrado no Fastify.
 * REGRA CRÍTICA: mensagens de erro nunca devem conter dados clínicos do paciente.
 */
export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply,
): void {
  // Erros de validação Zod — 400
  if (error instanceof ZodError) {
    reply.status(400).send({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Dados inválidos',
      errors: error.errors.map((e) => ({
        field: e.path.join('.'),
        message: e.message,
      })),
    });
    return;
  }

  // Erros de domínio com código HTTP explícito
  if (error instanceof AppError) {
    reply.status(error.statusCode).send({
      statusCode: error.statusCode,
      code: error.code,
      message: error.message,
    });
    return;
  }

  // Erros do Prisma — nunca expor query ou dados ao cliente
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      reply.status(409).send({
        statusCode: 409,
        code: 'CONFLICT',
        message: 'Registro já existe',
      });
      return;
    }
    if (error.code === 'P2025') {
      reply.status(404).send({
        statusCode: 404,
        code: 'NOT_FOUND',
        message: 'Recurso não encontrado',
      });
      return;
    }
  }

  // Erros JWT do Fastify — 401
  if (
    'code' in error &&
    typeof error.code === 'string' &&
    (error.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_EXPIRED' ||
      error.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID')
  ) {
    reply.status(401).send({
      statusCode: 401,
      code: 'UNAUTHORIZED',
      message: 'Token inválido ou expirado',
    });
    return;
  }

  // Fallback — 500 sem detalhes em produção
  request.log.error(
    { err: error, requestId: request.id },
    'Erro interno não tratado',
  );
  reply.status(500).send({
    statusCode: 500,
    code: 'INTERNAL_ERROR',
    // Em produção nunca expõe a mensagem real (pode conter dados sensíveis)
    message: isProd ? 'Erro interno do servidor' : error.message,
  });
}
