// src/http/routes/dose-logs/index.ts
// Registro de aplicação de doses pelo paciente

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError } from '../../errors/handler';
import { Role } from '../../../domain/enums';
import { SymptomScore } from '../../../domain/value-objects/symptom-score.vo';

const ConfirmDoseSchema = z.object({
  treatmentId: z.string().cuid(),
  scheduledDate: z.string().date(),
  appliedAt: z.string().datetime().optional(),
  site: z.enum(['ABDOMEN', 'THIGH', 'ARM']).optional(),
  notes: z.string().max(500).optional(),
});

const SkipDoseSchema = z.object({
  skipReason: z.string().min(5, 'Descreva o motivo do pulo').max(300),
});

export default async function doseLogsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /dose-logs
   * Paciente confirma aplicação de dose
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = ConfirmDoseSchema.parse(request.body);

      // Valida que o tratamento pertence ao paciente autenticado
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      if (!patientProfile) throw new ForbiddenError();

      const treatment = await prisma.treatment.findUnique({
        where: { id: body.treatmentId },
        select: { patientProfileId: true, status: true },
      });

      if (!treatment) throw new NotFoundError('Tratamento');
      if (treatment.patientProfileId !== patientProfile.id) throw new ForbiddenError();

      // Verifica se já existe log para esta data (evita duplicatas)
      const existing = await prisma.doseLog.findFirst({
        where: { treatmentId: body.treatmentId, scheduledDate: new Date(body.scheduledDate) },
      });

      const doseLog = existing
        ? await prisma.doseLog.update({
            where: { id: existing.id },
            data: {
              appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
              site: body.site ?? null,
              confirmed: true,
              notes: body.notes ?? null,
            },
          })
        : await prisma.doseLog.create({
            data: {
              treatmentId: body.treatmentId,
              scheduledDate: new Date(body.scheduledDate),
              appliedAt: body.appliedAt ? new Date(body.appliedAt) : new Date(),
              site: body.site ?? null,
              confirmed: true,
              notes: body.notes ?? null,
            },
          });

      return reply.status(201).send({ data: doseLog });
    },
  );

  /**
   * GET /dose-logs/pending
   * Lista doses pendentes do paciente autenticado (próximos 7 dias)
   */
  fastify.get(
    '/pending',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      if (!patientProfile) {
        return reply.send({ data: [] });
      }

      const activeTreatment = await prisma.treatment.findFirst({
        where: { patientProfileId: patientProfile.id, status: 'ACTIVE' },
        select: { id: true },
      });

      if (!activeTreatment) {
        return reply.send({ data: [] });
      }

      const today = new Date();
      const nextWeek = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);

      const pending = await prisma.doseLog.findMany({
        where: {
          treatmentId: activeTreatment.id,
          confirmed: false,
          scheduledDate: { gte: today, lte: nextWeek },
        },
        orderBy: { scheduledDate: 'asc' },
      });

      return reply.send({ data: pending });
    },
  );

  /**
   * PATCH /dose-logs/:id/skip
   * Paciente registra que pulou uma dose e informa o motivo
   */
  fastify.patch(
    '/:id/skip',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = SkipDoseSchema.parse(request.body);

      const doseLog = await prisma.doseLog.findUnique({
        where: { id },
        include: { treatment: { select: { patientProfileId: true } } },
      });

      if (!doseLog) throw new NotFoundError('Registro de dose');

      // Valida propriedade do registro
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      if (patientProfile?.id !== doseLog.treatment.patientProfileId) {
        throw new ForbiddenError();
      }

      const updated = await prisma.doseLog.update({
        where: { id },
        data: { skipReason: body.skipReason, confirmed: false, appliedAt: null },
      });

      return reply.send({ data: updated });
    },
  );
}
