/**
 * routes/files.ts — Upload, download e listagem de arquivos.
 *
 * Upload: multipart/form-data, campo `file`. Metadados em FileAsset.
 * Download: stream direto do disco. 404 se não existir ou não pertencer à app.
 */
import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../db.js';
import { apiKeyAuth } from '../auth.js';
import { Errors } from '../errors.js';
import { logger } from '../logger.js';
import { deleteFile, readFile, saveFile } from '../storage.js';

const CollectionNameSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-zA-Z0-9_-]+$/);

const FileIdSchema = z.string().min(1).max(64);

const routes: FastifyPluginAsync = async (app) => {
  // ---- Upload ----
  app.post('/:collection', { preHandler: apiKeyAuth('files') }, async (req) => {
    const { collection } = z.object({ collection: CollectionNameSchema }).parse(req.params);

    // Quota: se a Application definiu `storageQuotaBytes`, bloqueia upload
    // se a soma atual já estourou. Checagem antes de gravar no disco.
    const appRow = await prisma.application.findUnique({
      where: { id: req.application!.id },
      select: { storageQuotaBytes: true },
    });
    const quota = appRow?.storageQuotaBytes != null ? BigInt(appRow.storageQuotaBytes) : null;

    if (quota !== null && quota > 0n) {
      const used = await prisma.fileAsset.aggregate({
        _sum: { size: true },
        where: { applicationId: req.application!.id, deletedAt: null },
      });
      if (BigInt(used._sum.size ?? 0) >= quota) {
        throw Errors.tooLarge('Quota de armazenamento excedida.');
      }
    }

    const data = await req.file();
    if (!data) throw Errors.badRequest('Nenhum arquivo enviado.');

    const saved = await saveFile(
      req.application!.id,
      collection,
      data.filename ?? 'file',
      data.file,
    );
    if (data.file.truncated) {
      await deleteFile(saved.storedPath);
      throw Errors.tooLarge();
    }

    if (quota !== null && quota > 0n) {
      const used = await prisma.fileAsset.aggregate({
        _sum: { size: true },
        where: { applicationId: req.application!.id, deletedAt: null },
      });
      if (BigInt(used._sum.size ?? 0) + BigInt(saved.size) > quota) {
        await deleteFile(saved.storedPath);
        throw Errors.tooLarge('Quota de armazenamento excedida.');
      }
    }

    const record = await prisma.fileAsset.create({
      data: {
        applicationId: req.application!.id,
        collection,
        originalName: data.filename ?? 'file',
        storedPath: saved.storedPath,
        size: saved.size,
        mimeType: data.mimetype ?? 'application/octet-stream',
        sha256: saved.sha256,
      },
    });

    return { ok: true, data: serializeFile(record) };
  });

  // ---- List ---- (query `?collection=X` evita colisão com GET /:id)
  app.get('/', { preHandler: apiKeyAuth('files') }, async (req) => {
    const { collection, limit, offset } = z
      .object({
        collection: CollectionNameSchema,
        limit: z.coerce.number().int().min(1).max(200).default(50),
        offset: z.coerce.number().int().min(0).default(0),
      })
      .parse(req.query);

    const where = {
      applicationId: req.application!.id,
      collection,
      deletedAt: null,
    };
    const [items, total] = await Promise.all([
      prisma.fileAsset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.fileAsset.count({ where }),
    ]);

    return { ok: true, data: { items: items.map(serializeFile), total, limit, offset } };
  });

  // ---- Download ----
  app.get('/:id', { preHandler: apiKeyAuth('files') }, async (req, reply) => {
    const { id } = z.object({ id: FileIdSchema }).parse(req.params);
    const file = await prisma.fileAsset.findUnique({ where: { id } });
    if (!file || file.applicationId !== req.application!.id || file.deletedAt) {
      throw Errors.notFound('Arquivo');
    }

    const stream = await readFile(file.storedPath);
    reply
      .header('Content-Type', file.mimeType)
      .header('Content-Length', file.size)
      .header('X-Content-Type-Options', 'nosniff')
      .header(
        'Content-Disposition',
        `attachment; filename="${encodeURIComponent(file.originalName)}"`,
      )
      .header('ETag', `"${file.sha256}"`);
    return reply.send(stream);
  });

  // ---- Delete (soft) ----
  // Marca `deletedAt` primeiro; remoção do disco é best-effort. Se o unlink
  // falhar, o registro permanece como "pendente" para um job de reconciliação.
  app.delete('/:id', { preHandler: apiKeyAuth('files', 'delete') }, async (req) => {
    const { id } = z.object({ id: FileIdSchema }).parse(req.params);
    const file = await prisma.fileAsset.findUnique({ where: { id } });
    if (!file || file.applicationId !== req.application!.id || file.deletedAt) {
      throw Errors.notFound('Arquivo');
    }

    await prisma.fileAsset.update({
      where: { id: file.id },
      data: { deletedAt: new Date() },
    });
    deleteFile(file.storedPath).catch((err) => {
      logger.warn({ err: (err as Error).message, id: file.id }, 'Falha ao remover arquivo do disco');
    });

    return { ok: true, data: { id: file.id, deleted: true } };
  });
};

function serializeFile(f: {
  id: string;
  collection: string;
  originalName: string;
  size: number;
  mimeType: string;
  sha256: string;
  createdAt: Date;
}) {
  return {
    id: f.id,
    collection: f.collection,
    originalName: f.originalName,
    size: f.size,
    mimeType: f.mimeType,
    sha256: f.sha256,
    createdAt: f.createdAt.toISOString(),
  };
}

export default routes;
