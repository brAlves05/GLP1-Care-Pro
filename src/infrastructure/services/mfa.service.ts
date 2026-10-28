// src/infrastructure/services/mfa.service.ts
// TOTP — Time-based One-Time Password (RFC 6238)
// Obrigatório para médicos e nutricionistas (CFM/CFF)

import { authenticator } from 'otplib';
import * as crypto from 'crypto';
import { getEncryptionKey } from '../config/secrets';

/**
 * Janela de tolerância: aceita ±1 período (30s) para compensar
 * pequenas diferenças de relógio entre cliente e servidor.
 */
authenticator.options = { window: 1 };

const ALGORITHM = 'aes-256-gcm';
const TOTP_STEP_SECONDS = 30;

let encryptionKey: Buffer | undefined;
function key(): Buffer {
  encryptionKey ??= getEncryptionKey();
  return encryptionKey;
}

export class MfaService {
  /** Gera um novo segredo TOTP para o usuário */
  generateSecret(): string {
    return authenticator.generateSecret(32);
  }

  /**
   * Gera a URL otpauth:// para QR Code.
   * O QR Code é exibido ao usuário durante o setup do MFA.
   */
  generateOtpAuthUrl(email: string, secret: string): string {
    return authenticator.keyuri(email, 'GLP-1 Care Pro', secret);
  }

  /**
   * Verifica o código TOTP e retorna o passo de tempo (janela de 30s) em que ele é válido,
   * ou null se inválido. O passo é usado para impedir reuso do mesmo código.
   * O segredo deve ser descriptografado antes de chamar este método.
   */
  verifyTokenStep(secret: string, token: string, now: number = Date.now()): number | null {
    const delta = authenticator.checkDelta(token, secret);
    if (delta === null) return null;
    return Math.floor(now / 1000 / TOTP_STEP_SECONDS) + delta;
  }

  /**
   * Criptografa o segredo TOTP antes de persistir no banco.
   * Usa AES-256-GCM com IV aleatório por operação.
   */
  encryptSecret(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, key(), iv);

    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    // Formato: iv(hex):tag(hex):ciphertext(hex)
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  /**
   * Descriptografa o segredo TOTP armazenado no banco.
   * @throws Error se o ciphertext estiver corrompido (falha na autenticação GCM)
   */
  decryptSecret(encrypted: string): string {
    const [ivHex, tagHex, ciphertextHex] = encrypted.split(':');
    if (!ivHex || !tagHex || !ciphertextHex) {
      throw new Error('Formato de segredo MFA inválido');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key(), iv);
    decipher.setAuthTag(tag);

    return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8');
  }
}

export const mfaService = new MfaService();
