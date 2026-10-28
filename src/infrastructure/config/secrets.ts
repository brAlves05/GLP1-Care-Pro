// src/infrastructure/config/secrets.ts
// Segredos obrigatórios — sem valores padrão: o servidor não sobe sem eles

const MIN_JWT_SECRET_LENGTH = 32;
const ENCRYPTION_KEY_HEX_LENGTH = 64; // 32 bytes (AES-256)

export class MissingSecretError extends Error {
  constructor(name: string, requirement: string) {
    super(`Variável de ambiente ${name} ausente ou inválida: ${requirement}`);
    this.name = 'MissingSecretError';
  }
}

/** Segredo HMAC dos JWTs — mínimo 32 caracteres */
export function getJwtSecret(): string {
  const secret = process.env['JWT_SECRET'];
  if (!secret || secret.length < MIN_JWT_SECRET_LENGTH) {
    throw new MissingSecretError('JWT_SECRET', `mínimo ${MIN_JWT_SECRET_LENGTH} caracteres`);
  }
  return secret;
}

/**
 * Chave AES-256 para cifrar dados sensíveis em repouso (ex.: segredo TOTP).
 * Formato: 64 caracteres hexadecimais. Gere com `openssl rand -hex 32`.
 */
export function getEncryptionKey(): Buffer {
  const hex = process.env['ENCRYPTION_MASTER_KEY'];
  if (!hex || hex.length !== ENCRYPTION_KEY_HEX_LENGTH || !/^[0-9a-fA-F]+$/.test(hex)) {
    throw new MissingSecretError(
      'ENCRYPTION_MASTER_KEY',
      `${ENCRYPTION_KEY_HEX_LENGTH} caracteres hexadecimais (openssl rand -hex 32)`,
    );
  }
  return Buffer.from(hex, 'hex');
}
