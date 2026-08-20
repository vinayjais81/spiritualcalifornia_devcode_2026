import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { buildPoolConfig } from '../common/db-ssl';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);
  private pool: Pool;

  constructor() {
    // Pool size is set HERE, not in DATABASE_URL. Because we drive `pg`
    // directly through @prisma/adapter-pg, Prisma's own `connection_limit`
    // URL parameter is never read — putting it in the URL looks like it
    // works and silently does nothing.
    //
    // Read from process.env rather than ConfigService: this provider is
    // constructed before ConfigService is injectable, and process.env holds
    // the raw value regardless.
    const poolMax = Number(process.env.DATABASE_POOL_MAX) || 10;

    // buildPoolConfig adds the RDS CA when DATABASE_CA_CERT_PATH is set, so
    // TLS is verified rather than merely encrypted. See src/common/db-ssl.ts.
    const pool = new Pool(buildPoolConfig(process.env.DATABASE_URL, poolMax));
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
    });

    this.pool = pool;
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    await this.pool.end();
    this.logger.log('Database disconnected');
  }
}
