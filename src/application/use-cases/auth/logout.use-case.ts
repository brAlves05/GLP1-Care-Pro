// src/application/use-cases/auth/logout.use-case.ts
// Revoga a sessão do usuário — invalida todos os tokens associados

import { prisma } from '../../../infrastructure/database/prisma.client';
import { auditService } from '../../../infrastructure/services/audit.service';

export interface LogoutInput {
  userId: string;
  sessionId: string;
  email: string;
  ipAddress?: string;
  userAgent?: string;
}

export async function logoutUseCase(input: LogoutInput): Promise<void> {
  await prisma.userSession.update({
    where: { id: input.sessionId },
    data: { revokedAt: new Date() },
  });

  await auditService.logAuth('LOGOUT', input.userId, {
    email: input.email,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}
