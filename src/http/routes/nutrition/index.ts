// src/http/routes/nutrition/index.ts
// Planos nutricionais e diário alimentar

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError } from '../../errors/handler';
import { Role, NutritionalPhase, NutritionalPlanStatus, MealType } from '../../../domain/enums';

const CreatePlanSchema = z.object({
  patientProfileId: z.string().cuid(),
  phase: z.nativeEnum(NutritionalPhase),
  caloricGoalKcal: z.number().int().min(800).max(5000),
  proteinGoalG: z.number().positive(),
  carbGoalG: z.number().nonnegative(),
  fatGoalG: z.number().positive(),
  restrictions: z.array(z.string()).default([]),
  guidelines: z.string().max(5000).optional(),
  validFrom: z.string().date(),
  validUntil: z.string().date().optional(),
});

const UpdatePlanSchema = CreatePlanSchema.partial().omit({ patientProfileId: true });

const MealLogSchema = z.object({
  mealType: z.nativeEnum(MealType),
  description: z.string().min(3).max(1000),
  photoUrl: z.string().url().optional(),
  caloriesKcal: z.number().nonnegative().optional(),
  proteinG: z.number().nonnegative().optional(),
  carbG: z.number().nonnegative().optional(),
  fatG: z.number().nonnegative().optional(),
  loggedAt: z.string().datetime(),
});

const MealLogQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  mealType: z.nativeEnum(MealType).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function nutritionRoutes(fastify: FastifyInstance): Promise<void> {
  const nutriAuth = [
    fastify.authenticate,
    fastify.requireRole(Role.NUTRITIONIST),
    fastify.requireMfa,
  ];

  /**
   * POST /nutrition/plans
   * Nutricionista cria plano nutricional para paciente vinculado
   */
  fastify.post(
    '/plans',
    { preHandler: nutriAuth },
    async (request, reply) => {
      const body = CreatePlanSchema.parse(request.body);

      const nutriProfile = await prisma.nutritionistProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!nutriProfile) throw new ForbiddenError();

      // Verifica vínculo clínico
      const team = await prisma.clinicalTeam.findFirst({
        where: {
          nutritionistProfileId: nutriProfile.id,
          patientProfileId: body.patientProfileId,
          status: 'ACTIVE',
        },
      });
      if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');

      // Expira planos anteriores
      await prisma.nutritionalPlan.updateMany({
        where: {
          patientProfileId: body.patientProfileId,
          status: NutritionalPlanStatus.ACTIVE,
        },
        data: { status: NutritionalPlanStatus.SUPERSEDED },
      });

      const plan = await prisma.nutritionalPlan.create({
        data: {
          patientProfileId: body.patientProfileId,
          nutritionistProfileId: nutriProfile.id,
          phase: body.phase,
          caloricGoalKcal: body.caloricGoalKcal,
          proteinGoalG: body.proteinGoalG,
          carbGoalG: body.carbGoalG,
          fatGoalG: body.fatGoalG,
          restrictions: body.restrictions,
          guidelines: body.guidelines ?? null,
          validFrom: new Date(body.validFrom),
          validUntil: body.validUntil ? new Date(body.validUntil) : null,
        },
      });

      return reply.status(201).send({ data: plan });
    },
  );

  /**
   * GET /nutrition/plans/:id
   * Plano nutricional atual do paciente
   */
  fastify.get(
    '/plans/:id',
    { preHandler: [fastify.authenticate, fastify.requireMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const plan = await prisma.nutritionalPlan.findUnique({ where: { id } });
      if (!plan) throw new NotFoundError('Plano nutricional');

      // Paciente só acessa seu próprio plano
      if (request.user.role === Role.PATIENT) {
        const profile = await prisma.patientProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });
        if (profile?.id !== plan.patientProfileId) throw new ForbiddenError();
      }

      return reply.send({ data: plan });
    },
  );

  /**
   * PATCH /nutrition/plans/:id
   * Nutricionista atualiza plano nutricional (metas, fase, restrições)
   */
  fastify.patch(
    '/plans/:id',
    { preHandler: nutriAuth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = UpdatePlanSchema.parse(request.body);

      const plan = await prisma.nutritionalPlan.findUnique({
        where: { id },
        select: { id: true, nutritionistProfileId: true },
      });
      if (!plan) throw new NotFoundError('Plano nutricional');

      const nutriProfile = await prisma.nutritionistProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (nutriProfile?.id !== plan.nutritionistProfileId) throw new ForbiddenError();

      const updated = await prisma.nutritionalPlan.update({
        where: { id },
        data: {
          ...(body.phase !== undefined ? { phase: body.phase } : {}),
          ...(body.caloricGoalKcal !== undefined ? { caloricGoalKcal: body.caloricGoalKcal } : {}),
          ...(body.proteinGoalG !== undefined ? { proteinGoalG: body.proteinGoalG } : {}),
          ...(body.carbGoalG !== undefined ? { carbGoalG: body.carbGoalG } : {}),
          ...(body.fatGoalG !== undefined ? { fatGoalG: body.fatGoalG } : {}),
          ...(body.restrictions !== undefined ? { restrictions: body.restrictions } : {}),
          ...(body.guidelines !== undefined ? { guidelines: body.guidelines } : {}),
          ...(body.validUntil !== undefined ? { validUntil: new Date(body.validUntil) } : {}),
        },
      });

      return reply.send({ data: updated });
    },
  );

  /**
   * POST /nutrition/meal-logs
   * Paciente registra refeição no diário alimentar
   */
  fastify.post(
    '/meal-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const body = MealLogSchema.parse(request.body);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) throw new ForbiddenError();

      const log = await prisma.mealLog.create({
        data: {
          patientProfileId: patientProfile.id,
          mealType: body.mealType,
          description: body.description,
          photoUrl: body.photoUrl ?? null,
          caloriesKcal: body.caloriesKcal ?? null,
          proteinG: body.proteinG ?? null,
          carbG: body.carbG ?? null,
          fatG: body.fatG ?? null,
          loggedAt: new Date(body.loggedAt),
        },
      });

      return reply.status(201).send({ data: log });
    },
  );

  /**
   * GET /nutrition/meal-logs
   * Diário alimentar do paciente com filtros por data e tipo de refeição
   */
  fastify.get(
    '/meal-logs',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = MealLogQuerySchema.parse(request.query);

      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!patientProfile) return reply.send({ data: [] });

      const logs = await prisma.mealLog.findMany({
        where: {
          patientProfileId: patientProfile.id,
          ...(query.mealType ? { mealType: query.mealType } : {}),
          loggedAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        },
        orderBy: { loggedAt: 'desc' },
        take: query.limit,
        skip: query.offset,
      });

      return reply.send({ data: logs });
    },
  );
}
