import { verifyMfaUseCase } from './mfa.use-case';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { mfaService } from '../../../infrastructure/services/mfa.service';

const tx = {
  user: { updateMany: jest.fn() },
  userSession: { update: jest.fn() },
};

jest.mock('../../../infrastructure/database/prisma.client', () => ({
  prisma: {
    user: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../../infrastructure/services/mfa.service', () => ({
  mfaService: { decryptSecret: jest.fn(() => 'SEGREDO'), verifyTokenStep: jest.fn() },
}));
jest.mock('../../../infrastructure/services/audit.service', () => ({
  auditService: { logAuth: jest.fn() },
}));

const findUser = prisma.user.findUnique as unknown as jest.Mock;
const transaction = prisma.$transaction as unknown as jest.Mock;
const verifyTokenStep = mfaService.verifyTokenStep as unknown as jest.Mock;

const input = { userId: 'user_1', sessionId: 'sess_1', token: '123456' };

describe('verifyMfaUseCase', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    transaction.mockImplementation((fn: (t: typeof tx) => Promise<unknown>) => fn(tx));
    findUser.mockResolvedValue({ email: 'dr@x.com', mfaSecret: 'cifrado' });
  });

  it('reserva o passo TOTP, ativa o MFA e marca a sessão como verificada', async () => {
    verifyTokenStep.mockReturnValue(1000);
    tx.user.updateMany.mockResolvedValue({ count: 1 });

    await verifyMfaUseCase(input);

    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: {
        id: 'user_1',
        OR: [{ mfaLastUsedStep: null }, { mfaLastUsedStep: { lt: 1000 } }],
      },
      data: { mfaLastUsedStep: 1000, mfaEnabled: true },
    });
    expect(tx.userSession.update).toHaveBeenCalledWith({
      where: { id: 'sess_1', userId: 'user_1' },
      data: { mfaVerifiedAt: expect.any(Date) },
    });
  });

  it('recusa código já usado (reuso em outra sessão) sem liberar a sessão', async () => {
    verifyTokenStep.mockReturnValue(1000);
    tx.user.updateMany.mockResolvedValue({ count: 0 });

    await expect(verifyMfaUseCase(input)).rejects.toMatchObject({ statusCode: 401 });
    expect(tx.userSession.update).not.toHaveBeenCalled();
  });

  it('código inválido não libera a sessão', async () => {
    verifyTokenStep.mockReturnValue(null);

    await expect(verifyMfaUseCase(input)).rejects.toMatchObject({ statusCode: 401 });
    expect(transaction).not.toHaveBeenCalled();
  });

  it('recusa quando o MFA não foi configurado', async () => {
    findUser.mockResolvedValue({ email: 'dr@x.com', mfaSecret: null });
    await expect(verifyMfaUseCase(input)).rejects.toMatchObject({ code: 'MFA_NOT_CONFIGURED' });
  });
});
