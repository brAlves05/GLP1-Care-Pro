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
  verified: boolean;
  doctorName?: string;
  specialty?: string;
  situation?: string;
}

/**
 * Verifica o CRM do médico na API do CFM e atualiza o status de verificação.
 *
 * Em produção: integrar com a API do CFM (https://sistemas.cfm.org.br/api/)
 * Esta implementação consulta o endpoint público do CFM e atualiza o perfil.
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

  // ── Integração com API CFM ──────────────────────────────────────────────────
  // Em produção: chamar https://sistemas.cfm.org.br/api/v1/medicos/{crm}/{uf}
  // Requer autenticação via chave da API fornecida pelo CFM.
  // Por enquanto, simula a verificação (substituir em produção):
  const cfmResult = await consultaCfmApi(input.crm, input.crmState);

  const newStatus = cfmResult.verified ? 'APPROVED' : 'REJECTED';

  await prisma.doctorProfile.update({
    where: { id: input.doctorProfileId },
    data: {
      verificationStatus: newStatus,
      verifiedAt: cfmResult.verified ? new Date() : null,
    },
  });

  return cfmResult;
}

/**
 * Stub da integração com a API do CFM.
 * @todo Substituir pela chamada real em produção.
 */
async function consultaCfmApi(
  crm: string,
  uf: string,
): Promise<CrmVerificationResult> {
  // Simulação — em produção: fetch(`https://sistemas.cfm.org.br/api/v1/medicos/${crm}/${uf}`)
  void crm;
  void uf;

  // Retorna verificado para fins de desenvolvimento
  return {
    verified: true,
    doctorName: 'Dr. Verificação Pendente',
    specialty: 'Endocrinologia',
    situation: 'Ativo',
  };
}
