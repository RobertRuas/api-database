/**
 * logger.ts — Logger Pino compartilhado.
 *
 * Em dev usamos pino-pretty para legibilidade; em prod sai JSON puro,
 * que orquestradores conseguem agregar.
 */
import { pino } from 'pino';
import { config } from './config.js';

export const logger = pino({
  level: config.LOG_LEVEL,
  ...(config.isDev && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l', ignore: 'pid,hostname' },
    },
  }),
});
