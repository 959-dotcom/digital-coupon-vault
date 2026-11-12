import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { databaseUserIsExpected, resolveDatabaseUrl } from './database-url.js';
import { PrismaService } from './prisma.service.js';

@Global()
@Module({
  providers: [
    {
      provide: PrismaService,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => {
        const configured = config.getOrThrow<string>('DATABASE_URL');
        console.error(`[db-user-expected] ${databaseUserIsExpected(configured)}`);
        const connectionString = await resolveDatabaseUrl(configured);
        return new PrismaService(connectionString);
      },
    },
  ],
  exports: [PrismaService],
})
export class PrismaModule {}
