// src/infrastructure/database/prisma.client.ts
// Singleton do PrismaClient com configurações de segurança e auditoria
// Nunca logar queries em produção — dados de saúde podem vazar nos logs

import { PrismaClient } from '@prisma/client';

const isDevelopment = process.env['NODE_ENV'] === 'development';

/**
 * Instância global do PrismaClient.
 * Em desenvolvimento: loga apenas erros e avisos.
 * Em produção: sem logs de query (proteção de dados de saúde).
 */
const prismaClientSingleton = (): PrismaClient => {
  return new PrismaClient({
    log: isDevelopment
      ? [
          { emit: 'stdout', level: 'warn' },
          { emit: 'stdout', level: 'error' },
          // NÃO habilitar 'query' mesmo em dev — pode expor dados clínicos
        ]
      : [{ emit: 'stdout', level: 'error' }],
    errorFormat: 'minimal', // Nunca expor stack traces com dados sensíveis
  });
};

// Prevenção de múltiplas instâncias no hot reload do Node.js
declare const globalThis: {
  prismaGlobal?: PrismaClient;
} & typeof global;

export const prisma: PrismaClient =
  globalThis.prismaGlobal ?? prismaClientSingleton();

if (isDevelopment) {
  globalThis.prismaGlobal = prisma;
}
