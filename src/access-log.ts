/**
 * access-log.ts — Hook de auditoria que grava cada requisição da API v1.
 *
 * Registramos: aplicação, chave usada, método, rota, status, duração, IP.
 * A escrita é fire-and-forget (não bloqueia a resposta) e falha em silêncio
 * — logar não pode derrubar o endpoint real.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { logger } from './logger.js';

// Só registramos rotas de API de dados — ignoramos painel, health, estáticos.
const TRACKED_PREFIXES = ['/v1/'];

function shouldTrack(url: string): boolean {
  return TRACKED_PREFIXES.some((p) => url.startsWith(p));
}

/**
 * Normaliza a URL para agrupar métricas. Ex.: `/v1/configs/abc123` → `/v1/configs/:id`.
 * Mantemos a coleção porque ela é dimensão útil; o id é substituído por `:id`.
 */
function normalizePath(url: string): string {
  const [pathOnly] = url.split('?');
  if (!pathOnly) return url;

  // /v1/files/:id → /v1/files/:id
  if (/^\/v1\/files\/[^/]+$/.test(pathOnly)) return '/v1/files/:id';
  // /v1/files (list com query) → /v1/files
  if (pathOnly === '/v1/files') return '/v1/files';

  // /v1/:collection/:id/versions
  const versions = pathOnly.match(/^\/v1\/([^/]+)\/[^/]+\/versions$/);
  if (versions) return `/v1/${versions[1]}/:id/versions`;

  // /v1/:collection/:id
  const docId = pathOnly.match(/^\/v1\/([^/]+)\/[^/]+$/);
  if (docId) return `/v1/${docId[1]}/:id`;

  // /v1/:collection (coleção)
  const col = pathOnly.match(/^\/v1\/([^/]+)$/);
  if (col) return `/v1/${col[1]}`;

  return pathOnly;
}

export function registerAccessLog(app: FastifyInstance) {
  // Marca início para calcular duração.
  app.addHook('onRequest', async (req) => {
    (req as FastifyRequest & { _startAt?: bigint })._startAt = process.hrtime.bigint();
  });

  app.addHook('onResponse', async (req, reply) => {
    try {
      if (!shouldTrack(req.url)) return;

      const start = (req as FastifyRequest & { _startAt?: bigint })._startAt;
      const durationMs = start
        ? Number((process.hrtime.bigint() - start) / 1_000_000n)
        : 0;

      // Dispara sem await — resposta já foi enviada.
      prisma.accessLog
        .create({
          data: {
            applicationId: req.application?.id ?? null,
            apiKeyId: req.apiKey?.id ?? null,
            method: req.method,
            path: normalizePath(req.url),
            status: reply.statusCode,
            durationMs,
            ip: req.ip?.slice(0, 64) ?? null,
            userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 256) || null,
          },
        })
        .catch((err) => {
          // Nunca propagar — logar apenas.
          logger.warn({ err: err.message }, 'Falha ao gravar access_log');
        });
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Hook access_log quebrou');
    }
  });
}
