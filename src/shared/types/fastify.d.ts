// src/shared/types/fastify.d.ts
// Extensão dos tipos do Fastify para injeção do usuário autenticado na requisição

import '@fastify/jwt';
import { Role } from '../../domain/enums';

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JwtPayload;
    user: AuthenticatedUser;
  }
}

declare module 'fastify' {
  interface FastifyRequest {
    /** Usuário autenticado — disponível após o hook authenticate */
    user: AuthenticatedUser;
  }
}

/** Payload codificado no access token JWT */
export interface JwtPayload {
  sub: string;        // User.id
  email: string;
  role: Role;
  sessionId: string;  // UserSession.id — para revogação
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

/** Payload do refresh token — escopo limitado */
export interface RefreshTokenPayload {
  sub: string;
  sessionId: string;
  type: 'refresh';
}
