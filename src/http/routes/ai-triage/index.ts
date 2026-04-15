// src/http/routes/ai-triage/index.ts
// Módulo de triagem por IA — análise de sintomas, relatórios automáticos, interações
// ATENÇÃO: IA é ferramenta de suporte clínico — decisão final é sempre do médico

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError } from '../../errors/handler';
import { Role, Medication } from '../../../domain/enums';

/** Nível de urgência clínica retornado pela triagem */
type TriageLevel = 'GREEN' | 'YELLOW' | 'RED';

const TriageSymptomsSchema = z.object({
  symptoms: z.array(
    z.object({
      name: z.string().min(2).max(100),
      /** Intensidade 0–10 */
      score: z.number().int().min(0).max(10),
      durationDays: z.number().int().min(0).optional(),
    }),
  ).min(1).max(20),
  notes: z.string().max(2000).optional(),
});

const GenerateReportSchema = z.object({
  patientProfileId: z.string().cuid(),
  appointmentId: z.string().cuid().optional(),
  includePeriodDays: z.number().int().min(7).max(180).default(30),
});

const CheckInteractionsSchema = z.object({
  medications: z.array(z.string().min(1)).min(1).max(20),
  glp1Medication: z.nativeEnum(Medication),
});

export default async function aiTriageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /ai/triage-symptoms
   * Triagem de sintomas reportados pelo paciente
   * Retorna nível de urgência: GREEN (monitorar) | YELLOW (atenção) | RED (urgente)
   *
   * DISCLAIMER: resultado é sugestão — não substitui avaliação médica.
   */
  fastify.post(
    '/triage-symptoms',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = TriageSymptomsSchema.parse(request.body);

      const triage = classifySymptomsLocally(body.symptoms);

      // Se RED, cria alerta clínico automático para o médico vinculado
      if (triage.level === 'RED') {
        const patientProfile = await prisma.patientProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });

        if (patientProfile) {
          const team = await prisma.clinicalTeam.findFirst({
            where: { patientProfileId: patientProfile.id, status: 'ACTIVE' },
            select: { doctorProfileId: true },
          });

          if (team) {
            await prisma.clinicalAlert.create({
              data: {
                patientProfileId: patientProfile.id,
                doctorProfileId: team.doctorProfileId,
                type: 'TRIAGEM_IA_VERMELHO',
                severity: 'HIGH',
                message: `Triagem automática identificou sintomas críticos: ${triage.topSymptoms.join(', ')}. Avaliação urgente recomendada.`,
              },
            });
          }
        }
      }

      return reply.send({
        data: {
          level: triage.level,
          recommendation: triage.recommendation,
          topSymptoms: triage.topSymptoms,
          disclaimer:
            'Este resultado é uma triagem automática e não substitui avaliação médica presencial.',
        },
      });
    },
  );

  /**
   * POST /ai/generate-report
   * Gera relatório de retorno automático para consulta
   * Exclusivo para médicos — agrega dados clínicos do período
   */
  fastify.post(
    '/generate-report',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const body = GenerateReportSchema.parse(request.body);

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!doctorProfile) throw new ForbiddenError();

      // Verifica vínculo clínico
      const team = await prisma.clinicalTeam.findFirst({
        where: {
          doctorProfileId: doctorProfile.id,
          patientProfileId: body.patientProfileId,
          status: 'ACTIVE',
        },
      });
      if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');

      const since = new Date(Date.now() - body.includePeriodDays * 24 * 60 * 60 * 1000);

      const [checkins, biometrics, doseLogs, treatment] = await Promise.all([
        prisma.weeklyCheckin.findMany({
          where: { patientProfileId: body.patientProfileId, date: { gte: since } },
          orderBy: { date: 'asc' },
        }),
        prisma.biometricLog.findMany({
          where: { patientProfileId: body.patientProfileId, measuredAt: { gte: since } },
          orderBy: { measuredAt: 'asc' },
        }),
        prisma.doseLog.findMany({
          where: {
            treatment: { patientProfileId: body.patientProfileId },
            scheduledDate: { gte: since },
          },
        }),
        prisma.treatment.findFirst({
          where: { patientProfileId: body.patientProfileId, status: 'ACTIVE' },
        }),
      ]);

      // Geração do relatório — em produção: enviar para API de LLM (Claude, GPT-4)
      const report = generateClinicalSummary({
        checkins,
        biometrics,
        doseLogs,
        treatment,
        periodDays: body.includePeriodDays,
      });

      return reply.send({
        data: {
          ...report,
          disclaimer:
            'Relatório gerado por IA. Valide os dados antes de incluir no prontuário.',
          generatedAt: new Date().toISOString(),
        },
      });
    },
  );

  /**
   * POST /ai/check-interactions
   * Verifica interações medicamentosas com o GLP-1 em uso
   * Exclusivo para médicos — auxílio na prescrição
   */
  fastify.post(
    '/check-interactions',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const body = CheckInteractionsSchema.parse(request.body);

      // Em produção: integrar com base de dados de interações (DrugBank, RxNorm, ANVISA)
      const interactions = checkKnownInteractions(body.glp1Medication, body.medications);

      return reply.send({
        data: {
          glp1: body.glp1Medication,
          medications: body.medications,
          interactions,
          disclaimer:
            'Verificação automática. Consulte sempre uma fonte especializada (Micromedex, UpToDate).',
        },
      });
    },
  );
}

// ── Funções auxiliares de lógica clínica simplificada ─────────────────────────

interface TriageResult {
  level: TriageLevel;
  recommendation: string;
  topSymptoms: string[];
}

/**
 * Classificação local de sintomas — lógica baseada em critérios clínicos GLP-1.
 * Em produção: substituir por chamada a LLM com prompt clínico especializado.
 */
function classifySymptomsLocally(
  symptoms: Array<{ name: string; score: number }>,
): TriageResult {
  const sorted = [...symptoms].sort((a, b) => b.score - a.score);
  const maxScore = sorted[0]?.score ?? 0;
  const topSymptoms = sorted.slice(0, 3).map((s) => s.name);

  // RED: sintoma ≥ 9 ou múltiplos sintomas severos (≥ 7) — sinaliza urgência
  if (maxScore >= 9 || symptoms.filter((s) => s.score >= 7).length >= 3) {
    return {
      level: 'RED',
      recommendation:
        'Sintomas críticos detectados. Contate seu médico imediatamente ou busque atendimento de urgência.',
      topSymptoms,
    };
  }

  // YELLOW: sintoma moderado a severo (≥ 6)
  if (maxScore >= 6) {
    return {
      level: 'YELLOW',
      recommendation:
        'Sintomas moderados a severos. Agende consulta de retorno em até 48h e registre no diário.',
      topSymptoms,
    };
  }

  // GREEN: sintomas leves — monitoramento
  return {
    level: 'GREEN',
    recommendation:
      'Sintomas leves. Continue o monitoramento semanal e registre no diário de sintomas.',
    topSymptoms,
  };
}

/**
 * Verifica interações conhecidas entre GLP-1 e outros medicamentos.
 * @todo Substituir por consulta à base DrugBank/RxNorm em produção.
 */
function checkKnownInteractions(
  glp1: Medication,
  medications: string[],
): Array<{ medication: string; severity: string; description: string }> {
  void glp1;
  // Interações conhecidas simplificadas — apenas demonstrativo
  const knownInteractions: Record<string, { severity: string; description: string }> = {
    warfarin: {
      severity: 'MODERATE',
      description: 'GLP-1 pode alterar absorção de warfarina. Monitore INR.',
    },
    insulina: {
      severity: 'HIGH',
      description:
        'Risco de hipoglicemia aumentado. Reduza dose de insulina conforme orientação médica.',
    },
    metformina: {
      severity: 'LOW',
      description: 'Associação benéfica — sem interação clinicamente significativa.',
    },
  };

  return medications
    .map((med) => {
      const key = med.toLowerCase().trim();
      const interaction = knownInteractions[key];
      if (!interaction) return null;
      return { medication: med, ...interaction };
    })
    .filter(Boolean) as Array<{ medication: string; severity: string; description: string }>;
}

/** Gera resumo clínico estruturado a partir dos dados do período */
function generateClinicalSummary(data: {
  checkins: Array<{ weightKg: number | null; nauseaScore: number | null; date: Date }>;
  biometrics: Array<{ type: string; value: number; measuredAt: Date }>;
  doseLogs: Array<{ confirmed: boolean; skipReason: string | null }>;
  treatment: { medication: string; currentDose: number; unit: string } | null;
  periodDays: number;
}): Record<string, unknown> {
  const weights = data.checkins
    .map((c) => c.weightKg)
    .filter((w): w is number => w !== null);

  const firstWeight = weights[0] ?? null;
  const lastWeight = weights[weights.length - 1] ?? null;
  const weightDelta = firstWeight && lastWeight ? lastWeight - firstWeight : null;

  const doseAdherence =
    data.doseLogs.length > 0
      ? Math.round((data.doseLogs.filter((d) => d.confirmed).length / data.doseLogs.length) * 100)
      : null;

  const avgNausea =
    data.checkins.filter((c) => c.nauseaScore !== null).length > 0
      ? data.checkins.reduce((sum, c) => sum + (c.nauseaScore ?? 0), 0) /
        data.checkins.filter((c) => c.nauseaScore !== null).length
      : null;

  return {
    period: `${data.periodDays} dias`,
    treatment: data.treatment
      ? { medication: data.treatment.medication, currentDose: `${data.treatment.currentDose}${data.treatment.unit}` }
      : null,
    weightSummary: {
      initial: firstWeight,
      current: lastWeight,
      delta: weightDelta !== null ? `${weightDelta >= 0 ? '+' : ''}${weightDelta.toFixed(1)} kg` : null,
    },
    doseAdherence: doseAdherence !== null ? `${doseAdherence}%` : null,
    avgNauseaScore: avgNausea !== null ? Math.round(avgNausea * 10) / 10 : null,
    checkinsCount: data.checkins.length,
  };
}
