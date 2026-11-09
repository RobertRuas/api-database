/**
 * routes/admin.ts — Painel administrativo.
 *
 * Fluxo: login → cookie de sessão → rotas /admin/api/* protegidas.
 * O HTML do painel vem de src/admin/index.html (SPA single-file).
 */
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { readFile as fsReadFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { z } from 'zod';
import { config } from '../config.js';
import { prisma } from '../db.js';
import {
  adminAuth,
  clearAdminSession,
  createApiKey,
  issueAdminSession,
  verifyPassword,
  hashPassword,
  type Scope,
} from '../auth.js';
import { Errors } from '../errors.js';
import { deleteFile as storageDelete, readFile as storageRead } from '../storage.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_PATH = join(__dirname, '..', 'admin', 'index.html');

// Hash da senha admin — calculado uma vez no boot para evitar custo em cada login.
let adminPasswordHash: string | null = null;
async function getAdminHash(): Promise<string> {
  if (!adminPasswordHash) adminPasswordHash = await hashPassword(config.ADMIN_PASSWORD);
  return adminPasswordHash;
}

const ScopeSchema = z.enum(['read', 'write', 'delete', 'files']);

const routes: FastifyPluginAsync = async (app) => {
  // ---- Painel (HTML) ----
  app.get('/', async (_req, reply) => {
    const html = await fsReadFile(INDEX_PATH, 'utf8');
    reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });

  // ---- Login ----
  app.post('/login', async (req, reply) => {
    const { username, password } = z
      .object({ username: z.string().min(1), password: z.string().min(1) })
      .parse(req.body);

    if (username !== config.ADMIN_USERNAME) throw Errors.unauthorized('Credenciais inválidas.');
    const ok = await verifyPassword(password, await getAdminHash());
    if (!ok) throw Errors.unauthorized('Credenciais inválidas.');

    issueAdminSession(reply, username);
    return { ok: true, data: { username } };
  });

  // ---- Logout ----
  app.post('/logout', async (_req, reply) => {
    clearAdminSession(reply);
    return { ok: true, data: { loggedOut: true } };
  });

  // ---- Me (verifica sessão) ----
  app.get('/api/me', { preHandler: adminAuth }, async (req) => {
    return { ok: true, data: { username: req.admin!.username } };
  });

  // ---- Apps: listar ----
  app.get('/api/apps', { preHandler: adminAuth }, async () => {
    const apps = await prisma.application.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { apiKeys: true, collections: true, files: true } },
      },
    });
    return {
      ok: true,
      data: apps.map((a) => ({
        id: a.id,
        name: a.name,
        description: a.description,
        active: a.active,
        createdAt: a.createdAt.toISOString(),
        counts: a._count,
      })),
    };
  });

  // ---- Apps: criar ----
  app.post('/api/apps', { preHandler: adminAuth }, async (req) => {
    const { name, description } = z
      .object({
        name: z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/),
        description: z.string().max(500).optional(),
      })
      .parse(req.body);

    const exists = await prisma.application.findUnique({ where: { name } });
    if (exists) throw Errors.conflict('Já existe uma aplicação com esse nome.');

    const app = await prisma.application.create({ data: { name, description } });
    return {
      ok: true,
      data: { id: app.id, name: app.name, description: app.description, active: app.active },
    };
  });

  // ---- Apps: desativar/ativar ----
  app.patch('/api/apps/:id', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { active, description } = z
      .object({ active: z.boolean().optional(), description: z.string().max(500).optional() })
      .parse(req.body);

    const app = await prisma.application.update({
      where: { id },
      data: { active, description },
    });
    return { ok: true, data: { id: app.id, active: app.active } };
  });

  // ---- Apps: deletar ----
  app.delete('/api/apps/:id', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    await prisma.application.delete({ where: { id } });
    return { ok: true, data: { id, deleted: true } };
  });

  // ---- API Keys: listar ----
  app.get('/api/apps/:id/keys', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const keys = await prisma.apiKey.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
    });
    return {
      ok: true,
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
      })),
    };
  });

  // ---- API Keys: criar (retorna token em claro UMA VEZ) ----
  app.post('/api/apps/:id/keys', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { name, scopes } = z
      .object({
        name: z.string().min(1).max(64),
        scopes: z.array(ScopeSchema).min(1),
      })
      .parse(req.body);

    const application = await prisma.application.findUnique({ where: { id } });
    if (!application) throw Errors.notFound('Aplicação');

    const { token, prefix, hash } = await createApiKey();
    const created = await prisma.apiKey.create({
      data: {
        applicationId: id,
        name,
        prefix,
        hash,
        scopes: scopes as Scope[],
      },
    });

    return {
      ok: true,
      data: {
        id: created.id,
        name: created.name,
        token, // ← última vez que o token aparece em claro
        prefix: created.prefix,
        scopes: created.scopes,
      },
    };
  });

  // ---- API Keys: revogar ----
  app.delete('/api/apps/:appId/keys/:keyId', { preHandler: adminAuth }, async (req) => {
    const { appId, keyId } = z
      .object({ appId: z.string(), keyId: z.string() })
      .parse(req.params);
    const key = await prisma.apiKey.findUnique({ where: { id: keyId } });
    if (!key || key.applicationId !== appId) throw Errors.notFound('Chave');
    await prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
    return { ok: true, data: { id: keyId, revoked: true } };
  });

  // ---- Coleções de uma aplicação ----
  app.get('/api/apps/:id/collections', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const collections = await prisma.collection.findMany({
      where: { applicationId: id },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { documents: { where: { deletedAt: null } } } },
      },
    });
    return {
      ok: true,
      data: collections.map((c) => ({
        id: c.id,
        name: c.name,
        documents: c._count.documents,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  });

  // ---- Documentos de uma coleção ----
  app.get('/api/apps/:id/collections/:name/documents', { preHandler: adminAuth }, async (req) => {
    const { id, name } = z.object({ id: z.string(), name: z.string() }).parse(req.params);
    const { limit, offset } = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const col = await prisma.collection.findUnique({
      where: { applicationId_name: { applicationId: id, name } },
    });
    if (!col) throw Errors.notFound('Coleção');

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where: { collectionId: col.id, deletedAt: null },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where: { collectionId: col.id, deletedAt: null } }),
    ]);
    return {
      ok: true,
      data: {
        items: items.map((d) => ({
          id: d.id,
          data: d.data,
          version: d.version,
          createdAt: d.createdAt.toISOString(),
          updatedAt: d.updatedAt.toISOString(),
        })),
        total,
        limit,
        offset,
      },
    };
  });

  // ---- Arquivos de uma aplicação (todas as coleções) ----
  app.get('/api/apps/:id/files', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { limit, offset } = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const [items, total] = await Promise.all([
      prisma.fileAsset.findMany({
        where: { applicationId: id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.fileAsset.count({ where: { applicationId: id } }),
    ]);
    return {
      ok: true,
      data: {
        items: items.map((f) => ({
          id: f.id,
          collection: f.collection,
          originalName: f.originalName,
          size: f.size,
          mimeType: f.mimeType,
          sha256: f.sha256,
          createdAt: f.createdAt.toISOString(),
        })),
        total,
        limit,
        offset,
      },
    };
  });

  // ============================================================
  //  Manipulação direta de dados (admin — bypassa API keys)
  // ============================================================

  const DocIdSchema = z.string().min(1).max(64);
  const CollectionNameSchema = z.string().min(1).max(64).regex(/^[a-zA-Z0-9_-]+$/);

  // --- Criar documento manualmente ---
  app.post(
    '/api/apps/:id/collections/:name/documents',
    { preHandler: adminAuth },
    async (req) => {
      const { id, name } = z
        .object({ id: z.string(), name: CollectionNameSchema })
        .parse(req.params);
      const data = z.record(z.unknown()).parse(req.body);

      const col = await prisma.collection.upsert({
        where: { applicationId_name: { applicationId: id, name } },
        update: {},
        create: { applicationId: id, name },
      });

      const json = data as Prisma.InputJsonValue;
      const created = await prisma.$transaction(async (tx) => {
        const doc = await tx.document.create({ data: { collectionId: col.id, data: json } });
        await tx.documentVersion.create({
          data: { documentId: doc.id, version: doc.version, data: json },
        });
        return doc;
      });

      return {
        ok: true,
        data: {
          id: created.id,
          data: created.data,
          version: created.version,
          createdAt: created.createdAt.toISOString(),
          updatedAt: created.updatedAt.toISOString(),
        },
      };
    },
  );

  // --- Editar documento manualmente (substitui data completo) ---
  app.put(
    '/api/apps/:id/collections/:name/documents/:docId',
    { preHandler: adminAuth },
    async (req) => {
      const { id, name, docId } = z
        .object({ id: z.string(), name: CollectionNameSchema, docId: DocIdSchema })
        .parse(req.params);
      const data = z.record(z.unknown()).parse(req.body);

      const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { collection: true },
      });
      if (!doc || doc.collection.applicationId !== id || doc.collection.name !== name) {
        throw Errors.notFound('Documento');
      }

      const json = data as Prisma.InputJsonValue;
      const updated = await prisma.$transaction(async (tx) => {
        const u = await tx.document.update({
          where: { id: doc.id },
          data: { data: json, version: { increment: 1 }, deletedAt: null },
        });
        await tx.documentVersion.create({
          data: { documentId: u.id, version: u.version, data: json },
        });
        return u;
      });

      return {
        ok: true,
        data: {
          id: updated.id,
          data: updated.data,
          version: updated.version,
          updatedAt: updated.updatedAt.toISOString(),
        },
      };
    },
  );

  // --- Deletar documento (hard delete, remove tudo incluindo versões) ---
  app.delete(
    '/api/apps/:id/collections/:name/documents/:docId',
    { preHandler: adminAuth },
    async (req) => {
      const { id, name, docId } = z
        .object({ id: z.string(), name: CollectionNameSchema, docId: DocIdSchema })
        .parse(req.params);
      const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { collection: true },
      });
      if (!doc || doc.collection.applicationId !== id || doc.collection.name !== name) {
        throw Errors.notFound('Documento');
      }
      await prisma.document.delete({ where: { id: doc.id } });
      return { ok: true, data: { id: docId, deleted: true } };
    },
  );

  // --- Versões de um documento ---
  app.get(
    '/api/apps/:id/collections/:name/documents/:docId/versions',
    { preHandler: adminAuth },
    async (req) => {
      const { id, name, docId } = z
        .object({ id: z.string(), name: CollectionNameSchema, docId: DocIdSchema })
        .parse(req.params);
      const doc = await prisma.document.findUnique({
        where: { id: docId },
        include: { collection: true, versions: { orderBy: { version: 'desc' } } },
      });
      if (!doc || doc.collection.applicationId !== id || doc.collection.name !== name) {
        throw Errors.notFound('Documento');
      }
      return {
        ok: true,
        data: doc.versions.map((v) => ({
          version: v.version,
          data: v.data,
          createdAt: v.createdAt.toISOString(),
        })),
      };
    },
  );

  // --- Deletar coleção inteira ---
  app.delete('/api/apps/:id/collections/:name', { preHandler: adminAuth }, async (req) => {
    const { id, name } = z
      .object({ id: z.string(), name: CollectionNameSchema })
      .parse(req.params);
    const col = await prisma.collection.findUnique({
      where: { applicationId_name: { applicationId: id, name } },
    });
    if (!col) throw Errors.notFound('Coleção');
    await prisma.collection.delete({ where: { id: col.id } });
    return { ok: true, data: { collection: name, deleted: true } };
  });

  // --- Download de arquivo (admin) ---
  app.get('/api/apps/:id/files/:fileId/download', { preHandler: adminAuth }, async (req, reply) => {
    const { id, fileId } = z
      .object({ id: z.string(), fileId: z.string() })
      .parse(req.params);
    const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file || file.applicationId !== id) throw Errors.notFound('Arquivo');

    const stream = await storageRead(file.storedPath);
    reply
      .header('Content-Type', file.mimeType)
      .header('Content-Length', file.size)
      .header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      );
    return reply.send(stream);
  });

  // --- Deletar arquivo (admin) ---
  app.delete('/api/apps/:id/files/:fileId', { preHandler: adminAuth }, async (req) => {
    const { id, fileId } = z
      .object({ id: z.string(), fileId: z.string() })
      .parse(req.params);
    const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
    if (!file || file.applicationId !== id) throw Errors.notFound('Arquivo');

    await storageDelete(file.storedPath);
    await prisma.fileAsset.delete({ where: { id: file.id } });
    return { ok: true, data: { id: fileId, deleted: true } };
  });

  // --- Stats detalhadas por aplicação ---
  app.get('/api/apps/:id/stats', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const now = new Date();
    const d24h = new Date(now.getTime() - 24 * 3600_000);
    const d7d = new Date(now.getTime() - 7 * 86400_000);

    const [
      collections, documents, versions, files, totalSize, keys,
      totalRequests, requests24h, requests7d, errorsTotal, avgLatency,
      byStatus, topPaths,
    ] = await Promise.all([
      prisma.collection.count({ where: { applicationId: id } }),
      prisma.document.count({ where: { collection: { applicationId: id }, deletedAt: null } }),
      prisma.documentVersion.count({ where: { document: { collection: { applicationId: id } } } }),
      prisma.fileAsset.count({ where: { applicationId: id } }),
      prisma.fileAsset.aggregate({ _sum: { size: true }, where: { applicationId: id } }),
      prisma.apiKey.count({ where: { applicationId: id, revokedAt: null } }),

      prisma.accessLog.count({ where: { applicationId: id } }),
      prisma.accessLog.count({ where: { applicationId: id, createdAt: { gte: d24h } } }),
      prisma.accessLog.count({ where: { applicationId: id, createdAt: { gte: d7d } } }),
      prisma.accessLog.count({ where: { applicationId: id, status: { gte: 400 } } }),
      prisma.accessLog.aggregate({ _avg: { durationMs: true }, where: { applicationId: id } }),

      prisma.accessLog.groupBy({
        by: ['status'],
        where: { applicationId: id, createdAt: { gte: d7d } },
        _count: { _all: true },
      }),
      prisma.accessLog.groupBy({
        by: ['method', 'path'],
        where: { applicationId: id, createdAt: { gte: d7d } },
        _count: { _all: true },
        orderBy: { _count: { path: 'desc' } },
        take: 10,
      }),
    ]);

    return {
      ok: true,
      data: {
        collections, documents, versions, files,
        storageBytes: totalSize._sum.size ?? 0,
        activeKeys: keys,
        requests: {
          total: totalRequests,
          last24h: requests24h,
          last7d: requests7d,
          errors: errorsTotal,
          avgLatencyMs: Math.round(avgLatency._avg.durationMs ?? 0),
          byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
          topPaths: topPaths.map((p) => ({
            method: p.method,
            path: p.path,
            count: p._count._all,
          })),
        },
      },
    };
  });

  // --- Lista de requisições recentes (paginada) ---
  app.get('/api/apps/:id/requests', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const { limit, offset, apiKeyId, status } = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
        apiKeyId: z.string().optional(),
        status: z.enum(['all', '2xx', '4xx', '5xx']).optional(),
      })
      .parse(req.query);

    const where: Prisma.AccessLogWhereInput = { applicationId: id };
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (status === '2xx') where.status = { gte: 200, lt: 300 };
    else if (status === '4xx') where.status = { gte: 400, lt: 500 };
    else if (status === '5xx') where.status = { gte: 500 };

    const [items, total] = await Promise.all([
      prisma.accessLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.accessLog.count({ where }),
    ]);

    return {
      ok: true,
      data: {
        items: items.map((r) => ({
          id: r.id,
          apiKeyId: r.apiKeyId,
          method: r.method,
          path: r.path,
          status: r.status,
          durationMs: r.durationMs,
          ip: r.ip,
          userAgent: r.userAgent,
          createdAt: r.createdAt.toISOString(),
        })),
        total, limit, offset,
      },
    };
  });

  // --- Stats por chave de API ---
  app.get('/api/apps/:id/keys/:keyId/stats', { preHandler: adminAuth }, async (req) => {
    const { id, keyId } = z
      .object({ id: z.string(), keyId: z.string() })
      .parse(req.params);
    const d24h = new Date(Date.now() - 24 * 3600_000);
    const d7d = new Date(Date.now() - 7 * 86400_000);

    const [total, last24h, last7d, errors, avg, byStatus] = await Promise.all([
      prisma.accessLog.count({ where: { applicationId: id, apiKeyId: keyId } }),
      prisma.accessLog.count({
        where: { applicationId: id, apiKeyId: keyId, createdAt: { gte: d24h } },
      }),
      prisma.accessLog.count({
        where: { applicationId: id, apiKeyId: keyId, createdAt: { gte: d7d } },
      }),
      prisma.accessLog.count({
        where: { applicationId: id, apiKeyId: keyId, status: { gte: 400 } },
      }),
      prisma.accessLog.aggregate({
        _avg: { durationMs: true },
        where: { applicationId: id, apiKeyId: keyId },
      }),
      prisma.accessLog.groupBy({
        by: ['status'],
        where: { applicationId: id, apiKeyId: keyId },
        _count: { _all: true },
      }),
    ]);

    return {
      ok: true,
      data: {
        total, last24h, last7d, errors,
        avgLatencyMs: Math.round(avg._avg.durationMs ?? 0),
        byStatus: byStatus.map((s) => ({ status: s.status, count: s._count._all })),
      },
    };
  });

  // --- Lista de chaves com contadores de requisições ---
  // (Reusa listKeys mas adiciona contadores via subqueries agregadas.)
  app.get('/api/apps/:id/keys-stats', { preHandler: adminAuth }, async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const keys = await prisma.apiKey.findMany({
      where: { applicationId: id },
      orderBy: { createdAt: 'desc' },
    });
    const counts = await prisma.accessLog.groupBy({
      by: ['apiKeyId'],
      where: { applicationId: id, apiKeyId: { in: keys.map((k) => k.id) } },
      _count: { _all: true },
    });
    const byKey = new Map(counts.map((c) => [c.apiKeyId, c._count._all]));
    return {
      ok: true,
      data: keys.map((k) => ({
        id: k.id,
        name: k.name,
        prefix: k.prefix,
        scopes: k.scopes,
        lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
        revokedAt: k.revokedAt?.toISOString() ?? null,
        createdAt: k.createdAt.toISOString(),
        requests: byKey.get(k.id) ?? 0,
      })),
    };
  });

  // ---- Stats globais ----
  app.get('/api/stats', { preHandler: adminAuth }, async () => {
    const [apps, keys, docs, files, totalSize] = await Promise.all([
      prisma.application.count(),
      prisma.apiKey.count({ where: { revokedAt: null } }),
      prisma.document.count({ where: { deletedAt: null } }),
      prisma.fileAsset.count(),
      prisma.fileAsset.aggregate({ _sum: { size: true } }),
    ]);
    return {
      ok: true,
      data: {
        applications: apps,
        activeKeys: keys,
        documents: docs,
        files,
        storageBytes: totalSize._sum.size ?? 0,
      },
    };
  });
};

export default routes;
