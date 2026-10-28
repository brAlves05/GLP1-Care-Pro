// src/application/authorization/clinical-access.ts
// Regra única de acesso a dados clínicos (LGPD — princípio da necessidade):
// - Paciente: somente os próprios dados
// - Médico / nutricionista: somente pacientes com vínculo clínico ATIVO
// Nega por padrão: requisitante sem perfil nunca recebe acesso.

import { Prisma } from '@prisma/client';
import { prisma } from '../../infrastructure/database/prisma.client';
import { ForbiddenError } from '../../http/errors/handler';
import { Role } from '../../domain/enums';

export interface Requester {
  id: string;
  role: Role;
}

export type RequesterProfile =
  | { role: Role.PATIENT; patientProfileId: string }
  | { role: Role.DOCTOR; doctorProfileId: string }
  | { role: Role.NUTRITIONIST; nutritionistProfileId: string };

/** Resolve o perfil clínico do usuário autenticado; sem perfil = acesso negado */
export async function resolveRequesterProfile(requester: Requester): Promise<RequesterProfile> {
  const where = { userId: requester.id };
  const select = { id: true } as const;

  switch (requester.role) {
    case Role.PATIENT: {
      const p = await prisma.patientProfile.findUnique({ where, select });
      if (p) return { role: Role.PATIENT, patientProfileId: p.id };
      break;
    }
    case Role.DOCTOR: {
      const p = await prisma.doctorProfile.findUnique({ where, select });
      if (p) return { role: Role.DOCTOR, doctorProfileId: p.id };
      break;
    }
    case Role.NUTRITIONIST: {
      const p = await prisma.nutritionistProfile.findUnique({ where, select });
      if (p) return { role: Role.NUTRITIONIST, nutritionistProfileId: p.id };
      break;
    }
  }
  throw new ForbiddenError('Perfil clínico não encontrado.');
}

/** Filtro de ClinicalTeam do profissional (qualquer status); paciente não tem equipe própria */
export function professionalTeamWhere(profile: RequesterProfile): Prisma.ClinicalTeamWhereInput {
  switch (profile.role) {
    case Role.DOCTOR:
      return { doctorProfileId: profile.doctorProfileId };
    case Role.NUTRITIONIST:
      return { nutritionistProfileId: profile.nutritionistProfileId };
    default:
      throw new ForbiddenError();
  }
}

function activeTeamOf(profile: RequesterProfile): Prisma.ClinicalTeamWhereInput {
  return { ...professionalTeamWhere(profile), status: 'ACTIVE' };
}

/**
 * Filtro Prisma de pacientes que o requisitante pode ver.
 * Usar em listagens: `where: { patientProfile: accessiblePatientsWhere(profile) }`
 * ou `where: { ...accessiblePatientsWhere(profile) }` em PatientProfile.
 */
export function accessiblePatientsWhere(profile: RequesterProfile): Prisma.PatientProfileWhereInput {
  if (profile.role === Role.PATIENT) return { id: profile.patientProfileId };
  return { clinicalTeams: { some: activeTeamOf(profile) } };
}

/** Lança 403 se o requisitante não puder acessar o paciente */
export async function assertPatientAccess(
  requester: Requester,
  patientProfileId: string,
): Promise<RequesterProfile> {
  const profile = await resolveRequesterProfile(requester);

  if (profile.role === Role.PATIENT) {
    if (profile.patientProfileId !== patientProfileId) throw new ForbiddenError();
    return profile;
  }

  const team = await prisma.clinicalTeam.findFirst({
    where: { patientProfileId, ...activeTeamOf(profile) },
    select: { id: true },
  });
  if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');
  return profile;
}

/**
 * Dois usuários podem trocar mensagens somente se houver vínculo clínico ativo
 * entre eles (paciente ↔ seu médico/nutricionista, ou médico ↔ nutricionista
 * que acompanham o mesmo paciente).
 */
export async function haveActiveClinicalLink(userAId: string, userBId: string): Promise<boolean> {
  if (userAId === userBId) return false;

  const involves = (userId: string): Prisma.ClinicalTeamWhereInput => ({
    OR: [
      { patientProfile: { userId } },
      { doctorProfile: { userId } },
      { nutritionistProfile: { userId } },
    ],
  });

  const team = await prisma.clinicalTeam.findFirst({
    where: { status: 'ACTIVE', AND: [involves(userAId), involves(userBId)] },
    select: { id: true },
  });
  return team !== null;
}
