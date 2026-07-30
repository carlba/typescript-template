import { z } from 'zod';

export const envSchema = z
  .object({
    NODE_ENV: z
      .string()
      .trim()
      .default('development')
      .pipe(z.enum(['production', 'development', 'test'])),
    LOG_LEVEL: z
      .string()
      .trim()
      .default('debug')
      .pipe(z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal'])),
  })
  .transform(raw => ({
    NODE_ENV: raw.NODE_ENV,
    isDevelopment: raw.NODE_ENV !== 'production',
    logLevel: raw.LOG_LEVEL,
  }));

export type Config = z.infer<typeof envSchema>;
