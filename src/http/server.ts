// src/http/server.ts
// Configuração central do Fastify — plugins, hooks e registro de rotas

import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import fastifyRateLimit from '@fastify/rate-limit';
import fp from 'fastify-plugin';

import { errorHandler } from './errors/handler';
import authenticatePlugin from './plugins/authenticate';
import auditPlugin from './plugins/audit';

// Módulos de rotas
import authRoutes from './routes/auth';
import patientsRoutes from './routes/patients';
import treatmentsRoutes from './routes/treatments';
import doseLogsRoutes from './routes/dose-logs';
import checkinsRoutes from './routes/checkins';
import biometricsRoutes from './routes/biometrics';
import alertsRoutes from './routes/alerts';
import appointmentsRoutes from './routes/appointments';
import nutritionRoutes from './routes/nutrition';
import messagesRoutes from './routes/messages';
import aiTriageRoutes from './routes/ai-triage';
import notificationsRoutes from './routes/notifications';

export async function buildServer(): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: {
      level: process.env['NODE_ENV'] === 'production' ? 'warn' : 'info',
      // Serializer que remove campos sensíveis dos logs
      serializers: {
        req(request) {
          return {
            method: request.method,
            url: request.url,
            // Nunca logar body, query params ou headers de autenticação
          };
        },
      },
    },
    // Proteção contra DoS com payloads gigantes
    bodyLimit: 1_048_576, // 1 MiB
    trustProxy: true,
  });

  // ── Segurança ──────────────────────────────────────────────────────────────
  await fastify.register(fastifyHelmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
      },
    },
  });

  await fastify.register(fastifyCors, {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3001'],
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    credentials: true,
  });

  // Rate limiting global — proteção contra DDoS e força bruta
  await fastify.register(fastifyRateLimit, {
    global: true,
    max: Number(process.env['RATE_LIMIT_MAX'] ?? 100),
    timeWindow: Number(process.env['RATE_LIMIT_WINDOW_MS'] ?? 60_000),
    errorResponseBuilder: () => ({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Muitas requisições. Tente novamente em alguns segundos.',
    }),
  });

  // ── Autenticação JWT ───────────────────────────────────────────────────────
  await fastify.register(fastifyJwt, {
    secret: process.env['JWT_SECRET'] ?? 'REPLACE_IN_PRODUCTION',
    sign: { expiresIn: '15m' },
  });

  // ── Plugins customizados ───────────────────────────────────────────────────
  await fastify.register(fp(authenticatePlugin));
  await fastify.register(fp(auditPlugin));

  // ── Handler global de erros ────────────────────────────────────────────────
  fastify.setErrorHandler(errorHandler);

  // ── Health check (sem autenticação) ───────────────────────────────────────
  fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ── Registro de rotas com prefixo /api/v1 ─────────────────────────────────
  const API_PREFIX = '/api/v1';

  await fastify.register(authRoutes,          { prefix: `${API_PREFIX}/auth` });
  await fastify.register(patientsRoutes,      { prefix: `${API_PREFIX}/patients` });
  await fastify.register(treatmentsRoutes,    { prefix: `${API_PREFIX}/treatments` });
  await fastify.register(doseLogsRoutes,      { prefix: `${API_PREFIX}/dose-logs` });
  await fastify.register(checkinsRoutes,      { prefix: `${API_PREFIX}/checkins` });
  await fastify.register(biometricsRoutes,    { prefix: `${API_PREFIX}/biometrics` });
  await fastify.register(alertsRoutes,        { prefix: `${API_PREFIX}/alerts` });
  await fastify.register(appointmentsRoutes,  { prefix: `${API_PREFIX}/appointments` });
  await fastify.register(nutritionRoutes,     { prefix: `${API_PREFIX}/nutrition` });
  await fastify.register(messagesRoutes,      { prefix: `${API_PREFIX}/messages` });
  await fastify.register(aiTriageRoutes,      { prefix: `${API_PREFIX}/ai` });
  await fastify.register(notificationsRoutes, { prefix: `${API_PREFIX}/notifications` });

  return fastify;
}
