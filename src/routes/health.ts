/**
 * routes/health.ts — Endpoint público de saúde.
 *
 * Retorna uptime do processo e status do banco (consulta leve).
 */
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db.js';

const startedAt = Date.now();

const health: FastifyPluginAsync = async (app) => {
  app.get('/health', async () => {
    let db: 'up' | 'down' = 'up';
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return {
      ok: true,
      data: {
        service: 'api-database',
        version: process.env.npm_package_version ?? '0.1.0',
        uptimeSeconds: Math.round((Date.now() - startedAt) / 1000),
        db,
        timestamp: new Date().toISOString(),
      },
    };
  });
};

export default health;
