// src/http/routes/checkins/index.ts
// Check-in semanal do paciente — sintomas, peso, bem-estar

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, ConflictError } from '../../errors/handler';
import { SymptomScore } from '../../../domain/value-objects/symptom-score.vo';

/** Valida a escala de sintoma (0–10) usando o Value Object de domínio */
const symptomScoreField = z
  .number()
  .int()
  .min(0)
  .max(10)
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    SymptomScore.create(v); // lança erro se inválido
    return v;
  });

const CheckinSchema = z.object({
  date: z.string().date(),
  weightKg: z.number().positive().optional(),
  nauseaScore: symptomScoreField,
  vomitScore: symptomScoreField,
  constipationScore: symptomScoreField,
  fatigueScore: symptomScoreField,
  energyScore: symptomScoreField,
  appetiteScore: symptomScoreField,
  notes: z.string().max(1000).optional(),
  photoUrl: z.string().url().optional(),
});

export default async function checkinsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /checkins
   * Paciente envia check-in semanal de sintomas e bem-estar
   * Dispara criação automática de alertas se sintomas forem severos (≥7)
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = CheckinSchema.parse(request.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) throw new ForbiddenError();

      // Evita check-in duplicado para a mesma semana
      const existing = await prisma.weeklyCheckin.findUnique({
        where: { patientProfileId_date: { patientProfileId: patientProfile.id, date: new Date(body.date) } },
      });
      if (existing) {
        throw new ConflictError('Check-in já registrado para esta data. Use PATCH para atualizar.');
      }

      const checkin = await prisma.weeklyCheckin.create({
        data: {
          patientProfileId: patientProfile.id,
          date: new Date(body.date),
          weightKg: body.weightKg ?? null,
          nauseaScore: body.nauseaScore ?? null,
          vomitScore: body.vomitScore ?? null,
          constipationScore: body.constipationScore ?? null,
          fatigueScore: body.fatigueScore ?? null,
          energyScore: body.energyScore ?? null,
          appetiteScore: body.appetiteScore ?? null,
          notes: body.notes ?? null,
          photoUrl: body.photoUrl ?? null,
        },
      });

      // Dispara alerta se algum sintoma for severo (≥7) — regra de negócio clínica
      await triggerSeverityAlerts(patientProfile.id, body);

      return reply.status(201).send({ data: checkin });
    },
  );

  /**
   * GET /checkins
   * Histórico de check-ins (paciente vê o próprio; profissionais veem via /patients/:id)
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { limit, offset } = request.query as { limit?: string; offset?: string };

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) return reply.send({ data: [] });

      const checkins = await prisma.weeklyCheckin.findMany({
        where: { patientProfileId: patientProfile.id },
        orderBy: { date: 'desc' },
        take: Number(limit ?? 20),
        skip: Number(offset ?? 0),
      });

      return reply.send({ data: checkins });
    },
  );

  /**
   * GET /checkins/latest
   * Último check-in do paciente autenticado
   */
  fastify.get(
    '/latest',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) return reply.send({ data: null });

      const latest = await prisma.weeklyCheckin.findFirst({
        where: { patientProfileId: patientProfile.id },
        orderBy: { date: 'desc' },
      });

      return reply.send({ data: latest });
    },
  );
}

/**
 * Cria alertas clínicos automaticamente quando sintomas severos são reportados.
 * Regra: qualquer sintoma ≥ 7 gera alerta MEDIUM; ≥ 9 gera alerta HIGH.
 */
async function triggerSeverityAlerts(
  patientProfileId: string,
  scores: {
    nauseaScore?: number;
    vomitScore?: number;
    constipationScore?: number;
    fatigueScore?: number;
  },
): Promise<void> {
  const symptomsMap: Record<string, number | undefined> = {
    Náusea: scores.nauseaScore,
    Vômito: scores.vomitScore,
    Constipação: scores.constipationScore,
    Fadiga: scores.fatigueScore,
  };

  const team = await prisma.clinicalTeam.findFirst({
    where: { patientProfileId, status: 'ACTIVE' },
    select: { doctorProfileId: true },
  });
  if (!team) return;

  for (const [symptom, score] of Object.entries(symptomsMap)) {
    if (score === undefined || score < 7) continue;

    const severity = score >= 9 ? 'HIGH' : 'MEDIUM';

    await prisma.clinicalAlert.create({
      data: {
        patientProfileId,
        doctorProfileId: team.doctorProfileId,
        type: 'SINTOMA_SEVERO',
        severity,
        // Mensagem não contém dados pessoais identificáveis além do necessário
        message: `${symptom} com intensidade ${score}/10 reportada no check-in semanal.`,
      },
    });
  }
}
