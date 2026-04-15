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
  token: string;
  ipAddress?: string;
}

/**
 * Verifica o código TOTP:
 * - Na primeira vez (setup): ativa o MFA na conta.
 * - No login: valida identidade do profissional.
 */
export async function verifyMfaUseCase(input: MfaVerifyInput): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { email: true, mfaSecret: true, mfaEnabled: true },
  });

  if (!user || !user.mfaSecret) {
    throw new BusinessRuleError(
      'MFA não configurado. Acesse /auth/mfa/setup primeiro.',
      'MFA_NOT_CONFIGURED',
    );
  }

  const secret = mfaService.decryptSecret(user.mfaSecret);
  const isValid = mfaService.verifyToken(secret, input.token);

  if (!isValid) {
    await auditService.logAuth('LOGIN_FAILED', input.userId, {
      email: user.email,
      ipAddress: input.ipAddress,
    });
    throw new UnauthorizedError('Código de verificação inválido ou expirado.');
  }

  // Ativa MFA se era o primeiro setup
  if (!user.mfaEnabled) {
    await prisma.user.update({
      where: { id: input.userId },
      data: { mfaEnabled: true },
    });
  }

  await auditService.logAuth('MFA_VERIFIED', input.userId, {
    email: user.email,
    ipAddress: input.ipAddress,
  });
}
