// src/http/routes/appointments/index.ts
// Agendamento de consultas e registro de conduta pós-consulta

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';
import { ForbiddenError, NotFoundError } from '../../errors/handler';
import { Role, AppointmentType, AppointmentStatus } from '../../../domain/enums';

const CreateAppointmentSchema = z.object({
  patientProfileId: z.string().cuid(),
  scheduledAt: z.string().datetime(),
  type: z.nativeEnum(AppointmentType),
  notes: z.string().max(1000).optional(),
  teleconsultUrl: z.string().url().optional(),
});

const ConsultationRecordSchema = z.object({
  weightKg: z.number().positive().optional(),
  bloodPressure: z
    .object({ systolic: z.number().int(), diastolic: z.number().int() })
    .optional(),
  symptoms: z.array(z.string()).default([]),
  diagnosis: z
    .array(z.object({ cid: z.string(), description: z.string() }))
    .default([]),
  prescriptionChanges: z.record(z.unknown()).optional(),
  labResults: z.record(z.unknown()).optional(),
  nextAppointmentDate: z.string().date().optional(),
});

const AppointmentQuerySchema = z.object({
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  status: z.nativeEnum(AppointmentStatus).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export default async function appointmentsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /appointments
   * Médico agenda consulta para paciente vinculado
   */
  fastify.post(
    '/',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const body = CreateAppointmentSchema.parse(request.body);

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (!doctorProfile) throw new ForbiddenError();

      const team = await prisma.clinicalTeam.findFirst({
        where: {
          doctorProfileId: doctorProfile.id,
          patientProfileId: body.patientProfileId,
          status: 'ACTIVE',
        },
      });
      if (!team) throw new ForbiddenError('Sem vínculo clínico ativo com este paciente.');

      const appointment = await prisma.appointment.create({
        data: {
          patientProfileId: body.patientProfileId,
          doctorProfileId: doctorProfile.id,
          scheduledAt: new Date(body.scheduledAt),
          type: body.type,
          notes: body.notes ?? null,
          teleconsultUrl: body.teleconsultUrl ?? null,
        },
      });

      return reply.status(201).send({ data: appointment });
    },
  );

  /**
   * GET /appointments
   * Agenda do médico ou paciente autenticado
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate, fastify.requireMfa] },
    async (request, reply) => {
      const query = AppointmentQuerySchema.parse(request.query);

      let profileFilter: { doctorProfileId?: string; patientProfileId?: string } = {};

      if (request.user.role === Role.DOCTOR) {
        const profile = await prisma.doctorProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });
        profileFilter = { doctorProfileId: profile?.id };
      } else if (request.user.role === Role.PATIENT) {
        const profile = await prisma.patientProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });
        profileFilter = { patientProfileId: profile?.id };
      }

      const appointments = await prisma.appointment.findMany({
        where: {
          ...profileFilter,
          ...(query.status ? { status: query.status } : {}),
          scheduledAt: {
            ...(query.from ? { gte: new Date(query.from) } : {}),
            ...(query.to ? { lte: new Date(query.to) } : {}),
          },
        },
        orderBy: { scheduledAt: 'asc' },
        take: query.limit,
        skip: query.offset,
      });

      return reply.send({ data: appointments });
    },
  );

  /**
   * POST /appointments/:id/record
   * Médico registra conduta clínica após a consulta (prontuário)
   * Acesso auditado — dado médico sigiloso
   */
  fastify.post(
    '/:id/record',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = ConsultationRecordSchema.parse(request.body);

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        select: { id: true, doctorProfileId: true, patientProfileId: true, status: true },
      });
      if (!appointment) throw new NotFoundError('Consulta');

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== appointment.doctorProfileId) throw new ForbiddenError();

      const [record] = await prisma.$transaction([
        prisma.consultationRecord.create({
          data: {
            appointmentId: id,
            doctorProfileId: appointment.doctorProfileId,
            patientProfileId: appointment.patientProfileId,
            weightKg: body.weightKg ?? null,
            bloodPressure: body.bloodPressure ?? null,
            symptoms: body.symptoms,
            diagnosis: body.diagnosis,
            prescriptionChanges: body.prescriptionChanges ?? null,
            labResults: body.labResults ?? null,
            nextAppointmentDate: body.nextAppointmentDate
              ? new Date(body.nextAppointmentDate)
              : null,
          },
        }),
        prisma.appointment.update({
          where: { id },
          data: { status: AppointmentStatus.COMPLETED },
        }),
      ]);

      return reply.status(201).send({ data: record });
    },
  );

  /**
   * GET /appointments/:id/pre-report
   * Relatório pré-consulta automático: últimos check-ins, biométricas, doses, alertas
   */
  fastify.get(
    '/:id/pre-report',
    { preHandler: [fastify.authenticate, fastify.requireRole(Role.DOCTOR), fastify.requireMfa] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const appointment = await prisma.appointment.findUnique({
        where: { id },
        select: { patientProfileId: true, doctorProfileId: true, scheduledAt: true },
      });
      if (!appointment) throw new NotFoundError('Consulta');

      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });
      if (doctorProfile?.id !== appointment.doctorProfileId) throw new ForbiddenError();

      const since = new Date(appointment.scheduledAt.getTime() - 30 * 24 * 60 * 60 * 1000);
      const patId = appointment.patientProfileId;

      const [checkins, biometrics, doseLogs, alerts, lastRecord] = await Promise.all([
        prisma.weeklyCheckin.findMany({
          where: { patientProfileId: patId, date: { gte: since } },
          orderBy: { date: 'desc' },
          take: 5,
        }),
        prisma.biometricLog.findMany({
          where: { patientProfileId: patId, measuredAt: { gte: since } },
          orderBy: { measuredAt: 'desc' },
          take: 20,
        }),
        prisma.doseLog.findMany({
          where: {
            treatment: { patientProfileId: patId },
            scheduledDate: { gte: since },
          },
          orderBy: { scheduledDate: 'desc' },
          take: 10,
        }),
        prisma.clinicalAlert.findMany({
          where: { patientProfileId: patId, resolvedAt: null },
          orderBy: { severity: 'desc' },
          take: 5,
        }),
        prisma.consultationRecord.findFirst({
          where: { patientProfileId: patId },
          orderBy: { createdAt: 'desc' },
        }),
      ]);

      return reply.send({
        data: { checkins, biometrics, doseLogs, alerts, lastConsultation: lastRecord },
      });
    },
  );
}
