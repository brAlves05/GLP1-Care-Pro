// Testes de integração: servidor real (rotas, plugins, rate limit) com banco simulado.
// Cada caso reproduz um vazamento encontrado na auditoria de segurança.

import { FastifyInstance } from 'fastify';
import { buildServer } from './server';
import { TokenService } from '../infrastructure/services/token.service';
import { passwordService } from '../infrastructure/services/password.service';
import { Role } from '../domain/enums';

jest.mock('../infrastructure/database/prisma.client', () => {
  const fns: Record<string, jest.Mock> = {};
  const prisma = new Proxy(
    {},
    {
      get: (_t, model: string) =>
        new Proxy(
          {},
          { get: (_u, method: string) => (fns[`${model}.${method}`] ??= jest.fn(async () => null)) },
        ),
    },
  );
  return { prisma, mockFns: fns };
});

const { mockFns } = jest.requireMock('../infrastructure/database/prisma.client') as {
  mockFns: Record<string, jest.Mock>;
};
const { prisma } = jest.requireMock('../infrastructure/database/prisma.client') as {
  prisma: Record<string, Record<string, jest.Mock>>;
};
const db = (key: string): jest.Mock => {
  const [model, method] = key.split('.') as [string, string];
  return prisma[model]![method]!;
};

process.env['JWT_SECRET'] = 'segredo-de-teste-com-mais-de-32-caracteres';
process.env['ENCRYPTION_MASTER_KEY'] = 'ab'.repeat(32);

let app: FastifyInstance;
let tokens: TokenService;

beforeAll(async () => {
  app = await buildServer();
  await app.ready();
  tokens = new TokenService(app);
});
afterAll(() => app.close());

beforeEach(() => {
  for (const fn of Object.values(mockFns)) {
    fn.mockReset();
    fn.mockImplementation(async () => null);
  }
  // Sessão válida com MFA concluído
  db('userSession.findUnique').mockResolvedValue({
    userId: 'user_1',
    revokedAt: null,
    expiresAt: new Date(Date.now() + 60_000),
    mfaVerifiedAt: new Date(),
  });
});

function as(role: Role): Record<string, string> {
  const { accessToken } = tokens.generateTokenPair({
    userId: 'user_1',
    email: 'u@x.com',
    role,
    sessionId: 'sess_1',
  });
  return { authorization: `Bearer ${accessToken}` };
}

const nutritionist = () => db('nutritionistProfile.findUnique').mockResolvedValue({ id: 'nut_1' });
const doctor = () => db('doctorProfile.findUnique').mockResolvedValue({ id: 'doc_1' });
const patient = () => db('patientProfile.findUnique').mockResolvedValue({ id: 'pat_1' });

describe('isolamento de dados clínicos', () => {
  it('GET /alerts: nutricionista vê só alertas de pacientes vinculados', async () => {
    nutritionist();
    db('clinicalAlert.findMany').mockResolvedValue([]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: as(Role.NUTRITIONIST) });

    expect(res.statusCode).toBe(200);
    expect(db('clinicalAlert.findMany').mock.calls[0][0].where).toMatchObject({
      patientProfile: { clinicalTeams: { some: { nutritionistProfileId: 'nut_1', status: 'ACTIVE' } } },
    });
  });

  it('GET /alerts: médico sem perfil é negado (antes recebia todos os alertas)', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/alerts', headers: as(Role.DOCTOR) });
    expect(res.statusCode).toBe(403);
    expect(db('clinicalAlert.findMany')).not.toHaveBeenCalled();
  });

  it('PATCH /alerts/:id/ack: nutricionista não altera alertas', async () => {
    nutritionist();
    const res = await app.inject({ method: 'PATCH', url: '/api/v1/alerts/alert_1/ack', headers: as(Role.NUTRITIONIST) });
    expect(res.statusCode).toBe(403);
  });

  it.each([
    [Role.NUTRITIONIST, nutritionist, { patientProfile: { clinicalTeams: { some: { nutritionistProfileId: 'nut_1', status: 'ACTIVE' } } } }],
    [Role.PATIENT, patient, { patientProfile: { id: 'pat_1' } }],
    [Role.DOCTOR, doctor, { doctorProfileId: 'doc_1' }],
  ])('GET /appointments: %s recebe filtro obrigatório', async (role, setup, expected) => {
    setup();
    db('appointment.findMany').mockResolvedValue([]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/appointments', headers: as(role) });

    expect(res.statusCode).toBe(200);
    expect(db('appointment.findMany').mock.calls[0][0].where).toMatchObject(expected);
  });

  it('GET /treatments/:id: médico sem vínculo com o paciente é negado', async () => {
    doctor();
    db('treatment.findUnique').mockResolvedValue({ patientProfileId: 'pat_9' });
    db('clinicalTeam.findFirst').mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/v1/treatments/trt_1', headers: as(Role.DOCTOR) });

    expect(res.statusCode).toBe(403);
    expect(db('treatment.findUnique')).toHaveBeenCalledTimes(1); // só a checagem de dono
  });

  it('GET /treatments/:id/protocol: paciente não lê protocolo de outro paciente', async () => {
    patient();
    db('treatment.findUnique').mockResolvedValue({ patientProfileId: 'pat_9' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/treatments/trt_1/protocol', headers: as(Role.PATIENT) });

    expect(res.statusCode).toBe(403);
    expect(db('doseProtocol.findMany')).not.toHaveBeenCalled();
  });

  it('GET /nutrition/plans/:id: nutricionista sem vínculo é negado', async () => {
    nutritionist();
    db('nutritionalPlan.findUnique').mockResolvedValue({ id: 'plan_1', patientProfileId: 'pat_9' });

    const res = await app.inject({ method: 'GET', url: '/api/v1/nutrition/plans/plan_1', headers: as(Role.NUTRITIONIST) });

    expect(res.statusCode).toBe(403);
  });

  it('PATCH /notifications/:id/read: médico não marca alerta de outro médico', async () => {
    doctor();
    db('clinicalAlert.count').mockResolvedValue(0);

    const res = await app.inject({ method: 'PATCH', url: '/api/v1/notifications/alert_1/read', headers: as(Role.DOCTOR) });

    expect(res.statusCode).toBe(404);
    expect(db('clinicalAlert.count').mock.calls[0][0].where).toEqual({ id: 'alert_1', doctorProfileId: 'doc_1' });
    expect(db('clinicalAlert.updateMany')).not.toHaveBeenCalled();
  });

  it('GET /notifications: médico só recebe alertas de pacientes com vínculo ativo', async () => {
    doctor();
    db('clinicalAlert.findMany').mockResolvedValue([]);

    const res = await app.inject({ method: 'GET', url: '/api/v1/notifications', headers: as(Role.DOCTOR) });

    expect(res.statusCode).toBe(200);
    expect(db('clinicalAlert.findMany').mock.calls[0][0].where).toMatchObject({
      doctorProfileId: 'doc_1',
      patientProfile: { clinicalTeams: { some: { doctorProfileId: 'doc_1', status: 'ACTIVE' } } },
    });
  });

  it('POST /messages: sem vínculo clínico com o destinatário é negado', async () => {
    db('user.findUnique').mockResolvedValue({ id: 'cl0000000000000000000000x' });
    db('clinicalTeam.findFirst').mockResolvedValue(null);

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/messages',
      headers: as(Role.PATIENT),
      payload: { receiverId: 'cl0000000000000000000000x', content: 'Y2lwaGVydGV4dA==' },
    });

    expect(res.statusCode).toBe(403);
    expect(db('message.create')).not.toHaveBeenCalled();
  });
});

describe('vínculo ativo também nas escritas e relatórios', () => {
  it('PATCH /treatments/:id/dose: médico prescritor sem vínculo ativo é negado', async () => {
    doctor();
    db('treatment.findUnique').mockResolvedValue({
      id: 'trt_1', status: 'ACTIVE', doctorProfileId: 'doc_1', patientProfileId: 'pat_9', currentDose: 1, unit: 'mg',
    });
    db('clinicalTeam.findFirst').mockResolvedValue(null);

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/treatments/trt_1/dose',
      headers: as(Role.DOCTOR),
      payload: { newDose: 2, reason: 'Escalonamento programado do protocolo' },
    });

    expect(res.statusCode).toBe(403);
    expect(db('treatment.update')).not.toHaveBeenCalled();
  });

  it('GET /appointments/:id/pre-report: médico sem vínculo ativo é negado', async () => {
    doctor();
    db('appointment.findUnique').mockResolvedValue({
      patientProfileId: 'pat_9', doctorProfileId: 'doc_1', scheduledAt: new Date(),
    });
    db('clinicalTeam.findFirst').mockResolvedValue(null);

    const res = await app.inject({ method: 'GET', url: '/api/v1/appointments/appt_1/pre-report', headers: as(Role.DOCTOR) });

    expect(res.statusCode).toBe(403);
    expect(db('weeklyCheckin.findMany')).not.toHaveBeenCalled();
  });

  it('PATCH /alerts/:id/resolve: alerta já resolvido de outro médico não é exposto', async () => {
    doctor();
    db('clinicalAlert.findUnique').mockResolvedValue({ id: 'alert_1', doctorProfileId: 'doc_2', resolvedAt: new Date() });

    const res = await app.inject({
      method: 'PATCH',
      url: '/api/v1/alerts/alert_1/resolve',
      headers: as(Role.DOCTOR),
      payload: { resolutionNotes: 'Conduta registrada pelo médico' },
    });

    expect(res.statusCode).toBe(403);
  });
});

describe('rate limit do login', () => {
  const login = (ip: string, email: string, forwardedFor?: string) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      remoteAddress: ip,
      headers: forwardedFor ? { 'x-forwarded-for': forwardedFor } : {},
      payload: { email, password: 'tentativa' },
    });

  it('limita por IP mesmo trocando de conta e forjando X-Forwarded-For', async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) {
      statuses.push((await login('10.0.0.1', `conta${i}@x.com`, `203.0.113.${i}`)).statusCode);
    }
    expect(statuses.slice(0, 5)).toEqual([401, 401, 401, 401, 401]);
    expect(statuses[5]).toBe(429);
  });

  it('limita por conta mesmo trocando de IP (ataque distribuído)', async () => {
    const statuses: number[] = [];
    for (let i = 1; i <= 21; i++) {
      statuses.push((await login(`10.2.${i}.1`, 'Alvo@Clinica.com')).statusCode);
    }
    expect(statuses.slice(0, 20).every((st) => st === 401)).toBe(true);
    expect(statuses[20]).toBe(429);
  });

  it('logins bem-sucedidos não consomem a cota da conta', async () => {
    const hash = await passwordService.hash('senha-correta-123');
    db('user.findUnique').mockResolvedValue({
      id: 'user_1', email: 'paciente@x.com', role: 'PATIENT', passwordHash: hash, mfaEnabled: false,
    });
    db('userSession.create').mockResolvedValue({ id: 'sess_1' });

    const statuses: number[] = [];
    for (let i = 1; i <= 22; i++) {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        remoteAddress: `10.3.${i}.1`,
        payload: { email: 'paciente@x.com', password: 'senha-correta-123' },
      });
      statuses.push(res.statusCode);
    }
    expect(statuses.every((st) => st === 200)).toBe(true);
  });
});

describe('rate limit do MFA', () => {
  it('limita por usuário: trocar de IP não permite mais tentativas de código', async () => {
    const headers = as(Role.DOCTOR);
    const attempt = (i: number) =>
      app.inject({
        method: 'POST',
        url: '/api/v1/auth/mfa/verify',
        remoteAddress: `10.1.0.${i}`,
        headers,
        payload: { token: '000000' },
      });

    const statuses: number[] = [];
    for (let i = 1; i <= 6; i++) statuses.push((await attempt(i)).statusCode);

    expect(statuses.slice(0, 5).every((s) => s !== 429)).toBe(true);
    expect(statuses[5]).toBe(429);
  });
});
