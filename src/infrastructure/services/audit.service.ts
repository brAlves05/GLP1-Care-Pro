// src/infrastructure/services/audit.service.ts
// Serviço de auditoria explícita — para ações críticas não cobertas pelo hook automático
// Ex: login, logout, acesso negado, exportação de dados (LGPD portabilidade)

import { prisma } from '../database/prisma.client';

interface AuditEntry {
  userId?: string;
  action: string;
  resource: string;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  /** Nunca incluir dados clínicos aqui — apenas metadados */
  metadata?: Record<string, unknown>;
}

export class AuditService {
  /**
   * Registra uma entrada de auditoria.
   * Este método é fire-and-forget intencional em hooks de resposta —
   * erros de auditoria não devem bloquear a operação principal.
   */
  async log(entry: AuditEntry): Promise<void> {
    await prisma.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        action: entry.action,
        resource: entry.resource,
        resourceId: entry.resourceId ?? null,
        ipAddress: entry.ipAddress ?? null,
        userAgent: entry.userAgent ?? null,
        metadata: entry.metadata ?? null,
      },
    });
  }

  /** Atalho para log de autenticação */
  async logAuth(
    action: 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT' | 'MFA_SETUP' | 'MFA_VERIFIED' | 'PASSWORD_CHANGE',
    userId: string | undefined,
    meta: { ipAddress?: string; userAgent?: string; email?: string },
  ): Promise<void> {
    await this.log({
      userId,
      action,
      resource: 'Auth',
      // Nunca incluir senha ou token nos metadados
      metadata: { email: meta.email, timestamp: new Date().toISOString() },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  /** Registra consentimento LGPD explícito */
  async logLgpdConsent(
    userId: string,
    version: string,
    accepted: boolean,
    ipAddress: string,
  ): Promise<void> {
    await prisma.lgpdConsent.create({
      data: {
        userId,
        consentVersion: version,
        purpose: 'Tratamento de dados de saúde para acompanhamento GLP-1',
        accepted,
        ipAddress,
      },
    });

    await this.log({
      userId,
      action: accepted ? 'LGPD_CONSENT_ACCEPTED' : 'LGPD_CONSENT_REJECTED',
      resource: 'LgpdConsent',
      metadata: { version },
      ipAddress,
    });
  }
}

export const auditService = new AuditService();
