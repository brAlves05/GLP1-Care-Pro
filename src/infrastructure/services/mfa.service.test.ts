import { authenticator } from 'otplib';
import { MfaService } from './mfa.service';

describe('MfaService', () => {
  const service = new MfaService();

  beforeAll(() => {
    process.env['ENCRYPTION_MASTER_KEY'] = 'cd'.repeat(32);
  });

  it('cifra e decifra o segredo TOTP (AES-256-GCM)', () => {
    const secret = service.generateSecret();
    const encrypted = service.encryptSecret(secret);
    expect(encrypted).not.toContain(secret);
    expect(service.decryptSecret(encrypted)).toBe(secret);
  });

  it('rejeita segredo cifrado adulterado', () => {
    const encrypted = service.encryptSecret(service.generateSecret());
    const [iv, tag, data] = encrypted.split(':');
    const flipped = (data!.startsWith('0') ? '1' : '0') + data!.slice(1);
    expect(() => service.decryptSecret(`${iv}:${tag}:${flipped}`)).toThrow();
  });

  it('retorna o passo de tempo atual para um código válido', () => {
    const secret = service.generateSecret();
    const step = service.verifyTokenStep(secret, authenticator.generate(secret));
    expect(step).toBe(Math.floor(Date.now() / 1000 / 30));
  });

  it('retorna null para código inválido', () => {
    const secret = service.generateSecret();
    const valid = authenticator.generate(secret);
    const wrong = valid === '000000' ? '111111' : '000000';
    expect(service.verifyTokenStep(secret, wrong)).toBeNull();
  });
});
