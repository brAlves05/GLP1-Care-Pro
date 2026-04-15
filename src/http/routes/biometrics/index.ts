// src/http/routes/biometrics/index.ts
// Registro e consulta de biométricas (peso, glicemia, PA, FC, circunferência)

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError } from '../../errors/handler';
import { BiometricType, BiometricSource } from '../../../domain/enums';

const LogBiometricSchema = z.object({
  type: z.nativeEnum(BiometricType),
  value: z.number().positive(),
  unit: z.string().min(1).max(20),
  measuredAt: z.string().datetime(),
  source: z.nativeEnum(BiometricSource).default(BiometricSource.MANUAL),
  deviceId: z.string().optional(),
  notes: z.string().max(300).optional(),
});

const BiometricQuerySchema = z.object({
  type: z.nativeEnum(BiometricType).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function biometricsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /biometrics
   * Paciente registra medição biométrica (manual ou via dispositivo/app)
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = LogBiometricSchema.parse(request.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) throw new ForbiddenError();

      const log = await prisma.biometricLog.create({
        data: {
          patientProfileId: patientProfile.id,
          type: body.type,
          value: body.value,
          unit: body.unit,
          measuredAt: new Date(body.measuredAt),
          source: body.source,
          deviceId: body.deviceId ?? null,
          notes: body.notes ?? null,
        },
      });

      return reply.status(201).send({ data: log });
    },
  );

  /**
   * GET /biometrics
   * Histórico de biométricas do paciente autenticado com filtros por tipo e período
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = BiometricQuerySchema.parse(request.query);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) return reply.send({ data: [] });

      const logs = await prisma.biometricLog.findMany({
        where: {
          patientProfileId: patientProfile.id,
          ...(query.type ? { type: query.type } : {}),
          measuredAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        },
        orderBy: { measuredAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      });

      return reply.send({ data: logs });
    },
  );

  /**
   * GET /biometrics/summary
   * Resumo estatístico para dashboard: último valor, média 30d, tendência
   */
  fastify.get(
    '/summary',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) return reply.send({ data: {} });

      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      // Busca o último registro e a média dos últimos 30 dias para cada tipo
      const summaries = await Promise.all(
        Object.values(BiometricType).map(async (type) => {
          const [latest, recent] = await Promise.all([
            prisma.biometricLog.findFirst({
              where: { patientProfileId: patientProfile.id, type },
              orderBy: { measuredAt: 'desc' },
              select: { value: true, unit: true, measuredAt: true },
            }),
            prisma.biometricLog.findMany({
              where: {
                patientProfileId: patientProfile.id,
                type,
                measuredAt: { gte: thirtyDaysAgo },
              },
              select: { value: true },
            }),
          ]);

          if (!latest) return null;

          const avg =
            recent.length > 0
              ? recent.reduce((sum, r) => sum + r.value, 0) / recent.length
              : null;

          return {
            type,
            latest: { value: latest.value, unit: latest.unit, at: latest.measuredAt },
            avg30d: avg !== null ? Math.round(avg * 100) / 100 : null,
            dataPoints: recent.length,
          };
        }),
      );

      const data = Object.fromEntries(
        summaries
          .filter(Boolean)
          .map((s) => [s!.type, s]),
      );

      return reply.send({ data });
    },
  );
}
