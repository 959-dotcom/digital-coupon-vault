import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

const SECRET_KEYS = ['JWT_SECRET', 'SERVER_VAULT_SECRET', 'HMAC_SECRET'] as const;

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  const config = app.get(ConfigService);
  for (const key of ['DATABASE_URL', 'REDIS_URL', ...SECRET_KEYS]) {
    const value = config.get<string>(key);
    if (!value || (SECRET_KEYS.includes(key as (typeof SECRET_KEYS)[number]) && value.length < 32)) {
      throw new Error(`${key} must be set`);
    }
  }
  const http = app.getHttpAdapter().getInstance() as { set: (key: string, value: number) => void };
  http.set('trust proxy', 1);
  const corsOrigin = config.get<string>('CORS_ORIGIN');
  const origin = corsOrigin && corsOrigin.trim().length > 0 ? corsOrigin : config.get<string>('WEB_ORIGIN');
  app.enableCors({
    origin: origin ? origin.split(',').map((item) => item.trim()).filter((item) => item.length > 0) : true,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const port = Number(config.get<string>('API_PORT') ?? '4000');
  await app.listen(port, '0.0.0.0');
}

bootstrap().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
