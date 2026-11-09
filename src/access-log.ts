/**
 * access-log.ts — Hook de auditoria que grava cada requisição da API v1.
 *
 * Em vez de um INSERT síncrono por request, acumulamos em um buffer e
 * fazemos flush em batch: menor pressão no Postgres e maior throughput da
 * API. Em shutdown, chamamos `flushAccessLogs` para esvaziar a fila.
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { prisma } from './db.js';
import { logger } from './logger.js';

const TRACKED_PREFIXES = ['/v1/'];
const BATCH_MAX = 100;
const FLUSH_INTERVAL_MS = 2000;

interface AccessLogEntry {
  applicationId: string | null;
  apiKeyId: string | null;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  ip: string | null;
  userAgent: string | null;
}

const buffer: AccessLogEntry[] = [];
let flushTimer: NodeJS.Timeout | null = null;

function shouldTrack(url: string): boolean {
  return TRACKED_PREFIXES.some((p) => url.startsWith(p));
}

/**
 * Normaliza a URL para agrupar métricas. Ex.: `/v1/configs/abc123` → `/v1/configs/:id`.
 */
function normalizePath(url: string): string {
  const [pathOnly] = url.split('?');
  if (!pathOnly) return url;

  if (/^\/v1\/files\/[^/]+$/.test(pathOnly)) return '/v1/files/:id';
  if (pathOnly === '/v1/files') return '/v1/files';

  const versions = pathOnly.match(/^\/v1\/([^/]+)\/[^/]+\/versions$/);
  if (versions) return `/v1/${versions[1]}/:id/versions`;

  const docId = pathOnly.match(/^\/v1\/([^/]+)\/[^/]+$/);
  if (docId) return `/v1/${docId[1]}/:id`;

  const col = pathOnly.match(/^\/v1\/([^/]+)$/);
  if (col) return `/v1/${col[1]}`;

  return pathOnly;
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    void flushAccessLogs();
  }, FLUSH_INTERVAL_MS);
  // `unref` evita segurar o event loop no shutdown.
  flushTimer.unref();
}

/** Esvazia o buffer no banco. Chamado por timer ou manualmente no shutdown. */
export async function flushAccessLogs(): Promise<void> {
  if (buffer.length === 0) return;
  const drained = buffer.splice(0, buffer.length);
  try {
    await prisma.accessLog.createMany({ data: drained });
  } catch (err) {
    logger.warn(
      { err: (err as Error).message, dropped: drained.length },
      'Falha ao gravar batch de access_log',
    );
  }
}

export function registerAccessLog(app: FastifyInstance) {
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

      buffer.push({
        applicationId: req.application?.id ?? null,
        apiKeyId: req.apiKey?.id ?? null,
        method: req.method,
        path: normalizePath(req.url),
        status: reply.statusCode,
        durationMs,
        ip: req.ip?.slice(0, 64) ?? null,
        userAgent: (req.headers['user-agent'] ?? '').toString().slice(0, 256) || null,
      });

      if (buffer.length >= BATCH_MAX) {
        void flushAccessLogs();
      } else {
        scheduleFlush();
      }
    } catch (err) {
      logger.warn({ err: (err as Error).message }, 'Hook access_log quebrou');
    }
  });

  // Flush final em shutdown gracioso.
  app.addHook('onClose', async () => {
    if (flushTimer) {
      clearTimeout(flushTimer);
      flushTimer = null;
    }
    await flushAccessLogs();
  });
}
