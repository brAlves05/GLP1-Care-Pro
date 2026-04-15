// src/http/routes/patients/index.ts
// Módulo de pacientes — acesso restrito a médicos e nutricionistas do vínculo clínico

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError } from '../../errors/handler';
import { Role } from '../../../domain/enums';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../../../shared/constants';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Verifica se o usuário autenticado tem vínculo ativo com o paciente.
 * Médicos e nutricionistas só podem acessar seus pacientes vinculados.
 */
async function assertClinicalAccess(
  requesterId: string,
  requesterRole: Role,
  patientProfileId: string,
): Promise<void> {
  if (requesterRole === Role.PATIENT) {
    // Paciente só acessa a si mesmo
    const profile = await prisma.patientProfile.findUnique({
      where: { userId: requesterId },
      select: { id: true },
    });
    if (profile?.id !== patientProfileId) throw new ForbiddenError();
    return;
  }

  // Profissional deve ter vínculo ativo
  const doctorProfile = requesterRole === Role.DOCTOR
    ? await prisma.doctorProfile.findUnique({ where: { userId: requesterId }, select: { id: true } })
    : null;
  const nutriProfile = requesterRole === Role.NUTRITIONIST
    ? await prisma.nutritionistProfile.findUnique({ where: { userId: requesterId }, select: { id: true } })
    : null;

  const team = await prisma.clinicalTeam.findFirst({
    where: {
      patientProfileId,
      status: 'ACTIVE',
      ...(doctorProfile ? { doctorProfileId: doctorProfile.id } : {}),
      ...(nutriProfile ? { nutritionistProfileId: nutriProfile.id } : {}),
    },
  });

  if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const ListPatientsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  search: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

const CreatePatientSchema = z.object({
  email: z.string().email(),
  phone: z.string().optional(),
  dateOfBirth: z.string().date(),
  biologicalSex: z.enum(['MALE', 'FEMALE', 'INTERSEX']),
  heightCm: z.number().min(50).max(250).optional(),
  emergencyContact: z.object({
    nome: z.string(),
    telefone: z.string(),
    parentesco: z.string(),
  }).optional(),
});

// ── Rotas ──────────────────────────────────────────────────────────────────────

export default async function patientsRoutes(fastify: FastifyInstance): Promise<void> {
  const auth = [fastify.authenticate, fastify.requireMfa];

  /**
   * GET /patients
   * Lista pacientes vinculados ao médico autenticado (com filtros e paginação)
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR, Role.NUTRITIONIST), fastify.requireMfa] },
    async (request, reply) => {
      const query = ListPatientsQuerySchema.parse(request.query);
      const skip = (query.page - 1) * query.limit;

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      const nutriProfile = await prisma.nutritionistProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      const teams = await prisma.clinicalTeam.findMany({
        where: {
          status: query.status ?? 'ACTIVE',
          ...(doctorProfile ? { doctorProfileId: doctorProfile.id } : {}),
          ...(nutriProfile ? { nutritionistProfileId: nutriProfile.id } : {}),
        },
        include: {
          patientProfile: {
            include: {
              user: { select: { email: true, phone: true, createdAt: true } },
            },
          },
        },
        skip,
        take: query.limit,
        orderBy: { linkedAt: 'desc' },
      });

      // Filtro de busca por e-mail (aplicado após query para não expor dados no log de query)
      const patients = teams
        .map((t) => t.patientProfile)
        .filter((p) =>
          query.search
            ? p.user.email.toLowerCase().includes(query.search.toLowerCase())
            : true,
        );

      return reply.send({
        data: patients,
        meta: { page: query.page, limit: query.limit, total: patients.length },
      });
    },
  );

  /**
   * POST /patients
   * Médico cria perfil de paciente e estabelece vínculo clínico
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const body = CreatePatientSchema.parse(request.body);

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!doctorProfile) throw new ForbiddenError();

      // Cria usuário + perfil de paciente + vínculo em uma transação
      const result = await prisma.$transaction(async (tx) => {
        const { passwordService } = await import('../../../infrastructure/services/password.service');
        // Senha temporária — paciente deve redefinir no primeiro acesso
        const tempPasswordHash = await passwordService.hash(
          `Temp@${Math.random().toString(36).slice(2, 10)}`,
        );

        const user = await tx.user.create({
          data: {
            email: body.email,
            phone: body.phone ?? null,
            passwordHash: tempPasswordHash,
            role: 'PATIENT',
          },
        });

        const patientProfile = await tx.patientProfile.create({
          data: {
            userId: user.id,
            dateOfBirth: new Date(body.dateOfBirth),
            biologicalSex: body.biologicalSex,
            heightCm: body.heightCm ?? null,
            emergencyContact: body.emergencyContact ?? null,
          },
        });

        await tx.clinicalTeam.create({
          data: {
            doctorProfileId: doctorProfile.id,
            patientProfileId: patientProfile.id,
          },
        });

        return { userId: user.id, patientProfileId: patientProfile.id };
      });

      return reply.status(201).send({ data: result });
    },
  );

  /**
   * GET /patients/:id
   * Perfil completo do paciente — dados clínicos, biométricos e tratamento atual
   */
  fastify.get(
    '/:id',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertClinicalAccess(request.user.id, request.user.role, id);

      const patient = await prisma.patientProfile.findUnique({
        where: { id },
        include: {
          user: { select: { email: true, phone: true, createdAt: true } },
          treatments: {
            where: { status: 'ACTIVE' },
            take: 1,
            orderBy: { startDate: 'desc' },
          },
          clinicalAlerts: {
            where: { resolvedAt: null },
            orderBy: { severity: 'asc' },
            take: 5,
          },
        },
      });

      if (!patient) throw new NotFoundError('Paciente');

      return reply.send({ data: patient });
    },
  );

  /**
   * GET /patients/:id/timeline
   * Timeline completa do tratamento: check-ins, doses, alertas, consultas
   */
  fastify.get(
    '/:id/timeline',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { from, to } = request.query as { from?: string; to?: string };
      await assertClinicalAccess(request.user.id, request.user.role, id);

      const dateFilter = {
        gte: from ? new Date(from) : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        lte: to ? new Date(to) : new Date(),
      };

      const [checkins, doseLogs, alerts, appointments] = await Promise.all([
        prisma.weeklyCheckin.findMany({
          where: { patientProfileId: id, date: dateFilter },
          orderBy: { date: 'desc' },
        }),
        prisma.doseLog.findMany({
          where: { treatment: { patientProfileId: id }, scheduledDate: dateFilter },
          orderBy: { scheduledDate: 'desc' },
          take: 50,
        }),
        prisma.clinicalAlert.findMany({
          where: { patientProfileId: id, triggeredAt: dateFilter },
          orderBy: { triggeredAt: 'desc' },
        }),
        prisma.appointment.findMany({
          where: { patientProfileId: id, scheduledAt: dateFilter },
          orderBy: { scheduledAt: 'desc' },
        }),
      ]);

      return reply.send({ data: { checkins, doseLogs, alerts, appointments } });
    },
  );

  /**
   * GET /patients/:id/alerts
   * Alertas clínicos ativos do paciente
   */
  fastify.get(
    '/:id/alerts',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await assertClinicalAccess(request.user.id, request.user.role, id);

      const alerts = await prisma.clinicalAlert.findMany({
        where: { patientProfileId: id, resolvedAt: null },
        orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
      });

      return reply.send({ data: alerts });
    },
  );

  /**
   * GET /patients/:id/evolution
   * Dados de evolução clínica (peso, glicemia, etc.) para gráficos do dashboard
   */
  fastify.get(
    '/:id/evolution',
    { preHandler: auth },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { type, days } = request.query as { type?: string; days?: string };
      await assertClinicalAccess(request.user.id, request.user.role, id);

      const since = new Date(
        Date.now() - (Number(days ?? 90)) * 24 * 60 * 60 * 1000,
      );

      const biometrics = await prisma.biometricLog.findMany({
        where: {
          patientProfileId: id,
          measuredAt: { gte: since },
          ...(type ? { type: type as never } : {}),
        },
        orderBy: { measuredAt: 'asc' },
      });

      // Agrupa por tipo para facilitar renderização de gráficos
      const grouped = biometrics.reduce<Record<string, typeof biometrics>>(
        (acc, log) => {
          const key = log.type;
          acc[key] = acc[key] ?? [];
          acc[key]!.push(log);
          return acc;
        },
        {},
      );

      return reply.send({ data: grouped });
    },
  );
}
