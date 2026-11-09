/**
 * auth.ts — Middlewares e utilitários de autenticação.
 *
 * Dois tipos de identidade:
 *  - API Key (header `X-API-Key` ou `Authorization: Bearer`): usada pelas
 *    aplicações consumidoras. Vinculada a um `Application`.
 *  - Sessão admin: cookie assinado criado no login do painel.
 */
import { randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { prisma } from './db.js';
import { Errors } from './errors.js';

/**
 * Hash da senha admin — lê primeiro da tabela `settings` (chave `adminPasswordHash`);
 * se vazia, usa o valor do .env (ADMIN_PASSWORD) e hasheia em memória.
 * Após uma troca via painel, o hash persistido vence sobre o .env.
 */
export async function getAdminPasswordHash(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: 'adminPasswordHash' } });
  if (row && typeof row.value === 'string') return row.value;
  return bcrypt.hash(config.ADMIN_PASSWORD, 12);
}

export async function setAdminPasswordHash(nextPlain: string): Promise<void> {
  const hash = await bcrypt.hash(nextPlain, 12);
  await prisma.setting.upsert({
    where: { key: 'adminPasswordHash' },
    update: { value: hash },
    create: { key: 'adminPasswordHash', value: hash },
  });
}

// ---------- Tipos auxiliares ----------

declare module 'fastify' {
  interface FastifyRequest {
    application?: { id: string; name: string };
    apiKey?: { id: string; scopes: string[] };
    admin?: { username: string };
  }
}

export type Scope = 'read' | 'write' | 'delete' | 'files';

// ---------- Hash de senha / API key ----------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Gera uma API key nova. Retorna o token em claro + o hash para armazenar. */
export async function createApiKey(): Promise<{ token: string; prefix: string; hash: string }> {
  // Formato: apidb_live_<32 bytes em base64url>
  const secret = randomBytes(32).toString('base64url');
  const token = `apidb_live_${secret}`;
  const prefix = token.slice(0, 16); // ex: apidb_live_AbCd
  const hash = await bcrypt.hash(token, 10);
  return { token, prefix, hash };
}

// ---------- Middleware: API Key ----------

/**
 * Exige API key válida. Opcionalmente valida escopos.
 *
 * Uso:
 *   fastify.get('/foo', { preHandler: apiKeyAuth('read') }, handler)
 */
export function apiKeyAuth(...required: Scope[]) {
  return async (req: FastifyRequest, _reply: FastifyReply) => {
    const raw = extractToken(req);
    if (!raw) throw Errors.unauthorized('API key ausente. Envie no header X-API-Key.');

    // O prefix nos permite restringir a busca sem escanear a tabela inteira.
    const prefix = raw.slice(0, 16);
    const candidates = await prisma.apiKey.findMany({
      where: { prefix, revokedAt: null },
      include: { application: true },
    });

    for (const candidate of candidates) {
      // bcrypt.compare é constant-time o suficiente para evitar timing attacks.
      // eslint-disable-next-line no-await-in-loop
      const ok = await bcrypt.compare(raw, candidate.hash);
      if (!ok) continue;
      if (!candidate.application.active) throw Errors.forbidden('Aplicação desativada.');

      // Verifica escopos solicitados.
      for (const scope of required) {
        if (!candidate.scopes.includes(scope)) {
          throw Errors.forbidden(`Escopo insuficiente: requer "${scope}".`);
        }
      }

      req.application = { id: candidate.applicationId, name: candidate.application.name };
      req.apiKey = { id: candidate.id, scopes: candidate.scopes };

      // Atualiza lastUsedAt de forma fire-and-forget.
      prisma.apiKey
        .update({ where: { id: candidate.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});
      return;
    }

    throw Errors.unauthorized('API key inválida ou revogada.');
  };
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.length > 0) return header.trim();

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();

  return null;
}

// ---------- Middleware: Admin (sessão por cookie) ----------

/** Payload simples do cookie — só o nome do usuário. */
interface SessionPayload {
  u: string;
  iat: number;
}

/** Codifica/decodifica usando HMAC embutido (sem dep extra). */
import { createHmac, timingSafeEqual } from 'node:crypto';

function sign(payload: SessionPayload): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const mac = createHmac('sha256', config.SESSION_SECRET).update(body).digest('base64url');
  return `${body}.${mac}`;
}

function unsign(token: string): SessionPayload | null {
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const expected = createHmac('sha256', config.SESSION_SECRET).update(body).digest('base64url');
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function issueAdminSession(reply: FastifyReply, username: string) {
  const token = sign({ u: username, iat: Date.now() });
  reply.setCookie(config.COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 60 * 60 * 8, // 8 horas
  });
}

export function clearAdminSession(reply: FastifyReply) {
  reply.clearCookie(config.COOKIE_NAME, { path: '/' });
}

export async function adminAuth(req: FastifyRequest, _reply: FastifyReply) {
  const token = req.cookies?.[config.COOKIE_NAME];
  if (!token) throw Errors.unauthorized('Sessão administrativa necessária.');
  const payload = unsign(token);
  if (!payload || payload.u !== config.ADMIN_USERNAME) {
    throw Errors.unauthorized('Sessão inválida.');
  }
  req.admin = { username: payload.u };
}
