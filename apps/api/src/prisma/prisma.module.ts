import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { resolveDatabaseUrl } from './database-url.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const connectionString = await resolveDatabaseUrl(config.getOrThrow<string>('DATABASE_URL'));
        return new PrismaService(connectionString);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
