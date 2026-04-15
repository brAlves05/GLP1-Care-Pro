// src/main.ts
// Ponto de entrada — inicia o servidor Fastify

import { buildServer } from './http/server';
import { prisma } from './infrastructure/database/prisma.client';

const PORT = Number(process.env['PORT'] ?? 3000);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function main(): Promise<void> {
  const fastify = await buildServer();

  // Graceful shutdown — fecha conexões abertas antes de encerrar
  const shutdown = async (signal: string): Promise<void> => {
    fastify.log.info({ signal }, 'Encerrando servidor...');
    await fastify.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`GLP-1 Care Pro API rodando em http://${HOST}:${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
