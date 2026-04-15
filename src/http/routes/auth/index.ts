// src/http/routes/auth/index.ts
// Módulo de autenticação — 7 endpoints
// Rate limiting extra em rotas sensíveis (login, MFA)

import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { registerUseCase } from '../../../application/use-cases/auth/register.use-case';
import { loginUseCase } from '../../../application/use-cases/auth/login.use-case';
import { setupMfaUseCase, verifyMfaUseCase } from '../../../application/use-cases/auth/mfa.use-case';
import { refreshUseCase } from '../../../application/use-cases/auth/refresh.use-case';
import { logoutUseCase } from '../../../application/use-cases/auth/logout.use-case';
import { verifyCrmUseCase } from '../../../application/use-cases/auth/verify-crm.use-case';
import { Role } from '../../../domain/enums';
import { LOGIN_RATE_LIMIT, MFA_RATE_LIMIT } from '../../../shared/constants';

// ── Schemas de validação ───────────────────────────────────────────────────────

const RegisterSchema = z.discriminatedUnion('role', [
  z.object({
    role: z.literal(Role.DOCTOR),
    email: z.string().email(),
    password: z.string().min(10, 'Mínimo 10 caracteres').max(128),
    phone: z.string().optional(),
    doctor: z.object({
      crm: z.string().regex(/^\d{4,7}$/, 'CRM inválido'),
      crmState: z.string().length(2).toUpperCase(),
      specialty: z.string().min(3).max(100),
    }),
  }),
  z.object({
    role: z.literal(Role.NUTRITIONIST),
    email: z.string().email(),
    password: z.string().min(10).max(128),
    phone: z.string().optional(),
    nutritionist: z.object({
      cfn: z.string().min(3, 'CFN inválido'),
      specialty: z.string().min(3).max(100),
    }),
  }),
  z.object({
    role: z.literal(Role.PATIENT),
    email: z.string().email(),
    password: z.string().min(8).max(128),
    phone: z.string().optional(),
    patient: z.object({
      dateOfBirth: z.string().date('Data inválida'),
      biologicalSex: z.enum(['MALE', 'FEMALE', 'INTERSEX']),
      heightCm: z.number().min(50).max(250).optional(),
      lgpdConsent: z.literal(true, {
        errorMap: () => ({ message: 'Consentimento LGPD obrigatório' }),
      }),
    }),
  }),
]);

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const MfaVerifySchema = z.object({
  token: z.string().length(6, 'Código TOTP deve ter 6 dígitos'),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1),
});

const VerifyCrmSchema = z.object({
  crm: z.string().regex(/^\d{4,7}$/),
  crmState: z.string().length(2),
});

// ── Registro de rotas ──────────────────────────────────────────────────────────

export default async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /auth/register
   * Cadastro de novo usuário (médico | nutricionista | paciente)
   */
  fastify.post('/register', async (request, reply) => {
    const body = RegisterSchema.parse(request.body);

    const result = await registerUseCase({
      ...body,
      patient: body.role === Role.PATIENT && body.patient
        ? { ...body.patient, dateOfBirth: new Date(body.patient.dateOfBirth) }
        : undefined,
      ipAddress: request.ip,
    });

    return reply.status(201).send({
      message: 'Cadastro realizado com sucesso.',
      data: result,
    });
  });

  /**
   * POST /auth/login
   * Autenticação com e-mail e senha
   * Rate limit reforçado: 5 tentativas por minuto
   */
  fastify.post(
    '/login',
    { config: { rateLimit: LOGIN_RATE_LIMIT } },
    async (request, reply) => {
      const body = LoginSchema.parse(request.body);

      const result = await loginUseCase(fastify, {
        ...body,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({ data: result });
    },
  );

  /**
   * POST /auth/mfa/setup
   * Inicia configuração do TOTP — retorna URL para QR Code
   * Requer autenticação mas não exige MFA (pois é o setup)
   */
  fastify.post(
    '/mfa/setup',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const result = await setupMfaUseCase(request.user.id);
      return reply.send({ data: result });
    },
  );

  /**
   * POST /auth/mfa/verify
   * Verifica código TOTP — ativa MFA no primeiro uso, valida nos seguintes
   * Rate limit reforçado: 5 tentativas por 5 minutos
   */
  fastify.post(
    '/mfa/verify',
    {
      preHandler: [fastify.authenticate],
      config: { rateLimit: MFA_RATE_LIMIT },
    },
    async (request, reply) => {
      const { token } = MfaVerifySchema.parse(request.body);

      await verifyMfaUseCase({
        userId: request.user.id,
        token,
        ipAddress: request.ip,
      });

      return reply.send({ message: 'MFA verificado com sucesso.' });
    },
  );

  /**
   * POST /auth/refresh
   * Renova o par de tokens usando o refresh token
   */
  fastify.post('/refresh', async (request, reply) => {
    const { refreshToken } = RefreshSchema.parse(request.body);
    const result = await refreshUseCase(fastify, refreshToken);
    return reply.send({ data: result });
  });

  /**
   * POST /auth/logout
   * Revoga a sessão atual — invalida o token no banco
   */
  fastify.post(
    '/logout',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      await logoutUseCase({
        userId: request.user.id,
        sessionId: request.user.sessionId,
        email: request.user.email,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
      });

      return reply.send({ message: 'Sessão encerrada com sucesso.' });
    },
  );

  /**
   * POST /auth/verify-crm
   * Verifica CRM via API do CFM — exclusivo para médicos
   */
  fastify.post(
    '/verify-crm',
    {
      preHandler: [
        fastify.authenticate,
        fastify.requireRole(Role.DOCTOR),
      ],
    },
    async (request, reply) => {
      const body = VerifyCrmSchema.parse(request.body);

      const { prisma } = await import('../../../infrastructure/database/prisma.client');
      const doctorProfile = await prisma.doctorProfile.findUnique({
        where: { userId: request.user.id },
        select: { id: true },
      });

      if (!doctorProfile) {
        return reply.status(404).send({ message: 'Perfil médico não encontrado.' });
      }

      const result = await verifyCrmUseCase({
        doctorProfileId: doctorProfile.id,
        crm: body.crm,
        crmState: body.crmState,
      });

      return reply.send({ data: result });
    },
  );
}
