// src/application/use-cases/auth/verify-crm.use-case.ts
// Verificação de CRM via API do CFM (Conselho Federal de Medicina)
// Documentação: https://portal.cfm.org.br/web/guest/consultamed

import { prisma } from '../../../infrastructure/database/prisma.client';
import { NotFoundError, BusinessRuleError } from '../../../http/errors/handler';

export interface VerifyCrmInput {
  doctorProfileId: string;
  crm: string;
  crmState: string;
}

export interface CrmVerificationResult {
  status: 'APPROVED' | 'REJECTED' | 'PENDING';
  doctorName?: string;
  specialty?: string;
  situation?: string;
}

/** Resposta da consulta ao CFM; null = integração indisponível */
type CfmLookup = { active: boolean; doctorName: string; specialty: string; situation: string } | null;

/**
 * Verifica o CRM do médico no CFM e atualiza o status de verificação.
 * Sem resposta do CFM o cadastro permanece PENDING (revisão manual) — nunca
 * aprovar automaticamente: só médicos APPROVED podem prescrever.
 */
export async function verifyCrmUseCase(
  input: VerifyCrmInput,
): Promise<CrmVerificationResult> {
  const profile = await prisma.doctorProfile.findUnique({
    where: { id: input.doctorProfileId },
    select: { crm: true, crmState: true, verificationStatus: true },
  });

  if (!profile) {
    throw new NotFoundError('Perfil médico');
  }

  if (profile.verificationStatus === 'APPROVED') {
    throw new BusinessRuleError('CRM já verificado.', 'CRM_ALREADY_VERIFIED');
  }

  // Só é possível verificar o CRM cadastrado no próprio perfil
  if (profile.crm !== input.crm || profile.crmState !== input.crmState.toUpperCase()) {
    throw new BusinessRuleError('CRM informado difere do cadastrado no perfil.', 'CRM_MISMATCH');
  }

  const cfm = await consultaCfmApi(profile.crm, profile.crmState);
  if (!cfm) {
    return { status: 'PENDING', situation: 'Aguardando revisão manual do CRM' };
  }

  const status = cfm.active ? 'APPROVED' : 'REJECTED';
  await prisma.doctorProfile.update({
    where: { id: input.doctorProfileId },
    data: { verificationStatus: status, verifiedAt: cfm.active ? new Date() : null },
  });

  return { status, doctorName: cfm.doctorName, specialty: cfm.specialty, situation: cfm.situation };
}

/**
 * Consulta ao CFM (https://sistemas.cfm.org.br/api/v1/medicos/{crm}/{uf}), que exige chave
 * de API fornecida pelo CFM.
 * @todo Implementar a chamada real; até lá retorna null (cadastro fica PENDING e é
 *       aprovado manualmente com `npm run crm:review`).
 */
async function consultaCfmApi(crm: string, uf: string): Promise<CfmLookup> {
  void crm;
  void uf;
  return null;
}
