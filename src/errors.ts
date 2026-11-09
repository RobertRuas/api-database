/**
 * errors.ts — Erros tipados + handler global.
 *
 * Toda exceção que chegar ao Fastify passa por `errorHandler`,
 * que normaliza a resposta para o shape `{ ok:false, error:{code,message} }`.
 */
import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { ZodError } from 'zod';
import { logger } from './logger.js';

export class AppError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Atalhos para erros frequentes — mantém call sites curtos.
export const Errors = {
  notFound: (what = 'Recurso') => new AppError('NOT_FOUND', `${what} não encontrado.`, 404),
  unauthorized: (msg = 'Credenciais ausentes ou inválidas.') =>
    new AppError('UNAUTHORIZED', msg, 401),
  forbidden: (msg = 'Acesso negado.') => new AppError('FORBIDDEN', msg, 403),
  conflict: (msg: string) => new AppError('CONFLICT', msg, 409),
  tooLarge: (msg = 'Arquivo excede o limite permitido.') =>
    new AppError('PAYLOAD_TOO_LARGE', msg, 413),
  badRequest: (msg: string, details?: unknown) =>
    new AppError('BAD_REQUEST', msg, 400, details),
  internal: (msg = 'Erro interno. Tente novamente.') =>
    new AppError('INTERNAL_ERROR', msg, 500),
};

/** Handler global registrado no Fastify. */
export function errorHandler(
  err: FastifyError | AppError | ZodError | Error,
  req: FastifyRequest,
  reply: FastifyReply,
) {
  // Validação Zod → 400 com detalhes.
  if (err instanceof ZodError) {
    return reply.code(400).send({
      ok: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos.',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }

  // Erro de negócio tipado.
  if (err instanceof AppError) {
    return reply.code(err.status).send({
      ok: false,
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Erros do Fastify (validação de schema, payload inválido, etc).
  const fastifyErr = err as FastifyError;
  if (fastifyErr.statusCode && fastifyErr.statusCode < 500) {
    return reply.code(fastifyErr.statusCode).send({
      ok: false,
      error: { code: fastifyErr.code ?? 'BAD_REQUEST', message: fastifyErr.message },
    });
  }

  // Qualquer coisa não tratada → 500 genérico; detalhes só no log.
  logger.error({ err, path: req.url, method: req.method }, 'Unhandled error');
  return reply.code(500).send({
    ok: false,
    error: { code: 'INTERNAL_ERROR', message: 'Erro interno.' },
  });
}
