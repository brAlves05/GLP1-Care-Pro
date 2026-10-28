// src/shared/constants/index.ts

/** Perfis que exigem MFA obrigatório (CFM / CFF) */
export const MFA_REQUIRED_ROLES = ['DOCTOR', 'NUTRITIONIST'] as const;

export function requiresMfa(role: string): boolean {
  return (MFA_REQUIRED_ROLES as readonly string[]).includes(role);
}

/** Duração do access token (15 minutos) */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

/** Duração do refresh token e da sessão (7 dias) */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

/** Janela de rate-limit para /auth/login — proteção contra força bruta */
export const LOGIN_RATE_LIMIT = { max: 5, timeWindow: '1m' };

/** Limite por conta (e-mail) no login — contra força bruta distribuída em vários IPs */
export const LOGIN_ACCOUNT_RATE_LIMIT = { max: 20, timeWindow: '15m' };

/** Janela de rate-limit para /auth/mfa/verify — proteção contra enumeração TOTP */
export const MFA_RATE_LIMIT = { max: 5, timeWindow: '5m' };

/** Páginas de listagem — máximo de itens por página */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

/** Versão atual dos termos LGPD — deve coincidir com .env LGPD_CONSENT_VERSION */
export const LGPD_CONSENT_VERSION = process.env['LGPD_CONSENT_VERSION'] ?? '1.0.0';
