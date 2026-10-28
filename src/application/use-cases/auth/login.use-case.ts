// src/application/use-cases/auth/login.use-case.ts
// Login com e-mail/senha — retorna tokens JWT após validação
// Profissionais recebem sessão com MFA pendente: só acessam /auth/mfa/* e /auth/logout
// até validar o TOTP (ou configurá-lo, no primeiro acesso)

import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { passwordService } from '../../../infrastructure/services/password.service';
import { TokenService } from '../../../infrastructure/services/token.service';
import { auditService } from '../../../infrastructure/services/audit.service';
import { UnauthorizedError } from '../../../http/errors/handler';
import { Role } from '../../../domain/enums';
import { REFRESH_TOKEN_TTL_SECONDS, requiresMfa } from '../../../shared/constants';

export interface LoginInput {
  email: string;
  password: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: Role;
  };
  /** true = profissional deve verificar TOTP antes de acessar rotas clínicas */
  mfaPending: boolean;
  /** true = profissional ainda não configurou o autenticador (/auth/mfa/setup) */
  mfaSetupRequired: boolean;
}

export async function loginUseCase(
  fastify: FastifyInstance,
  input: LoginInput,
): Promise<LoginOutput> {
  // Busca usuário — erro genérico para não revelar se o e-mail existe
  const user = await prisma.user.findUnique({
    where: { email: input.email, deletedAt: null },
    select: {
      id: true,
      email: true,
      role: true,
      passwordHash: true,
      mfaEnabled: true,
    },
  });

  const GENERIC_ERROR = 'E-mail ou senha inválidos.';

  if (!user) {
    // Verifica contra um hash real para igualar o tempo de resposta (anti-enumeração de e-mail)
    await passwordService.verify(await passwordService.dummyHash(), input.password);
    await auditService.logAuth('LOGIN_FAILED', undefined, {
      email: input.email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    throw new UnauthorizedError(GENERIC_ERROR);
  }

  const passwordValid = await passwordService.verify(user.passwordHash, input.password);
  if (!passwordValid) {
    await auditService.logAuth('LOGIN_FAILED', user.id, {
      email: user.email,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });
    throw new UnauthorizedError(GENERIC_ERROR);
  }

  const isMfaRequired = requiresMfa(user.role);

  // Cria sessão — token armazenado como hash SHA-256
  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = TokenService.hashToken(rawSessionToken);

  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash,
      ipAddress: input.ipAddress ?? 'unknown',
      userAgent: input.userAgent ?? 'unknown',
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_SECONDS * 1000),
    },
  });

  const tokenService = new TokenService(fastify);
  const tokens = tokenService.generateTokenPair({
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    sessionId: session.id,
  });

  await auditService.logAuth('LOGIN', user.id, {
    email: user.email,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });

  return {
    ...tokens,
    user: { id: user.id, email: user.email, role: user.role as Role },
    mfaPending: isMfaRequired,
    mfaSetupRequired: isMfaRequired && !user.mfaEnabled,
  };
}
