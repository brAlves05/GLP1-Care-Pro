import {
  accessiblePatientsWhere,
  assertPatientAccess,
  haveActiveClinicalLink,
  professionalTeamWhere,
  resolveRequesterProfile,
} from './clinical-access';
import { prisma } from '../../infrastructure/database/prisma.client';
import { Role } from '../../domain/enums';

jest.mock('../../infrastructure/database/prisma.client', () => ({
  prisma: {
    patientProfile: { findUnique: jest.fn() },
    doctorProfile: { findUnique: jest.fn() },
    nutritionistProfile: { findUnique: jest.fn() },
    clinicalTeam: { findFirst: jest.fn() },
  },
}));

const m = prisma as unknown as {
  patientProfile: { findUnique: jest.Mock };
  doctorProfile: { findUnique: jest.Mock };
  nutritionistProfile: { findUnique: jest.Mock };
  clinicalTeam: { findFirst: jest.Mock };
};

describe('autorização clínica', () => {
  beforeEach(() => jest.resetAllMocks());

  describe('resolveRequesterProfile', () => {
    it.each([Role.PATIENT, Role.DOCTOR, Role.NUTRITIONIST])(
      'nega %s sem perfil clínico (nega por padrão)',
      async (role) => {
        await expect(resolveRequesterProfile({ id: 'u1', role })).rejects.toMatchObject({ statusCode: 403 });
      },
    );
  });

  describe('assertPatientAccess', () => {
    it('paciente acessa somente os próprios dados', async () => {
      m.patientProfile.findUnique.mockResolvedValue({ id: 'pat_1' });
      await expect(assertPatientAccess({ id: 'u1', role: Role.PATIENT }, 'pat_1')).resolves.toBeDefined();
      await expect(assertPatientAccess({ id: 'u1', role: Role.PATIENT }, 'pat_2')).rejects.toMatchObject({ statusCode: 403 });
      expect(m.clinicalTeam.findFirst).not.toHaveBeenCalled();
    });

    it('médico precisa de vínculo ATIVO como médico do paciente', async () => {
      m.doctorProfile.findUnique.mockResolvedValue({ id: 'doc_1' });
      m.clinicalTeam.findFirst.mockResolvedValue(null);

      await expect(assertPatientAccess({ id: 'u1', role: Role.DOCTOR }, 'pat_1')).rejects.toMatchObject({ statusCode: 403 });
      expect(m.clinicalTeam.findFirst).toHaveBeenCalledWith({
        where: { patientProfileId: 'pat_1', doctorProfileId: 'doc_1', status: 'ACTIVE' },
        select: { id: true },
      });

      m.clinicalTeam.findFirst.mockResolvedValue({ id: 'team_1' });
      await expect(assertPatientAccess({ id: 'u1', role: Role.DOCTOR }, 'pat_1')).resolves.toEqual({
        role: Role.DOCTOR,
        doctorProfileId: 'doc_1',
      });
    });

    it('nutricionista precisa de vínculo ATIVO como nutricionista do paciente', async () => {
      m.nutritionistProfile.findUnique.mockResolvedValue({ id: 'nut_1' });
      m.clinicalTeam.findFirst.mockResolvedValue(null);

      await expect(assertPatientAccess({ id: 'u1', role: Role.NUTRITIONIST }, 'pat_1')).rejects.toMatchObject({ statusCode: 403 });
      expect(m.clinicalTeam.findFirst).toHaveBeenCalledWith({
        where: { patientProfileId: 'pat_1', nutritionistProfileId: 'nut_1', status: 'ACTIVE' },
        select: { id: true },
      });
    });
  });

  describe('filtros de listagem', () => {
    it('paciente vê apenas o próprio perfil', () => {
      expect(accessiblePatientsWhere({ role: Role.PATIENT, patientProfileId: 'pat_1' })).toEqual({ id: 'pat_1' });
    });

    it('profissional vê apenas pacientes com vínculo ativo', () => {
      expect(accessiblePatientsWhere({ role: Role.NUTRITIONIST, nutritionistProfileId: 'nut_1' })).toEqual({
        clinicalTeams: { some: { nutritionistProfileId: 'nut_1', status: 'ACTIVE' } },
      });
    });

    it('paciente não tem filtro de equipe profissional', () => {
      expect(() => professionalTeamWhere({ role: Role.PATIENT, patientProfileId: 'pat_1' })).toThrow();
    });
  });

  describe('haveActiveClinicalLink', () => {
    it('usuário não conversa consigo mesmo', async () => {
      await expect(haveActiveClinicalLink('u1', 'u1')).resolves.toBe(false);
      expect(m.clinicalTeam.findFirst).not.toHaveBeenCalled();
    });

    it('exige os dois usuários na mesma equipe clínica ativa', async () => {
      m.clinicalTeam.findFirst.mockResolvedValue(null);
      await expect(haveActiveClinicalLink('u1', 'u2')).resolves.toBe(false);

      const where = m.clinicalTeam.findFirst.mock.calls[0][0].where;
      expect(where.status).toBe('ACTIVE');
      expect(where.AND).toHaveLength(2);

      m.clinicalTeam.findFirst.mockResolvedValue({ id: 'team_1' });
      await expect(haveActiveClinicalLink('u1', 'u2')).resolves.toBe(true);
    });
  });
});
