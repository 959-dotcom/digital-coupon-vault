import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';
import { resolve } from 'node:path';

loadEnv({ path: resolve(process.cwd(), '.env') });
loadEnv({ path: resolve(process.cwd(), '../../.env') });

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

export default nextConfig;
