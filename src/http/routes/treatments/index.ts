// src/http/routes/treatments/index.ts
// Módulo de tratamentos GLP-1 — prescricão, ajuste de dose e protocolo

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError, BusinessRuleError } from '../../errors/handler';
import { Role, Medication, TreatmentStatus } from '../../../domain/enums';

const StartTreatmentSchema = z.object({
  patientProfileId: z.string().cuid(),
  medication: z.nativeEnum(Medication),
  currentDose: z.number().positive(),
  unit: z.string().default('mg'),
  startDate: z.string().date(),
  protocol: z.record(z.unknown()), // JSON flexível — validado no domínio
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

export default async function treatmentsRoutes(fastify: FastifyInstance): Promise<void> {
  const doctorAuth = [
    fastify.authenticate,
    fastify.requireRole(Role.DOCTOR),
    fastify.requireMfa,
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

      // Verifica vínculo com o paciente
      const team = await prisma.clinicalTeam.findFirst({
        where: {
          doctorProfileId: doctorProfile.id,
          patientProfileId: body.patientProfileId,
          status: 'ACTIVE',
        },
      });
      if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');

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
    { preHandler: [fastify.authenticate, fastify.requireMfa] },
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

      // Paciente só acessa seus próprios tratamentos
      if (request.user.role === Role.PATIENT) {
        const profile = await prisma.patientProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });
        if (profile?.id !== treatment.patientProfileId) throw new ForbiddenError();
      }

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
        select: { id: true, status: true, doctorProfileId: true, currentDose: true, unit: true },
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
        select: { id: true, doctorProfileId: true, status: true },
      });
      if (!treatment) throw new NotFoundError('Tratamento');

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== treatment.doctorProfileId) throw new ForbiddenError();

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
    { preHandler: [fastify.authenticate, fastify.requireMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const protocols = await prisma.doseProtocol.findMany({
        where: { treatmentId: id },
        orderBy: { weekNumber: 'asc' },
      });

      return reply.send({ data: protocols });
    },
  );
}
