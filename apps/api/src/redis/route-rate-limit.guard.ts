import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RateLimitService } from './rate-limit.service.js';

export const ROUTE_RATE_LIMIT = 'route_rate_limit';

export function RouteRateLimit(limit: number, ttlMs: number): MethodDecorator {
  return SetMetadata(ROUTE_RATE_LIMIT, {
    limit,
    windowSeconds: Math.max(1, Math.ceil(ttlMs / 1000)),
  });
}

type RouteLimit = { limit: number; windowSeconds: number };

@Injectable()
export class RouteRateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly rateLimit: RateLimitService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const spec = this.reflector.get<RouteLimit | undefined>(ROUTE_RATE_LIMIT, context.getHandler());
    if (!spec) {
      return true;
    }
    const request = context.switchToHttp().getRequest<{ user?: { userId?: string }; ip?: string }>();
    const tracker = request.user?.userId ?? request.ip ?? 'anonymous';
    await this.rateLimit.hit(`${context.getClass().name}:${context.getHandler().name}:${tracker}`, spec.limit, spec.windowSeconds);
    return true;
  }
}
