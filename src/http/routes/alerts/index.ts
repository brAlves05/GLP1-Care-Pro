// src/http/routes/alerts/index.ts
// Gestão de alertas clínicos — leitura e resolução por profissionais

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError } from '../../errors/handler';
import { Role, AlertSeverity } from '../../../domain/enums';

const AlertQuerySchema = z.object({
  severity: z.nativeEnum(AlertSeverity).optional(),
  resolved: z.coerce.boolean().default(false),
  patientId: z.string().cuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const ResolveAlertSchema = z.object({
  resolutionNotes: z.string().min(10, 'Descreva a conduta adotada').max(1000),
});

export default async function alertsRoutes(fastify: FastifyInstance): Promise<void> {
  const clinicalAuth = [
    fastify.authenticate,
    fastify.requireRole(Role.DOCTOR, Role.NUTRITIONIST),
    fastify.requireMfa,
  ];

  /**
   * GET /alerts
   * Lista alertas do médico ou nutricionista — filtros por severidade e status
   */
  fastify.get(
    '/',
    { preHandler: clinicalAuth },
    async (request, reply) => {
      const query = AlertQuerySchema.parse(request.query);

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      const alerts = await prisma.clinicalAlert.findMany({
        where: {
          ...(doctorProfile ? { doctorProfileId: doctorProfile.id } : {}),
          ...(query.patientId ? { patientProfileId: query.patientId } : {}),
          ...(query.severity ? { severity: query.severity } : {}),
          resolvedAt: query.resolved ? { not: null } : null,
        },
        include: {
          patientProfile: {
            select: { user: { select: { email: true } } },
          },
        },
        orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
        take: query.limit,
        skip: query.offset,
      });

      return reply.send({ data: alerts });
    },
  );

  /**
   * PATCH /alerts/:id/ack
   * Médico registra ciência do alerta (acknowledgedAt)
   */
  fastify.patch(
    '/:id/ack',
    { preHandler: clinicalAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const alert = await prisma.clinicalAlert.findUnique({
        where: { id },
        select: { id: true, doctorProfileId: true, acknowledgedAt: true },
      });
      if (!alert) throw new NotFoundError('Alerta');

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== alert.doctorProfileId) throw new ForbiddenError();

      const updated = await prisma.clinicalAlert.update({
        where: { id },
        data: { acknowledgedAt: alert.acknowledgedAt ?? new Date() },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * PATCH /alerts/:id/resolve
   * Médico resolve o alerta com nota de conduta clínica
   */
  fastify.patch(
    '/:id/resolve',
    { preHandler: clinicalAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = ResolveAlertSchema.parse(request.body);

      const alert = await prisma.clinicalAlert.findUnique({
        where: { id },
        select: { id: true, doctorProfileId: true, resolvedAt: true },
      });
      if (!alert) throw new NotFoundError('Alerta');
      if (alert.resolvedAt) {
        return reply.send({ message: 'Alerta já resolvido.', data: alert });
      }

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== alert.doctorProfileId) throw new ForbiddenError();

      const updated = await prisma.clinicalAlert.update({
        where: { id },
        data: {
          resolvedAt: new Date(),
          acknowledgedAt: new Date(),
          resolutionNotes: body.resolutionNotes,
        },
      });

      return reply.send({ data: updated });
    },
  );
}
