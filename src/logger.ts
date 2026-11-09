/**
 * logger.ts — Config de logging compartilhada.
 *
 * `pino-pretty` só é usado em dev — em produção a saída é JSON puro para
 * ser coletada por systemd/Docker. Em dev, tentamos carregar o transport
 * dinamicamente: se o pacote não estiver instalado (ex.: imagem de prod
 * sem devDeps), caímos silenciosamente para JSON.
 */
import { pino, type LoggerOptions } from 'pino';
import { createRequire } from 'node:module';
import { config } from './config.js';

function buildPrettyTransport(): LoggerOptions['transport'] | undefined {
  if (!config.isDev) return undefined;
  try {
    const req = createRequire(import.meta.url);
    req.resolve('pino-pretty');
    return {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    };
  } catch {
    return undefined;
  }
}

const transport = buildPrettyTransport();

export const fastifyLoggerConfig: LoggerOptions = {
  level: config.LOG_LEVEL,
  ...(transport && { transport }),
};

export const logger = pino(fastifyLoggerConfig);
