// src/application/use-cases/auth/login.use-case.ts
// Login com e-mail/senha — retorna tokens JWT após validação
// Profissionais com MFA habilitado recebem token parcial até verificar o TOTP

import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { passwordService } from '../../../infrastructure/services/password.service';
import { TokenService } from '../../../infrastructure/services/token.service';
import { auditService } from '../../../infrastructure/services/audit.service';
import { UnauthorizedError, BusinessRuleError } from '../../../http/errors/handler';
import { Role } from '../../../domain/enums';
import { MFA_REQUIRED_ROLES } from '../../../shared/constants';

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
    // Executa hash fictício para evitar timing attack por enumeração de e-mail
    await passwordService.verify('$argon2id$v=19$m=65536,t=3,p=4$dummy', 'dummy');
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

  // Verifica se profissional precisa de MFA
  const isMfaRequired = (MFA_REQUIRED_ROLES as readonly string[]).includes(user.role);
  if (isMfaRequired && !user.mfaEnabled) {
    throw new BusinessRuleError(
      'MFA obrigatório. Configure o autenticador em /auth/mfa/setup antes do primeiro acesso.',
      'MFA_SETUP_REQUIRED',
    );
  }

  // Cria sessão — token armazenado como hash SHA-256
  const rawSessionToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = TokenService.hashToken(rawSessionToken);

  const session = await prisma.userSession.create({
    data: {
      userId: user.id,
      tokenHash,
      ipAddress: input.ipAddress ?? 'unknown',
      userAgent: input.userAgent ?? 'unknown',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 dias
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
    // Se tem MFA habilitado, o cliente deve verificar TOTP antes de prosseguir
    mfaPending: isMfaRequired && user.mfaEnabled,
  };
}
