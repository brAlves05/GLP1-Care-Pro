// src/shared/types/fastify.d.ts
// Extensão dos tipos do Fastify para injeção do usuário autenticado na requisição

import '@fastify/jwt';
import { Role } from '../../domain/enums';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload | RefreshTokenPayload;
    user: AuthenticatedUser;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuário autenticado — disponível após o hook authenticate */
    user: AuthenticatedUser;
  }

  interface FastifyContextConfig {
    /**
     * Permite acesso de profissional cuja sessão ainda não passou pelo TOTP.
     * Somente para as rotas do próprio fluxo de MFA e logout.
     */
    allowPendingMfa?: boolean;
  }
}

/** Payload codificado no access token JWT */
export interface JwtPayload {
  sub: string;        // User.id
  email: string;
  role: Role;
  sessionId: string;  // UserSession.id — para revogação
  type: 'access';
  iat?: number;
  exp?: number;
}

/** Usuário autenticado injetado na requisição */
export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
  sessionId: string;
}

/** Payload do refresh token — escopo limitado, nunca aceito como access token */
export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}
