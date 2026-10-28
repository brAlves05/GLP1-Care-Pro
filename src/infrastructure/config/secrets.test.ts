import { getEncryptionKey, getJwtSecret, MissingSecretError } from './secrets';

describe('segredos obrigatórios', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env = { ...original };
  });

  describe('getJwtSecret', () => {
    it('falha quando JWT_SECRET está ausente', () => {
      delete process.env['JWT_SECRET'];
      expect(() => getJwtSecret()).toThrow(MissingSecretError);
    });

    it('falha quando JWT_SECRET tem menos de 32 caracteres', () => {
      process.env['JWT_SECRET'] = 'curto-demais';
      expect(() => getJwtSecret()).toThrow(MissingSecretError);
    });

    it('aceita segredo com 32+ caracteres', () => {
      process.env['JWT_SECRET'] = 'x'.repeat(32);
      expect(getJwtSecret()).toBe('x'.repeat(32));
    });
  });

  describe('getEncryptionKey', () => {
    it('falha quando ENCRYPTION_MASTER_KEY está ausente', () => {
      delete process.env['ENCRYPTION_MASTER_KEY'];
      expect(() => getEncryptionKey()).toThrow(MissingSecretError);
    });

    it('rejeita chave que não é hex de 64 caracteres', () => {
      process.env['ENCRYPTION_MASTER_KEY'] = 'REPLACE_IN_PRODUCTION_32_CHARS!!';
      expect(() => getEncryptionKey()).toThrow(MissingSecretError);
      process.env['ENCRYPTION_MASTER_KEY'] = 'z'.repeat(64);
      expect(() => getEncryptionKey()).toThrow(MissingSecretError);
    });

    it('retorna 32 bytes para chave hex válida', () => {
      process.env['ENCRYPTION_MASTER_KEY'] = 'ab'.repeat(32);
      expect(getEncryptionKey()).toHaveLength(32);
    });
  });
});
