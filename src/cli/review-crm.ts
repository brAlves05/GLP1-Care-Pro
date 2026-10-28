// src/cli/review-crm.ts
// Revisão manual do CRM — usada até existir integração com a API do CFM.
// Conferir o registro no portal do CFM (https://portal.cfm.org.br/busca-medicos) antes de aprovar.
// Uso:
//   npm run crm:review -- list
//   npm run crm:review -- <CRM> <UF> approve|reject

import * as os from 'os';
import { prisma } from '../infrastructure/database/prisma.client';
import { auditService } from '../infrastructure/services/audit.service';

const USAGE = 'Uso: npm run crm:review -- list | <CRM> <UF> approve|reject';

async function listPending(): Promise<void> {
  const pending = await prisma.doctorProfile.findMany({
    where: { verificationStatus: 'PENDING' },
    select: { crm: true, crmState: true, specialty: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });
  if (pending.length === 0) {
    console.log('Nenhum CRM pendente.');
    return;
  }
  for (const d of pending) {
    console.log(`${d.crm}/${d.crmState}  ${d.specialty}  cadastrado em ${d.createdAt.toISOString().slice(0, 10)}`);
  }
}

async function review(crm: string, uf: string, approved: boolean): Promise<void> {
  const where = { crm_crmState: { crm, crmState: uf.toUpperCase() } };
  const before = await prisma.doctorProfile.findUnique({
    where,
    select: { id: true, verificationStatus: true },
  });
  if (!before) throw new Error(`CRM ${crm}/${uf.toUpperCase()} não encontrado.`);

  const after = await prisma.doctorProfile.update({
    where,
    data: {
      verificationStatus: approved ? 'APPROVED' : 'REJECTED',
      verifiedAt: approved ? new Date() : null,
    },
    select: { verificationStatus: true },
  });

  // Trilha de auditoria: quem decidiu (operador do sistema) e qual era o status anterior
  await auditService.log({
    action: 'CRM_MANUAL_REVIEW',
    resource: 'DoctorProfile',
    resourceId: before.id,
    metadata: {
      operator: os.userInfo().username,
      host: os.hostname(),
      previousStatus: before.verificationStatus,
      newStatus: after.verificationStatus,
    },
  });

  console.log(`CRM ${crm}/${uf.toUpperCase()}: ${before.verificationStatus} → ${after.verificationStatus}`);
}

async function main(): Promise<void> {
  const [first, uf, decision] = process.argv.slice(2);
  if (first === 'list') return listPending();
  if (!first || !uf || (decision !== 'approve' && decision !== 'reject')) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }
  return review(first, uf, decision === 'approve');
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
