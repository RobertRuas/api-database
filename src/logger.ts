/**
 * logger.ts — Config de logging compartilhada.
 *
 * `fastifyLoggerConfig` é passada para `Fastify({ logger })` — deixar o
 * Fastify construir sua própria pino interna evita conflitos de tipo nos
 * generics. `logger` é a instância para uso fora do request lifecycle
 * (bootstrap, shutdown, errors.ts).
 */
import { pino, type LoggerOptions } from 'pino';
import { config } from './config.js';

export const fastifyLoggerConfig: LoggerOptions = {
  level: config.LOG_LEVEL,
  ...(config.isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    },
  }),
};

export const logger = pino(fastifyLoggerConfig);
