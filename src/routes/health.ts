/**
 * routes/health.ts — Endpoint público de saúde.
 *
 * Verifica: DB (SELECT 1), storage writable (W+R+unlink de arquivo temp),
 * uptime. Retorna 503 se algum componente crítico falhar.
 */
import type { FastifyPluginAsync } from 'fastify';
import { mkdir, writeFile, unlink } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { prisma } from '../db.js';
import { config } from '../config.js';

const startedAt = Date.now();

async function checkDb(): Promise<{ up: boolean; latencyMs: number }> {
  const t0 = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { up: true, latencyMs: Date.now() - t0 };
  } catch {
    return { up: false, latencyMs: Date.now() - t0 };
  }
}

async function checkStorage(): Promise<{ up: boolean; latencyMs: number }> {
  const t0 = Date.now();
  const root = resolve(config.STORAGE_ROOT);
  const probe = join(root, `.healthcheck-${randomUUID()}`);
  try {
    await mkdir(root, { recursive: true });
    await writeFile(probe, 'ok');
    await unlink(probe);
    return { up: true, latencyMs: Date.now() - t0 };
  } catch {
    return { up: false, latencyMs: Date.now() - t0 };
  }
}

const health: FastifyPluginAsync = async (app) => {
  app.get('/health', async (_req, reply) => {
    const [db, storage] = await Promise.all([checkDb(), checkStorage()]);
    const allUp = db.up && storage.up;
    if (!allUp) reply.code(503);
    return {
      ok: allUp,
      data: {
        service: 'api-database',
        version: process.env.npm_package_version ?? '0.1.0',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        db: db.up ? 'up' : 'down',
        dbLatencyMs: db.latencyMs,
        storage: storage.up ? 'up' : 'down',
        storageLatencyMs: storage.latencyMs,
        timestamp: new Date().toISOString(),
      },
    };
  });
};

export default health;
