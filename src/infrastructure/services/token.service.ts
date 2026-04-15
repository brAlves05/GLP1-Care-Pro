// src/infrastructure/services/token.service.ts
// Geração e validação de JWT (access + refresh tokens)
// Access token: 15 min | Refresh token: 7 dias

import { FastifyInstance } from 'fastify';
import * as crypto from 'crypto';
import { Role } from '../../domain/enums';
import { JwtPayload, RefreshTokenPayload } from '../../shared/types/fastify';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // segundos até expirar o access token
}

export class TokenService {
  constructor(private readonly fastify: FastifyInstance) {}

  /** Gera par de tokens (access + refresh) para a sessão */
  generateTokenPair(payload: {
    userId: string;
    email: string;
    role: Role;
    sessionId: string;
  }): TokenPair {
    const accessPayload: JwtPayload = {
      sub: payload.userId,
      email: payload.email,
      role: payload.role,
      sessionId: payload.sessionId,
    };

    const refreshPayload: RefreshTokenPayload = {
      sub: payload.userId,
      sessionId: payload.sessionId,
      type: 'refresh',
    };

    const accessToken = this.fastify.jwt.sign(accessPayload, {
      expiresIn: '15m',
    });

    const refreshToken = this.fastify.jwt.sign(refreshPayload, {
      expiresIn: '7d',
    });

    return { accessToken, refreshToken, expiresIn: 900 };
  }

  /** Verifica e decodifica um refresh token */
  verifyRefreshToken(token: string): RefreshTokenPayload {
    const decoded = this.fastify.jwt.verify<RefreshTokenPayload>(token);
    if (decoded.type !== 'refresh') {
      throw new Error('Token inválido: não é um refresh token');
    }
    return decoded;
  }

  /**
   * Gera hash SHA-256 do token de sessão para armazenamento seguro.
   * Nunca armazenar o token em texto claro no banco.
   */
  static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}
