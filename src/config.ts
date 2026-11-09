/**
 * config.ts — Fonte única de verdade das variáveis de ambiente.
 *
 * Por que validar com Zod? Para falhar no boot (não em runtime) se faltar
 * qualquer variável crítica. Nunca acesse `process.env` fora daqui.
 */
import 'dotenv/config';
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  PUBLIC_URL: z.string().url().default('http://localhost:3000'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL é obrigatório'),

  STORAGE_ROOT: z.string().default('./storage'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(100 * 1024 * 1024),

  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET precisa ter ao menos 32 chars'),
  COOKIE_NAME: z.string().default('apidb_session'),

  ADMIN_USERNAME: z.string().min(1),
  ADMIN_PASSWORD: z.string().min(8, 'ADMIN_PASSWORD precisa ter ao menos 8 chars'),

  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),
  LOGIN_RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // CORS — lista CSV de origens. `*` libera qualquer origem (sem cookies).
  ALLOWED_ORIGINS: z.string().default('*'),

  // Limites semânticos do documento JSON (defesa contra DoS / payload malicioso).
  JSON_MAX_BYTES: z.coerce.number().int().positive().default(1024 * 1024),
  JSON_MAX_DEPTH: z.coerce.number().int().min(2).max(256).default(32),
  JSON_MAX_KEYS: z.coerce.number().int().positive().default(5000),

  // Retenção de versões por documento (0 = sem limite).
  DOC_VERSION_RETENTION: z.coerce.number().int().min(0).default(100),

  SESSION_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(8 * 60 * 60),

  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  // Imprime erros amigáveis e aborta.
  console.error('[config] Variáveis de ambiente inválidas:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

const allowedOrigins = parsed.data.ALLOWED_ORIGINS
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const config = Object.freeze({
  ...parsed.data,
  ALLOWED_ORIGINS_LIST: allowedOrigins,
  CORS_ALLOW_ANY: allowedOrigins.includes('*'),
  isProd: parsed.data.NODE_ENV === 'production',
  isDev: parsed.data.NODE_ENV === 'development',
});

export type Config = typeof config;
