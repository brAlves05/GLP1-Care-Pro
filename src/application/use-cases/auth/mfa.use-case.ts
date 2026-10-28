// src/application/use-cases/auth/mfa.use-case.ts
// Setup e verificação de TOTP — obrigatório para médicos e nutricionistas

import { prisma } from '../../../infrastructure/database/prisma.client';
import { mfaService } from '../../../infrastructure/services/mfa.service';
import { auditService } from '../../../infrastructure/services/audit.service';
import { UnauthorizedError, BusinessRuleError } from '../../../http/errors/handler';

// ── Setup ─────────────────────────────────────────────────────────────────────

export interface MfaSetupOutput {
  /** URL para geração do QR Code — exibir apenas uma vez ao usuário */
  otpAuthUrl: string;
  /** Chave manual para usuários que não conseguem escanear o QR Code */
  manualEntryKey: string;
}

/**
 * Inicia o setup do MFA: gera segredo TOTP e retorna URL para QR Code.
 * O segredo só é persistido após a primeira verificação bem-sucedida (setupMfaVerify).
 */
export async function setupMfaUseCase(userId: string): Promise<MfaSetupOutput> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, mfaEnabled: true },
  });

  if (!user) throw new UnauthorizedError();

  if (user.mfaEnabled) {
    throw new BusinessRuleError('MFA já está habilitado nesta conta.', 'MFA_ALREADY_ENABLED');
  }

  const secret = mfaService.generateSecret();
  const otpAuthUrl = mfaService.generateOtpAuthUrl(user.email, secret);
  const encryptedSecret = mfaService.encryptSecret(secret);

  // Salva segredo temporariamente — será confirmado em /mfa/verify
  await prisma.user.update({
    where: { id: userId },
    data: {
      mfaSecret: encryptedSecret,
      mfaEnabled: false, // permanece false até verificação
    },
  });

  await auditService.logAuth('MFA_SETUP', userId, { email: user.email });

  return { otpAuthUrl, manualEntryKey: secret };
}

// ── Verificação ───────────────────────────────────────────────────────────────

export interface MfaVerifyInput {
  userId: string;
  /** Sessão que passa a ter o MFA validado */
  sessionId: string;
  token: string;
  ipAddress?: string;
}

/**
 * Verifica o código TOTP e marca a sessão atual como validada:
 * - Na primeira vez (setup): também ativa o MFA na conta.
 * - No login: libera o acesso às rotas clínicas para esta sessão.
 */
export async function verifyMfaUseCase(input: MfaVerifyInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, mfaSecret: true },
  });

  if (!user || !user.mfaSecret) {
    throw new BusinessRuleError(
      'MFA não configurado. Acesse /auth/mfa/setup primeiro.',
      'MFA_NOT_CONFIGURED',
    );
  }

  const secret = mfaService.decryptSecret(user.mfaSecret);
  const step = mfaService.verifyTokenStep(secret, input.token);

  if (step === null) {
    await auditService.logAuth('LOGIN_FAILED', input.userId, {
      email: user.email,
      ipAddress: input.ipAddress,
    });
    throw new UnauthorizedError('Código de verificação inválido ou expirado.');
  }

  await prisma.$transaction(async (tx) => {
    // Reserva o passo TOTP de forma atômica: um código já usado não libera outra sessão
    const claimed = await tx.user.updateMany({
      where: {
        id: input.userId,
        OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: step } }],
      },
      // Ativa MFA no primeiro setup (idempotente nas verificações seguintes)
      data: { mfaLastUsedStep: step, mfaEnabled: true },
    });
    if (claimed.count === 0) {
      throw new UnauthorizedError('Código já utilizado. Aguarde o próximo código.');
    }

    await tx.userSession.update({
      where: { id: input.sessionId, userId: input.userId },
      data: { mfaVerifiedAt: new Date() },
    });
  });

  await auditService.logAuth('MFA_VERIFIED', input.userId, {
    email: user.email,
    ipAddress: input.ipAddress,
  });
}
