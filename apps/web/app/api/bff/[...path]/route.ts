import { createHmac, randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';

const API = process.env.API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:4000';

async function proxy(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const pathname = `/${path.join('/')}`;
  const method = request.method.toUpperCase();
  const target = `${API}${pathname}${request.nextUrl.search}`;
  const body = method === 'GET' || method === 'HEAD' ? undefined : await request.text();
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  if (authorization) {
    headers.set('authorization', authorization);
  }
  const idempotency = request.headers.get('idempotency-key');
  if (idempotency) {
    headers.set('idempotency-key', idempotency);
  }
  if (body) {
    headers.set('content-type', 'application/json');
  }
  if (method !== 'GET' && method !== 'HEAD') {
    const secret = process.env.HMAC_SECRET;
    if (!secret) {
      return NextResponse.json({ message: 'INTERNAL' }, { status: 500 });
    }
    const timestamp = Date.now().toString();
    const nonce = randomUUID();
    const rawBody = body ?? '';
    const payload = `${method}|${pathname}|${timestamp}|${nonce}|${rawBody}`;
    const signature = createHmac('sha256', secret).update(payload).digest('hex');
    headers.set('x-timestamp', timestamp);
    headers.set('x-nonce', nonce);
    headers.set('x-signature', signature);
  }
  const upstream = await fetch(target, {
    method,
    headers,
    body: body && body.length > 0 ? body : undefined,
    cache: 'no-store',
  });
  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'content-type': upstream.headers.get('content-type') ?? 'application/json' },
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const PUT = proxy;
export const DELETE = proxy;
