// src/infrastructure/services/password.service.ts
// Hashing de senha com Argon2id — resistente a ataques de GPU e side-channel

import * as argon2 from 'argon2';
import * as crypto from 'crypto';

/**
 * Parâmetros de custo do Argon2id.
 * OWASP recomenda: memória ≥ 19 MiB, iterações ≥ 2, paralelismo ≥ 1.
 */
const ARGON2_OPTIONS: argon2.HashOptions = {
  type: argon2.argon2id,
  memoryCost: 65536, // 64 MiB
  timeCost: 3,       // 3 iterações
  parallelism: 4,
};

export class PasswordService {
  private dummyHashPromise: Promise<string> | undefined;

  /**
   * Gera o hash da senha.
   * Nunca armazenar a senha em texto claro — nem em logs, nem em variáveis.
   */
  async hash(plaintext: string): Promise<string> {
    return argon2.hash(plaintext, ARGON2_OPTIONS);
  }

  /**
   * Verifica se a senha em texto claro corresponde ao hash armazenado.
   * Timing-safe por design do Argon2.
   */
  async verify(hash: string, plaintext: string): Promise<boolean> {
    return argon2.verify(hash, plaintext);
  }

  /** Hash válido com os mesmos parâmetros, para comparação de tempo constante */
  dummyHash(): Promise<string> {
    this.dummyHashPromise ??= this.hash(crypto.randomBytes(16).toString('hex'));
    return this.dummyHashPromise;
  }
}

export const passwordService = new PasswordService();
