import { verifyCrmUseCase } from './verify-crm.use-case';
import { prisma } from '../../../infrastructure/database/prisma.client';

jest.mock('../../../infrastructure/database/prisma.client', () => ({
  prisma: { doctorProfile: { findUnique: jest.fn(), update: jest.fn() } },
}));

const findProfile = prisma.doctorProfile.findUnique as unknown as jest.Mock;
const updateProfile = prisma.doctorProfile.update as unknown as jest.Mock;

describe('verifyCrmUseCase', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    findProfile.mockResolvedValue({ crm: '123456', crmState: 'SP', verificationStatus: 'PENDING' });
  });

  it('sem integração com o CFM, mantém o cadastro PENDING (nunca aprova sozinho)', async () => {
    const out = await verifyCrmUseCase({ doctorProfileId: 'doc_1', crm: '123456', crmState: 'sp' });
    expect(out.status).toBe('PENDING');
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('recusa verificar CRM diferente do cadastrado no perfil', async () => {
    await expect(
      verifyCrmUseCase({ doctorProfileId: 'doc_1', crm: '999999', crmState: 'SP' }),
    ).rejects.toMatchObject({ code: 'CRM_MISMATCH' });
  });
});
