import './load-env.js';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';
import { AppModule } from './app.module.js';
import { configureApp } from './http-app.js';

let cached: express.Express | null = null;

export async function createServer(): Promise<express.Express> {
  if (cached) {
    return cached;
  }
  const server = express();
  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), { rawBody: true });
  await configureApp(app);
  await app.init();
  cached = server;
  return server;
}
