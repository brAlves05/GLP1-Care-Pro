import { FastifyInstance } from 'fastify';
import { loginUseCase } from './login.use-case';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { passwordService } from '../../../infrastructure/services/password.service';
import { Role } from '../../../domain/enums';

jest.mock('../../../infrastructure/database/prisma.client', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    userSession: { create: jest.fn() },
  },
}));
jest.mock('../../../infrastructure/services/password.service', () => ({
  passwordService: { verify: jest.fn(), dummyHash: jest.fn(async () => 'hash-ficticio') },
}));
jest.mock('../../../infrastructure/services/audit.service', () => ({
  auditService: { logAuth: jest.fn() },
}));

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const createSession = prisma.userSession.create as unknown as jest.Mock;
const verifyPassword = passwordService.verify as unknown as jest.Mock;

const fakeFastify = {
  jwt: { sign: jest.fn((payload: { type: string }) => `${payload.type}-token`) },
} as unknown as FastifyInstance;

function userRow(role: Role, mfaEnabled: boolean): Record<string, unknown> {
  return { id: 'user_1', email: 'dr@x.com', role, passwordHash: 'hash', mfaEnabled };
}

describe('loginUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    verifyPassword.mockResolvedValue(true);
    createSession.mockResolvedValue({ id: 'sess_1' });
  });

  it('emite sessão com MFA pendente para médico que ainda não configurou o MFA', async () => {
    findUser.mockResolvedValue(userRow(Role.DOCTOR, false));
    const out = await loginUseCase(fakeFastify, { email: 'dr@x.com', password: 'senha-correta' });
    expect(out.accessToken).toBe('access-token');
    expect(out.mfaPending).toBe(true);
    expect(out.mfaSetupRequired).toBe(true);
  });

  it('exige TOTP do médico com MFA já configurado', async () => {
    findUser.mockResolvedValue(userRow(Role.DOCTOR, true));
    const out = await loginUseCase(fakeFastify, { email: 'dr@x.com', password: 'senha-correta' });
    expect(out.mfaPending).toBe(true);
    expect(out.mfaSetupRequired).toBe(false);
  });

  it('não exige MFA de paciente', async () => {
    findUser.mockResolvedValue(userRow(Role.PATIENT, false));
    const out = await loginUseCase(fakeFastify, { email: 'p@x.com', password: 'senha-correta' });
    expect(out.mfaPending).toBe(false);
    expect(out.mfaSetupRequired).toBe(false);
  });

  it('e-mail inexistente recebe o mesmo 401 genérico, após verificar contra o hash fictício', async () => {
    findUser.mockResolvedValue(null);
    verifyPassword.mockResolvedValue(false);
    await expect(
      loginUseCase(fakeFastify, { email: 'nao-existe@x.com', password: 'qualquer' }),
    ).rejects.toMatchObject({ statusCode: 401, message: 'E-mail ou senha inválidos.' });
    expect(verifyPassword).toHaveBeenCalledWith('hash-ficticio', 'qualquer');
    expect(createSession).not.toHaveBeenCalled();
  });

  it('recusa senha errada sem criar sessão', async () => {
    findUser.mockResolvedValue(userRow(Role.PATIENT, false));
    verifyPassword.mockResolvedValue(false);
    await expect(
      loginUseCase(fakeFastify, { email: 'p@x.com', password: 'errada' }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(createSession).not.toHaveBeenCalled();
  });
});
