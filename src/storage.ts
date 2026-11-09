/**
 * storage.ts — Abstração de filesystem.
 *
 * Caminho previsível: <STORAGE_ROOT>/<appId>/<collection>/<YYYY>/<MM>/<uuid><ext>
 * Guardamos sha256 em stream para possível dedup/integridade futura.
 */
import { createHash, randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream, type ReadStream } from 'node:fs';
import { mkdir, stat, unlink } from 'node:fs/promises';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream/promises';
import { config } from './config.js';
import { Errors } from './errors.js';

const ROOT = resolve(config.STORAGE_ROOT);

/** Sanitiza nome de coleção/arquivo evitando traversal. */
function sanitizeSegment(segment: string): string {
  return segment.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 120);
}

export interface SaveResult {
  storedPath: string; // relativo a STORAGE_ROOT
  size: number;
  sha256: string;
}

/**
 * Salva um ReadStream no disco, calculando sha256 em paralelo.
 * Retorna os metadados prontos para o banco.
 */
export async function saveFile(
  applicationId: string,
  collection: string,
  originalName: string,
  stream: ReadStream | NodeJS.ReadableStream,
): Promise<SaveResult> {
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const ext = extname(originalName).slice(0, 20);
  const filename = `${randomUUID()}${ext}`;

  const relative = join(
    sanitizeSegment(applicationId),
    sanitizeSegment(collection),
    yyyy,
    mm,
    filename,
  );
  const absolute = join(ROOT, relative);

  await mkdir(dirname(absolute), { recursive: true });

  const hash = createHash('sha256');
  let size = 0;

  // Tee: ao gravar vamos atualizando o hash e contando bytes.
  const sink = createWriteStream(absolute);
  await pipeline(
    stream,
    async function* (source) {
      for await (const chunk of source as AsyncIterable<Buffer>) {
        hash.update(chunk);
        size += chunk.length;
        yield chunk;
      }
    },
    sink,
  );

  return { storedPath: relative, size, sha256: hash.digest('hex') };
}

/** Resolve caminho absoluto, garantindo que fica dentro de STORAGE_ROOT. */
export function resolveStoredPath(relative: string): string {
  const absolute = resolve(ROOT, relative);
  if (!absolute.startsWith(ROOT + sep) && absolute !== ROOT) {
    throw Errors.forbidden('Caminho inválido.');
  }
  return absolute;
}

/** Stream de leitura de um arquivo salvo. */
export async function readFile(relative: string): Promise<ReadStream> {
  const absolute = resolveStoredPath(relative);
  try {
    await stat(absolute);
  } catch {
    throw Errors.notFound('Arquivo');
  }
  return createReadStream(absolute);
}

/** Remove arquivo do disco (idempotente). */
export async function deleteFile(relative: string): Promise<void> {
  const absolute = resolveStoredPath(relative);
  try {
    await unlink(absolute);
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}
