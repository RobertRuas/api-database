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
import { registerAccessLog } from './access-log.js';

import landingRoutes from './routes/landing.js';
import docsRoutes from './routes/docs.js';
import healthRoutes from './routes/health.js';
import documentRoutes from './routes/documents.js';
import fileRoutes from './routes/files.js';
import adminRoutes from './routes/admin.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Decide se uma Origin é permitida. Nunca reflete origens desconhecidas. */
function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // mesmo-origem / curl / server-to-server
  if (config.CORS_ALLOW_ANY) return true;
  return config.ALLOWED_ORIGINS_LIST.includes(origin);
}

async function buildServer() {
  const app = Fastify({
    logger: fastifyLoggerConfig,
    disableRequestLogging: false,
    bodyLimit: Math.max(1024 * 1024, Math.floor(config.MAX_FILE_SIZE / 10)),
    trustProxy: true,
  });

  // ---- Plugins de segurança ----
  await app.register(helmet, {
    // CSP permissiva o suficiente para o painel SPA inline + Tailwind CDN +
    // Google Fonts. Em produção, considere mover tudo para self-hosted e
    // apertar `script-src`/`style-src` para `self` + nonce.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", 'data:', 'https:'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com', 'data:'],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://cdn.tailwindcss.com',
        ],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'", // Tailwind runtime usa eval
          'https://cdn.tailwindcss.com',
        ],
        connectSrc: ["'self'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });

  await app.register(cors, {
    origin: (origin, cb) => {
      if (isOriginAllowed(origin)) cb(null, true);
      else cb(new Error('Origin não permitida pelo CORS'), false);
    },
    credentials: !config.CORS_ALLOW_ANY, // credentials só com origem explícita
  });

  // ---- Rate limit global (por API key, fallback IP) ----
  await app.register(rateLimit, {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_WINDOW,
    allowList: (req) => req.url === '/health',
    keyGenerator: (req) => {
      const header = req.headers['x-api-key'];
      if (typeof header === 'string' && header.length > 0) return `k:${header.slice(0, 48)}`;
      const auth = req.headers.authorization;
      if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
        return `k:${auth.slice(7, 55)}`;
      }
      return `ip:${req.ip}`;
    },
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

  // ---- Headers de segurança adicionais ----
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header('Referrer-Policy', 'no-referrer');
  });

  // ---- Access log (auditoria por request) ----
  registerAccessLog(app);

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

  const SHUTDOWN_TIMEOUT_MS = 15_000;
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown iniciado');
    const killer = setTimeout(() => {
      logger.error({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'Shutdown excedeu timeout — forçando exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    killer.unref();

    try {
      await app.close();
      await prisma.$disconnect();
      clearTimeout(killer);
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
      `API DataBase pronta em ${config.PUBLIC_URL}`,
    );
  } catch (err) {
    logger.error({ err }, 'Falha ao iniciar servidor');
    process.exit(1);
  }
}

void main();
