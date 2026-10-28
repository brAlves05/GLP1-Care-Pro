import { PasswordService } from './password.service';

describe('PasswordService (argon2 real)', () => {
  const service = new PasswordService();

  it('verifica a senha correta e recusa a errada', async () => {
    const hash = await service.hash('senha-forte-123');
    await expect(service.verify(hash, 'senha-forte-123')).resolves.toBe(true);
    await expect(service.verify(hash, 'outra-senha')).resolves.toBe(false);
  });

  it('hash fictício do login é válido: verificação retorna false sem lançar erro', async () => {
    const dummy = await service.dummyHash();
    await expect(service.verify(dummy, 'qualquer-senha')).resolves.toBe(false);
    expect(await service.dummyHash()).toBe(dummy);
  });
});
