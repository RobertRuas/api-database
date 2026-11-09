/**
 * server.ts — Bootstrap do Fastify.
 *
 * Responsabilidades:
 *  1. Criar a instância com nosso logger Pino.
 *  2. Registrar plugins de segurança (helmet, cors, rate-limit, cookie, multipart).
 *  3. Registrar rotas agrupadas por domínio.
 *  4. Instalar handler global de erros e shutdown gracioso.
 */
import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { config } from './config.js';
import { logger, fastifyLoggerConfig } from './logger.js';
import { prisma } from './db.js';
import { errorHandler } from './errors.js';

import landingRoutes from './routes/landing.js';
import docsRoutes from './routes/docs.js';
import healthRoutes from './routes/health.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildServer() {
  const app = Fastify({
    logger: fastifyLoggerConfig,
    disableRequestLogging: false,
    bodyLimit: Math.max(1024 * 1024, Math.floor(config.MAX_FILE_SIZE / 10)),
    trustProxy: true,
  });

  // ---- Plugins de segurança ----
  await app.register(helmet, { contentSecurityPolicy: false }); // CSP flexível p/ painel inline
  await app.register(cors, { origin: true, credentials: true });
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    allowList: (req) => req.url === '/health',
  });
  await app.register(cookie, { secret: config.SESSION_SECRET });
  await app.register(multipart, {
    limits: { fileSize: config.MAX_FILE_SIZE, files: 1 },
  });

  // ---- Assets estáticos do painel ----
  await app.register(fastifyStatic, {
    root: join(__dirname, 'admin'),
    prefix: '/admin/static/',
    decorateReply: false,
  });

  // ---- Handler global de erros ----
  app.setErrorHandler(errorHandler);

  // ---- Not found padronizado ----
  app.setNotFoundHandler((_req, reply) => {
    reply.code(404).send({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' },
    });
  });

  // ---- Rotas ----
  await app.register(landingRoutes);
  await app.register(docsRoutes);
  await app.register(healthRoutes);
  await app.register(documentRoutes, { prefix: '/v1' });
  await app.register(fileRoutes, { prefix: '/v1/files' });
  await app.register(adminRoutes, { prefix: '/admin' });

  return app;
}

async function main() {
  const app = await buildServer();

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown iniciado');
    try {
      await app.close();
      await prisma.$disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Falha no shutdown');
      process.exit(1);
    }
  };

  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  try {
    await app.listen({ host: config.HOST, port: config.PORT });
    logger.info(
      { url: config.PUBLIC_URL, env: config.NODE_ENV },
      `🚀 API DataBase pronta em ${config.PUBLIC_URL}`,
    );
  } catch (err) {
    logger.error({ err }, 'Falha ao iniciar servidor');
    process.exit(1);
  }
}

void main();
