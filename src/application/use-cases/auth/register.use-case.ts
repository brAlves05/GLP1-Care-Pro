// src/application/use-cases/auth/register.use-case.ts
// Cadastro de novo usuário — cria User + perfil específico por papel

import { prisma } from '../../../infrastructure/database/prisma.client';
import { passwordService } from '../../../infrastructure/services/password.service';
import { auditService } from '../../../infrastructure/services/audit.service';
import { ConflictError, BusinessRuleError } from '../../../http/errors/handler';
import { Role } from '../../../domain/enums';
import { LGPD_CONSENT_VERSION } from '../../../shared/constants';

export interface RegisterInput {
  email: string;
  password: string;
  phone?: string;
  role: Role;
  ipAddress?: string;
  // Dados específicos por papel
  doctor?: {
    crm: string;
    crmState: string;
    specialty: string;
  };
  nutritionist?: {
    cfn: string;
    specialty: string;
  };
  patient?: {
    dateOfBirth: Date;
    biologicalSex: 'MALE' | 'FEMALE' | 'INTERSEX';
    heightCm?: number;
    lgpdConsent: boolean; // obrigatório para pacientes
  };
}

export interface RegisterOutput {
  userId: string;
  email: string;
  role: Role;
  requiresMfaSetup: boolean;
}

/**
 * Registra novo usuário com perfil específico por papel.
 * - Médicos e nutricionistas ficam com verificationStatus=PENDING até aprovação manual.
 * - Pacientes precisam aceitar os termos LGPD explicitamente.
 */
export async function registerUseCase(
  input: RegisterInput,
): Promise<RegisterOutput> {
  // Verifica e-mail duplicado
  const existing = await prisma.user.findUnique({
    where: { email: input.email },
    select: { id: true },
  });
  if (existing) {
    throw new ConflictError('E-mail já cadastrado.');
  }

  // Valida consentimento LGPD para pacientes
  if (input.role === Role.PATIENT) {
    if (!input.patient?.lgpdConsent) {
      throw new BusinessRuleError(
        'Consentimento LGPD obrigatório para cadastro de pacientes.',
        'LGPD_CONSENT_REQUIRED',
      );
    }
  }

  // Valida dados obrigatórios por papel
  if (input.role === Role.DOCTOR && !input.doctor) {
    throw new BusinessRuleError('Dados do CRM obrigatórios para médicos.');
  }
  if (input.role === Role.NUTRITIONIST && !input.nutritionist) {
    throw new BusinessRuleError('Dados do CFN obrigatórios para nutricionistas.');
  }
  if (input.role === Role.PATIENT && !input.patient) {
    throw new BusinessRuleError('Dados do perfil obrigatórios para pacientes.');
  }

  const passwordHash = await passwordService.hash(input.password);
  const lgpdConsentAt = new Date();

  const user = await prisma.$transaction(async (tx) => {
    // Cria o usuário base
    const newUser = await tx.user.create({
      data: {
        email: input.email,
        phone: input.phone ?? null,
        passwordHash,
        role: input.role,
        mfaEnabled: false,
      },
    });

    // Cria o perfil específico por papel
    if (input.role === Role.DOCTOR && input.doctor) {
      await tx.doctorProfile.create({
        data: {
          userId: newUser.id,
          crm: input.doctor.crm,
          crmState: input.doctor.crmState.toUpperCase(),
          specialty: input.doctor.specialty,
          verificationStatus: 'PENDING',
        },
      });
    } else if (input.role === Role.NUTRITIONIST && input.nutritionist) {
      await tx.nutritionistProfile.create({
        data: {
          userId: newUser.id,
          cfn: input.nutritionist.cfn,
          specialty: input.nutritionist.specialty,
        },
      });
    } else if (input.role === Role.PATIENT && input.patient) {
      await tx.patientProfile.create({
        data: {
          userId: newUser.id,
          dateOfBirth: input.patient.dateOfBirth,
          biologicalSex: input.patient.biologicalSex,
          heightCm: input.patient.heightCm ?? null,
          lgpdConsentAt,
          lgpdConsentVersion: LGPD_CONSENT_VERSION,
        },
      });
    }

    return newUser;
  });

  // Registra consentimento LGPD para pacientes
  if (input.role === Role.PATIENT) {
    await auditService.logLgpdConsent(
      user.id,
      LGPD_CONSENT_VERSION,
      true,
      input.ipAddress ?? 'unknown',
    );
  }

  await auditService.logAuth('LOGIN', user.id, {
    email: user.email,
    ipAddress: input.ipAddress,
  });

  // Profissionais precisam configurar MFA antes do primeiro acesso clínico
  const requiresMfaSetup =
    input.role === Role.DOCTOR || input.role === Role.NUTRITIONIST;

  return {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    requiresMfaSetup,
  };
}
