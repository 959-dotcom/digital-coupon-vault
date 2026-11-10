import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

const webDir = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  ...(process.env.VERCEL
    ? {}
    : {
        output: 'standalone' as const,
        outputFileTracingRoot: resolve(webDir, '../..'),
      }),
};

export default nextConfig;
