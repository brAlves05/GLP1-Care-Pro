import Fastify, { FastifyInstance } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import authenticatePlugin from './authenticate';
import { errorHandler } from '../errors/handler';
import { TokenService } from '../../infrastructure/services/token.service';
import { prisma } from '../../infrastructure/database/prisma.client';
import { Role } from '../../domain/enums';

jest.mock('../../infrastructure/database/prisma.client', () => ({
  prisma: { userSession: { findUnique: jest.fn() } },
}));

const findSession = prisma.userSession.findUnique as unknown as jest.Mock;
const SECRET = 'segredo-de-teste-com-mais-de-32-caracteres';

async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify();
  await app.register(fastifyJwt, {
    secret: SECRET,
    sign: { algorithm: 'HS256' },
    verify: { algorithms: ['HS256'] },
  });
  await app.register(authenticatePlugin);
  app.setErrorHandler(errorHandler);
  app.get('/clinico', { preHandler: [app.authenticate] }, async (req) => ({ user: req.user }));
  app.get(
    '/mfa',
    { preHandler: [app.authenticate], config: { allowPendingMfa: true } },
    async () => ({ ok: true }),
  );
  await app.ready();
  return app;
}

function sessionRow(overrides: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    userId: 'user_1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerifiedAt: null,
    ...overrides,
  };
}

describe('authenticate', () => {
  let app: FastifyInstance;
  let tokens: TokenService;

  beforeAll(async () => {
    app = await buildApp();
    tokens = new TokenService(app);
  });
  afterAll(() => app.close());
  beforeEach(() => findSession.mockReset());

  const pairFor = (role: Role) =>
    tokens.generateTokenPair({ userId: 'user_1', email: 'u@x.com', role, sessionId: 'sess_1' });

  const get = (url: string, token: string) =>
    app.inject({ method: 'GET', url, headers: { authorization: `Bearer ${token}` } });

  it('aceita access token de paciente com sessão válida', async () => {
    findSession.mockResolvedValue(sessionRow());
    const res = await get('/clinico', pairFor(Role.PATIENT).accessToken);
    expect(res.statusCode).toBe(200);
    expect(res.json().user).toEqual({ id: 'user_1', email: 'u@x.com', role: 'PATIENT', sessionId: 'sess_1' });
  });

  it('recusa refresh token usado como access token', async () => {
    findSession.mockResolvedValue(sessionRow());
    const res = await get('/clinico', pairFor(Role.PATIENT).refreshToken);
    expect(res.statusCode).toBe(401);
    expect(findSession).not.toHaveBeenCalled();
  });

  it('recusa token assinado com outro segredo', async () => {
    const other = Fastify();
    await other.register(fastifyJwt, { secret: 'outro-segredo-qualquer-com-32-chars!!' });
    await other.ready();
    const forged = new TokenService(other).generateTokenPair({
      userId: 'user_1', email: 'u@x.com', role: Role.DOCTOR, sessionId: 'sess_1',
    }).accessToken;
    await other.close();

    const res = await get('/clinico', forged);
    expect(res.statusCode).toBe(401);
  });

  it('recusa requisição sem token com 401 (não 500)', async () => {
    const res = await app.inject({ method: 'GET', url: '/clinico' });
    expect(res.statusCode).toBe(401);
  });

  it('recusa sessão revogada', async () => {
    findSession.mockResolvedValue(sessionRow({ revokedAt: new Date() }));
    const res = await get('/clinico', pairFor(Role.PATIENT).accessToken);
    expect(res.statusCode).toBe(401);
  });

  it('recusa sessão expirada', async () => {
    findSession.mockResolvedValue(sessionRow({ expiresAt: new Date(Date.now() - 1000) }));
    const res = await get('/clinico', pairFor(Role.PATIENT).accessToken);
    expect(res.statusCode).toBe(401);
  });

  it('recusa sessão que pertence a outro usuário', async () => {
    findSession.mockResolvedValue(sessionRow({ userId: 'user_2' }));
    const res = await get('/clinico', pairFor(Role.PATIENT).accessToken);
    expect(res.statusCode).toBe(401);
  });

  it.each([Role.DOCTOR, Role.NUTRITIONIST])(
    'bloqueia %s com MFA pendente em rota clínica',
    async (role) => {
      findSession.mockResolvedValue(sessionRow());
      const res = await get('/clinico', pairFor(role).accessToken);
      expect(res.statusCode).toBe(403);
      expect(res.json().code).toBe('MFA_REQUIRED');
    },
  );

  it('permite profissional com MFA pendente nas rotas do fluxo de MFA', async () => {
    findSession.mockResolvedValue(sessionRow());
    const res = await get('/mfa', pairFor(Role.DOCTOR).accessToken);
    expect(res.statusCode).toBe(200);
  });

  it('libera profissional após validar o TOTP nesta sessão', async () => {
    findSession.mockResolvedValue(sessionRow({ mfaVerifiedAt: new Date() }));
    const res = await get('/clinico', pairFor(Role.DOCTOR).accessToken);
    expect(res.statusCode).toBe(200);
  });
});
