// src/http/routes/notifications/index.ts
// Central de notificações — listagem, leitura e preferências
// Notificações são geradas internamente por alertas, doses, consultas

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../../../infrastructure/database/prisma.client';

/**
 * Notificações são derivadas de alertas clínicos + outros eventos.
 * Esta implementação usa ClinicalAlert como fonte de notificações para profissionais
 * e um modelo simplificado baseado em audit/eventos para pacientes.
 * Em produção: adicionar tabela Notification dedicada com push tokens (FCM/APNs).
 */

const NotificationQuerySchema = z.object({
  read: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

const PreferencesSchema = z.object({
  doseReminders: z.boolean().default(true),
  weeklyCheckinReminder: z.boolean().default(true),
  appointmentReminders: z.boolean().default(true),
  alertNotifications: z.boolean().default(true),
  /** Canal de notificação */
  channels: z.object({
    push: z.boolean().default(true),
    email: z.boolean().default(true),
    sms: z.boolean().default(false),
  }).default({}),
  /** Horário de preferência para lembretes (formato HH:mm) */
  preferredReminderTime: z.string().regex(/^\d{2}:\d{2}$/).default('08:00'),
});

export default async function notificationsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /notifications
   * Lista notificações do usuário autenticado
   * Para profissionais: alertas clínicos não reconhecidos
   * Para pacientes: doses pendentes, check-ins, lembretes
   */
  fastify.get(
    '/',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const query = NotificationQuerySchema.parse(request.query);

      // Para médicos: alertas clínicos não resolvidos = notificações
      if (request.user.role === 'DOCTOR') {
        const doctorProfile = await prisma.doctorProfile.findUnique({
          where: { userId: request.user.id },
          select: { id: true },
        });

        const alerts = doctorProfile
          ? await prisma.clinicalAlert.findMany({
              where: {
                doctorProfileId: doctorProfile.id,
                resolvedAt: null,
                ...(query.read === true
                  ? { acknowledgedAt: { not: null } }
                  : query.read === false
                  ? { acknowledgedAt: null }
                  : {}),
              },
              orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
              take: query.limit,
              skip: query.offset,
            })
          : [];

        return reply.send({
          data: alerts.map((a) => ({
            id: a.id,
            type: 'CLINICAL_ALERT',
            title: `Alerta ${a.severity}: ${a.type}`,
            body: a.message,
            read: a.acknowledgedAt !== null,
            createdAt: a.triggeredAt,
            metadata: { severity: a.severity, patientProfileId: a.patientProfileId },
          })),
        });
      }

      // Para pacientes: doses pendentes + check-in semanal
      const patientProfile = await prisma.patientProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      if (!patientProfile) return reply.send({ data: [] });

      const [pendingDoses, lastCheckin] = await Promise.all([
        prisma.doseLog.findMany({
          where: {
            treatment: { patientProfileId: patientProfile.id },
            confirmed: false,
            scheduledDate: { lte: new Date() },
          },
          orderBy: { scheduledDate: 'asc' },
          take: 5,
        }),
        prisma.weeklyCheckin.findFirst({
          where: { patientProfileId: patientProfile.id },
          orderBy: { date: 'desc' },
          select: { date: true },
        }),
      ]);

      const notifications = [];

      // Notificação de dose atrasada
      for (const dose of pendingDoses) {
        notifications.push({
          id: `dose-${dose.id}`,
          type: 'DOSE_REMINDER',
          title: 'Dose pendente',
          body: `Você tem uma dose agendada para ${dose.scheduledDate.toLocaleDateString('pt-BR')} não confirmada.`,
          read: false,
          createdAt: dose.scheduledDate,
        });
      }

      // Notificação de check-in semanal (se não fez nos últimos 7 dias)
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      if (!lastCheckin || lastCheckin.date < sevenDaysAgo) {
        notifications.push({
          id: 'weekly-checkin',
          type: 'CHECKIN_REMINDER',
          title: 'Check-in semanal',
          body: 'Não esqueça de registrar seus sintomas e peso desta semana.',
          read: false,
          createdAt: new Date(),
        });
      }

      return reply.send({ data: notifications.slice(query.offset, query.offset + query.limit) });
    },
  );

  /**
   * PATCH /notifications/:id/read
   * Marca notificação como lida (para alertas clínicos: registra acknowledgedAt)
   */
  fastify.patch(
    '/:id/read',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      // Para médicos: ack do alerta clínico
      if (request.user.role === 'DOCTOR') {
        const alert = await prisma.clinicalAlert.findUnique({
          where: { id },
          select: { id: true, acknowledgedAt: true },
        });

        if (alert && !alert.acknowledgedAt) {
          await prisma.clinicalAlert.update({
            where: { id },
            data: { acknowledgedAt: new Date() },
          });
        }
      }

      // Para pacientes: notificações derivadas são efêmeras (sem persistência de leitura)
      return reply.send({ message: 'Notificação marcada como lida.' });
    },
  );

  /**
   * POST /notifications/preferences
   * Salva preferências de notificação do usuário
   */
  fastify.post(
    '/preferences',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const prefs = PreferencesSchema.parse(request.body);

      // Persiste nas preferências do usuário (metadata no AuditLog por ora)
      // Em produção: tabela UserPreferences dedicada
      await prisma.auditLog.create({
        data: {
          userId: request.user.id,
          action: 'UPDATE_NOTIFICATION_PREFERENCES',
          resource: 'NotificationPreferences',
          metadata: prefs,
          ipAddress: request.ip,
        },
      });

      return reply.send({
        message: 'Preferências de notificação atualizadas.',
        data: prefs,
      });
    },
  );
}
