/**
 * routes/documents.ts — CRUD de documentos JSON.
 *
 * Toda rota exige API key com o escopo correspondente.
 * Coleção é criada implicitamente no primeiro insert.
 * UPDATE (PATCH/PUT) sempre gera uma linha em `document_versions`.
 */
import type { FastifyPluginAsync } from 'fastify';
import type { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../db.js';
import { apiKeyAuth } from '../auth.js';
import { config } from '../config.js';
import { Errors } from '../errors.js';

/**
 * Valida o payload JSON contra limites de tamanho, profundidade e número
 * de chaves — defesa contra DoS por payload malicioso.
 */
function validateJsonPayload(data: unknown): void {
  const serialized = JSON.stringify(data);
  if (Buffer.byteLength(serialized, 'utf8') > config.JSON_MAX_BYTES) {
    throw Errors.tooLarge(`Payload JSON excede ${config.JSON_MAX_BYTES} bytes.`);
  }
  let keys = 0;
  const walk = (value: unknown, depth: number): void => {
    if (depth > config.JSON_MAX_DEPTH) {
      throw Errors.badRequest(`Profundidade do JSON excede ${config.JSON_MAX_DEPTH}.`);
    }
    if (value && typeof value === 'object') {
      if (Array.isArray(value)) {
        for (const item of value) walk(item, depth + 1);
      } else {
        for (const [, v] of Object.entries(value as Record<string, unknown>)) {
          keys += 1;
          if (keys > config.JSON_MAX_KEYS) {
            throw Errors.badRequest(`Número de chaves do JSON excede ${config.JSON_MAX_KEYS}.`);
          }
          walk(v, depth + 1);
        }
      }
    }
  };
  walk(data, 0);
}

/**
 * Após inserir uma nova versão, apaga versões antigas excedendo a retenção.
 * Config `DOC_VERSION_RETENTION = 0` desativa a poda.
 */
async function pruneOldVersions(
  tx: Prisma.TransactionClient,
  documentId: string,
): Promise<void> {
  const keep = config.DOC_VERSION_RETENTION;
  if (keep <= 0) return;
  const total = await tx.documentVersion.count({ where: { documentId } });
  if (total <= keep) return;
  const stale = await tx.documentVersion.findMany({
    where: { documentId },
    orderBy: { version: 'desc' },
    skip: keep,
    select: { id: true },
  });
  if (stale.length > 0) {
    await tx.documentVersion.deleteMany({ where: { id: { in: stale.map((s) => s.id) } } });
  }
}

// Reutilizamos esta validação em várias rotas.
const CollectionNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Nome deve conter apenas [A-Za-z0-9_-]');

const DocumentIdSchema = z.string().min(1).max(64);

/** Faz merge raso ou profundo entre dois objetos JSON. */
function deepMerge(target: unknown, source: unknown): unknown {
  if (
    typeof target !== 'object' || target === null || Array.isArray(target) ||
    typeof source !== 'object' || source === null || Array.isArray(source)
  ) {
    return source;
  }
  const out: Record<string, unknown> = { ...(target as Record<string, unknown>) };
  for (const [k, v] of Object.entries(source as Record<string, unknown>)) {
    out[k] = deepMerge(out[k], v);
  }
  return out;
}

/** Obtém (ou cria) a coleção pertencente à aplicação do request. */
async function ensureCollection(applicationId: string, name: string) {
  return prisma.collection.upsert({
    where: { applicationId_name: { applicationId, name } },
    update: {},
    create: { applicationId, name },
  });
}

/** Garante que o documento existe e pertence à aplicação do caller. */
async function findDocumentOrFail(id: string, applicationId: string, collectionName: string) {
  const doc = await prisma.document.findUnique({
    where: { id },
    include: { collection: true },
  });
  if (!doc || doc.deletedAt) throw Errors.notFound('Documento');
  if (doc.collection.applicationId !== applicationId) throw Errors.notFound('Documento');
  if (doc.collection.name !== collectionName) throw Errors.notFound('Documento');
  return doc;
}

const routes: FastifyPluginAsync = async (app) => {
  // ---- CREATE ----
  app.post('/:collection', { preHandler: apiKeyAuth('write') }, async (req) => {
    const { collection } = z.object({ collection: CollectionNameSchema }).parse(req.params);
    const data = z.record(z.unknown()).parse(req.body);
    validateJsonPayload(data);

    const col = await ensureCollection(req.application!.id, collection);
    const json = data as Prisma.InputJsonValue;
    const doc = await prisma.$transaction(async (tx) => {
      const created = await tx.document.create({
        data: { collectionId: col.id, data: json },
      });
      await tx.documentVersion.create({
        data: { documentId: created.id, version: created.version, data: json },
      });
      return created;
    });

    return { ok: true, data: serializeDoc(doc) };
  });

  // ---- LIST ----
  app.get('/:collection', { preHandler: apiKeyAuth('read') }, async (req) => {
    const { collection } = z.object({ collection: CollectionNameSchema }).parse(req.params);
    const { limit, offset } = z
      .object({
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const col = await prisma.collection.findUnique({
      where: { applicationId_name: { applicationId: req.application!.id, name: collection } },
    });
    if (!col) return { ok: true, data: { items: [], total: 0, limit, offset } };

    const [items, total] = await Promise.all([
      prisma.document.findMany({
        where: { collectionId: col.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.document.count({ where: { collectionId: col.id, deletedAt: null } }),
    ]);

    return { ok: true, data: { items: items.map(serializeDoc), total, limit, offset } };
  });

  // ---- READ ----
  app.get('/:collection/:id', { preHandler: apiKeyAuth('read') }, async (req) => {
    const { collection, id } = z
      .object({ collection: CollectionNameSchema, id: DocumentIdSchema })
      .parse(req.params);
    const doc = await findDocumentOrFail(id, req.application!.id, collection);
    return { ok: true, data: serializeDoc(doc) };
  });

  // ---- PATCH (merge) ----
  app.patch('/:collection/:id', { preHandler: apiKeyAuth('write') }, async (req) => {
    const { collection, id } = z
      .object({ collection: CollectionNameSchema, id: DocumentIdSchema })
      .parse(req.params);
    const patch = z.record(z.unknown()).parse(req.body);
    validateJsonPayload(patch);

    const doc = await findDocumentOrFail(id, req.application!.id, collection);
    const next = deepMerge(doc.data, patch) as Prisma.InputJsonValue;
    validateJsonPayload(next);

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.document.update({
        where: { id: doc.id },
        data: { data: next, version: { increment: 1 } },
      });
      await tx.documentVersion.create({
        data: { documentId: u.id, version: u.version, data: next },
      });
      await pruneOldVersions(tx, u.id);
      return u;
    });

    return { ok: true, data: serializeDoc(updated) };
  });

  // ---- PUT (replace) ----
  app.put('/:collection/:id', { preHandler: apiKeyAuth('write') }, async (req) => {
    const { collection, id } = z
      .object({ collection: CollectionNameSchema, id: DocumentIdSchema })
      .parse(req.params);
    const data = z.record(z.unknown()).parse(req.body);
    validateJsonPayload(data);

    const doc = await findDocumentOrFail(id, req.application!.id, collection);
    const json = data as Prisma.InputJsonValue;

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.document.update({
        where: { id: doc.id },
        data: { data: json, version: { increment: 1 } },
      });
      await tx.documentVersion.create({
        data: { documentId: u.id, version: u.version, data: json },
      });
      await pruneOldVersions(tx, u.id);
      return u;
    });

    return { ok: true, data: serializeDoc(updated) };
  });

  // ---- DELETE (soft) ----
  app.delete('/:collection/:id', { preHandler: apiKeyAuth('delete') }, async (req) => {
    const { collection, id } = z
      .object({ collection: CollectionNameSchema, id: DocumentIdSchema })
      .parse(req.params);
    const doc = await findDocumentOrFail(id, req.application!.id, collection);
    await prisma.document.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });
    return { ok: true, data: { id: doc.id, deleted: true } };
  });

  // ---- VERSIONS ----
  app.get('/:collection/:id/versions', { preHandler: apiKeyAuth('read') }, async (req) => {
    const { collection, id } = z
      .object({ collection: CollectionNameSchema, id: DocumentIdSchema })
      .parse(req.params);
    const doc = await findDocumentOrFail(id, req.application!.id, collection);
    const versions = await prisma.documentVersion.findMany({
      where: { documentId: doc.id },
      orderBy: { version: 'desc' },
    });
    return {
      ok: true,
      data: versions.map((v) => ({
        version: v.version,
        data: v.data,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  });
};

function serializeDoc(d: {
  id: string;
  data: unknown;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: d.id,
    data: d.data,
    version: d.version,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

export default routes;
