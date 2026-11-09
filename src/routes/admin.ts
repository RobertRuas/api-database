/**
 * routes/admin.ts — Painel administrativo.
 *
 * Fluxo: login → cookie de sessão → rotas /admin/api/* protegidas.
 * O HTML do painel vem de src/admin/index.html (SPA single-file).
 */
import type { FastifyPluginAsync } from 'fastify';
import { readFile } from 'node:fs/promises';
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
    const html = await readFile(INDEX_PATH, 'utf8');
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
