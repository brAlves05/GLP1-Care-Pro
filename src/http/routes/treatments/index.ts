// src/http/routes/treatments/index.ts
// Módulo de tratamentos GLP-1 — prescricão, ajuste de dose e protocolo

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { assertPatientAccess, Requester } from '../../../application/authorization/clinical-access';
import { ForbiddenError, NotFoundError, BusinessRuleError } from '../../errors/handler';
import { Role, Medication, TreatmentStatus } from '../../../domain/enums';

const StartTreatmentSchema = z.object({
  patientProfileId: z.string().cuid(),
  medication: z.nativeEnum(Medication),
  currentDose: z.number().positive(),
  unit: z.string().default('mg'),
  startDate: z.string().date(),
  protocol: z.record(z.string(), z.json()), // JSON flexível — validado no domínio
});

const AdjustDoseSchema = z.object({
  newDose: z.number().positive(),
  unit: z.string().default('mg'),
  reason: z.string().min(10, 'Descreva o motivo do ajuste'),
});

const UpdateStatusSchema = z.object({
  status: z.enum([
    TreatmentStatus.PAUSED,
    TreatmentStatus.COMPLETED,
    TreatmentStatus.ABANDONED,
    TreatmentStatus.ACTIVE,
  ]),
  reason: z.string().min(5, 'Motivo obrigatório'),
});

/** Acesso ao tratamento = acesso ao paciente dono do tratamento */
async function assertTreatmentAccess(requester: Requester, treatmentId: string): Promise<void> {
  const treatment = await prisma.treatment.findUnique({
    where: { id: treatmentId },
    select: { patientProfileId: true },
  });
  if (!treatment) throw new NotFoundError('Tratamento');
  await assertPatientAccess(requester, treatment.patientProfileId);
}

export default async function treatmentsRoutes(fastify: FastifyInstance): Promise<void> {
  const doctorAuth = [
    fastify.authenticate,
    fastify.requireRole(Role.DOCTOR),
  ];

  /**
   * POST /treatments
   * Médico inicia novo tratamento GLP-1 para paciente vinculado
   */
  fastify.post(
    '/',
    { preHandler: doctorAuth },
    async (request, reply) => {
      const body = StartTreatmentSchema.parse(request.body);

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true, verificationStatus: true },
      });

      if (!doctorProfile) throw new ForbiddenError();
      if (doctorProfile.verificationStatus !== 'APPROVED') {
        throw new BusinessRuleError(
          'CRM pendente de verificação. Não é possível prescrever tratamentos.',
          'CRM_NOT_VERIFIED',
        );
      }

      await assertPatientAccess(request.user, body.patientProfileId);

      // Pausa tratamentos ativos anteriores automaticamente
      await prisma.treatment.updateMany({
        where: {
          patientProfileId: body.patientProfileId,
          status: TreatmentStatus.ACTIVE,
        },
        data: { status: TreatmentStatus.PAUSED, statusReason: 'Novo tratamento iniciado' },
      });

      const treatment = await prisma.treatment.create({
        data: {
          patientProfileId: body.patientProfileId,
          doctorProfileId: doctorProfile.id,
          medication: body.medication,
          currentDose: body.currentDose,
          unit: body.unit,
          startDate: new Date(body.startDate),
          protocol: body.protocol,
        },
      });

      return reply.status(201).send({ data: treatment });
    },
  );

  /**
   * GET /treatments/:id
   * Detalhes completos do tratamento + protocolo + logs de dose recentes
   */
  fastify.get(
    '/:id',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const treatment = await prisma.treatment.findUnique({
        where: { id },
        include: {
          doseProtocols: { orderBy: { weekNumber: 'asc' } },
          doseLogs: {
            orderBy: { scheduledDate: 'desc' },
            take: 10,
          },
        },
      });

      if (!treatment) throw new NotFoundError('Tratamento');
      await assertPatientAccess(request.user, treatment.patientProfileId);

      return reply.send({ data: treatment });
    },
  );

  /**
   * PATCH /treatments/:id/dose
   * Médico ajusta a dose atual — registra alteração no protocolo
   */
  fastify.patch(
    '/:id/dose',
    { preHandler: doctorAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = AdjustDoseSchema.parse(request.body);

      const treatment = await prisma.treatment.findUnique({
        where: { id },
        select: { id: true, status: true, doctorProfileId: true, patientProfileId: true, currentDose: true, unit: true },
      });

      if (!treatment) throw new NotFoundError('Tratamento');
      if (treatment.status !== TreatmentStatus.ACTIVE) {
        throw new BusinessRuleError('Não é possível ajustar dose de tratamento inativo.');
      }

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== treatment.doctorProfileId) throw new ForbiddenError();
      await assertPatientAccess(request.user, treatment.patientProfileId);

      const updated = await prisma.treatment.update({
        where: { id },
        data: {
          currentDose: body.newDose,
          unit: body.unit,
          protocol: {
            doseHistory: [
              { dose: treatment.currentDose, unit: treatment.unit, changedAt: new Date(), reason: body.reason },
            ],
          },
        },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * PATCH /treatments/:id/status
   * Pausar / retomar / encerrar / abandonar tratamento
   */
  fastify.patch(
    '/:id/status',
    { preHandler: doctorAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdateStatusSchema.parse(request.body);

      const treatment = await prisma.treatment.findUnique({
        where: { id },
        select: { id: true, doctorProfileId: true, patientProfileId: true, status: true },
      });
      if (!treatment) throw new NotFoundError('Tratamento');

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== treatment.doctorProfileId) throw new ForbiddenError();
      await assertPatientAccess(request.user, treatment.patientProfileId);

      const updated = await prisma.treatment.update({
        where: { id },
        data: {
          status: body.status,
          statusReason: body.reason,
          endDate: [TreatmentStatus.COMPLETED, TreatmentStatus.ABANDONED].includes(body.status)
            ? new Date()
            : null,
        },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * GET /treatments/:id/protocol
   * Protocolo completo de escalonamento de dose semana a semana
   */
  fastify.get(
    '/:id/protocol',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertTreatmentAccess(request.user, id);

      const protocols = await prisma.doseProtocol.findMany({
        where: { treatmentId: id },
        orderBy: { weekNumber: 'asc' },
      });

      return reply.send({ data: protocols });
    },
  );
}
