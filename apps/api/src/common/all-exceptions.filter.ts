import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { asDomainError } from './domain-error.js';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const domain = asDomainError(exception);
    if (domain) {
      response.status(domain.status).json({
        statusCode: domain.status,
        message: domain.code,
        error: domain.code,
      });
      return;
    }
    if (exception instanceof HttpException && exception.getStatus() === 429) {
      response.status(429).json({ statusCode: 429, message: 'RATE_LIMITED', error: 'RATE_LIMITED' });
      return;
    }
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message = typeof body === 'string' ? body : messageOf(body);
      response.status(status).json({ statusCode: status, message, error: exception.name });
      return;
    }
    this.logger.error(exception instanceof Error ? exception.stack : String(exception));
    response.status(500).json({ statusCode: 500, message: 'INTERNAL', error: 'INTERNAL' });
  }
}

function messageOf(body: unknown): string | string[] {
  if (body && typeof body === 'object' && 'message' in body) {
    const message = (body as { message?: unknown }).message;
    if (typeof message === 'string' || Array.isArray(message)) {
      return message as string | string[];
    }
  }
  return 'INTERNAL';
}
