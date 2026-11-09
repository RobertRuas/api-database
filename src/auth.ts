/**
 * auth.ts — Middlewares e utilitários de autenticação.
 *
 * Dois tipos de identidade:
 *  - API Key (header `X-API-Key` ou `Authorization: Bearer`): usada pelas
 *    aplicações consumidoras. Vinculada a um `Application`.
 *  - Sessão admin: cookie assinado criado no login do painel.
 *
 * Hashing de API keys: HMAC-SHA256 com `SESSION_SECRET` como chave.
 * Keys são segredos de alta entropia (32 bytes random), então bcrypt é
 * desnecessário — HMAC é constant-time no `timingSafeEqual` e milhares de
 * vezes mais barato por request. Keys criadas em versões antigas usam
 * bcrypt (hash começa com `$2`); mantemos compat verificando o prefixo.
 */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from './config.js';
import { prisma } from './db.js';
import { Errors } from './errors.js';

// ---------- Hash da senha admin (cacheado em memória) ----------

/**
 * Cache do hash da senha admin. Evita re-hashear `ADMIN_PASSWORD` a cada
 * login quando a tabela `settings` ainda não foi populada. Invalidado ao
 * alterar a senha pelo painel.
 */
let adminHashCache: string | null = null;

export async function getAdminPasswordHash(): Promise<string> {
  if (adminHashCache) return adminHashCache;

  const row = await prisma.setting.findUnique({ where: { key: 'adminPasswordHash' } });
  if (row && typeof row.value === 'string') {
    adminHashCache = row.value;
    return adminHashCache;
  }
  // Primeiro boot: hasheia ADMIN_PASSWORD uma vez e persiste.
  const hash = await bcrypt.hash(config.ADMIN_PASSWORD, 12);
  await prisma.setting.upsert({
    where: { key: 'adminPasswordHash' },
    update: { value: hash },
    create: { key: 'adminPasswordHash', value: hash },
  });
  adminHashCache = hash;
  return hash;
}

export async function setAdminPasswordHash(nextPlain: string): Promise<void> {
  const hash = await bcrypt.hash(nextPlain, 12);
  await prisma.setting.upsert({
    where: { key: 'adminPasswordHash' },
    update: { value: hash },
    create: { key: 'adminPasswordHash', value: hash },
  });
  adminHashCache = hash;
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

// ---------- Hash de senha ----------

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

// ---------- Hash de API key ----------

/**
 * Calcula o HMAC-SHA256 hex do token usando SESSION_SECRET como chave.
 * Determinístico — permite lookup direto no banco em O(1).
 */
function hmacApiKey(token: string): string {
  return createHmac('sha256', config.SESSION_SECRET).update(token).digest('hex');
}

/** Comparação constant-time de strings hex. */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return timingSafeEqual(ab, bb);
}

/** Gera uma API key nova. Retorna o token em claro + o hash para armazenar. */
export async function createApiKey(): Promise<{ token: string; prefix: string; hash: string }> {
  // Formato: apidb_live_<32 bytes em base64url>
  const secret = randomBytes(32).toString('base64url');
  const token = `apidb_live_${secret}`;
  const prefix = token.slice(0, 16); // ex: apidb_live_AbCd
  const hash = hmacApiKey(token);
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

    const prefix = raw.slice(0, 16);
    const candidates = await prisma.apiKey.findMany({
      where: { prefix, revokedAt: null },
      include: { application: true },
    });

    for (const candidate of candidates) {
      const ok = await verifyApiKey(raw, candidate.hash);
      if (!ok) continue;
      if (!candidate.application.active) throw Errors.forbidden('Aplicação desativada.');

      for (const scope of required) {
        if (!candidate.scopes.includes(scope)) {
          throw Errors.forbidden(`Escopo insuficiente: requer "${scope}".`);
        }
      }

      req.application = { id: candidate.applicationId, name: candidate.application.name };
      req.apiKey = { id: candidate.id, scopes: candidate.scopes };

      // Atualiza lastUsedAt (e, se preciso, migra hash legado) fire-and-forget.
      const updates: { lastUsedAt: Date; hash?: string } = { lastUsedAt: new Date() };
      if (isLegacyBcryptHash(candidate.hash)) updates.hash = hmacApiKey(raw);
      prisma.apiKey
        .update({ where: { id: candidate.id }, data: updates })
        .catch(() => {});
      return;
    }

    throw Errors.unauthorized('API key inválida ou revogada.');
  };
}

function isLegacyBcryptHash(hash: string): boolean {
  return hash.startsWith('$2');
}

async function verifyApiKey(token: string, storedHash: string): Promise<boolean> {
  if (isLegacyBcryptHash(storedHash)) {
    // Compat: tokens criados antes da migração para HMAC.
    return bcrypt.compare(token, storedHash);
  }
  return safeEqualHex(hmacApiKey(token), storedHash);
}

function extractToken(req: FastifyRequest): string | null {
  const header = req.headers['x-api-key'];
  if (typeof header === 'string' && header.length > 0) return header.trim();

  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) return auth.slice(7).trim();

  return null;
}

/** Fingerprint curto do token para logs/rate-limit sem revelar o segredo. */
export function fingerprintToken(token: string): string {
  return createHash('sha256').update(token).digest('hex').slice(0, 16);
}

// ---------- Middleware: Admin (sessão por cookie) ----------

/** Payload simples do cookie — nome do usuário + timestamp de emissão. */
interface SessionPayload {
  u: string;
  iat: number; // ms
}

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
    const parsed = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (
      typeof parsed !== 'object' || parsed === null ||
      typeof parsed.u !== 'string' || typeof parsed.iat !== 'number'
    ) return null;
    return parsed as SessionPayload;
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
    maxAge: config.SESSION_MAX_AGE_SECONDS,
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
  // Validação server-side do iat (defesa em profundidade além do maxAge do cookie).
  const ageMs = Date.now() - payload.iat;
  if (ageMs < 0 || ageMs > config.SESSION_MAX_AGE_SECONDS * 1000) {
    throw Errors.unauthorized('Sessão expirada.');
  }
  req.admin = { username: payload.u };
}
