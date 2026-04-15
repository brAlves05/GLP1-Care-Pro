// src/application/use-cases/auth/refresh.use-case.ts
// Renovação de tokens — valida refresh token e emite novo par

import { FastifyInstance } from 'fastify';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { TokenService } from '../../../infrastructure/services/token.service';
import { UnauthorizedError } from '../../../http/errors/handler';
import { Role } from '../../../domain/enums';

export interface RefreshOutput {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export async function refreshUseCase(
  fastify: FastifyInstance,
  refreshToken: string,
): Promise<RefreshOutput> {
  const tokenService = new TokenService(fastify);

  let payload;
  try {
    payload = tokenService.verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Refresh token inválido ou expirado.');
  }

  // Valida sessão no banco
  const session = await prisma.userSession.findUnique({
    where: { id: payload.sessionId },
    include: {
      user: { select: { id: true, email: true, role: true, deletedAt: true } },
    },
  });

  if (!session || session.revokedAt || session.expiresAt < new Date()) {
    throw new UnauthorizedError('Sessão inválida. Faça login novamente.');
  }

  if (session.user.deletedAt) {
    throw new UnauthorizedError('Conta desativada.');
  }

  // Renova o par de tokens mantendo a mesma sessão
  const tokens = tokenService.generateTokenPair({
    userId: session.user.id,
    email: session.user.email,
    role: session.user.role as Role,
    sessionId: session.id,
  });

  // Estende expiração da sessão
  await prisma.userSession.update({
    where: { id: session.id },
    data: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
  });

  return tokens;
}
