import { createServer } from '../dist/vercel.js';

export default async function handler(req, res) {
  const forwarded = req.headers['x-forwarded-uri'] ?? req.headers['x-invoke-path'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    req.url = forwarded;
  }
  const server = await createServer();
  server(req, res);
}
