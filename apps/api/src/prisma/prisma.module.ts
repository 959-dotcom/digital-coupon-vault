import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { describeDatabaseUrl, resolveDatabaseUrl } from './database-url.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const configured = config.getOrThrow<string>('DATABASE_URL');
        console.error(`[db-shape] ${JSON.stringify(describeDatabaseUrl(configured))}`);
        const connectionString = await resolveDatabaseUrl(configured);
        return new PrismaService(connectionString);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
