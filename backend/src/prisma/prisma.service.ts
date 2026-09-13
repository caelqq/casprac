// backend/src/prisma/prisma.service.ts

import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma';
import { PrismaPg } from '@prisma/adapter-pg';

// This service wraps Prisma's database client so the rest of our NestJS
// app can inject it (via dependency injection) instead of creating a new
// database connection everywhere it's needed. One shared connection pool
// is more efficient and easier to manage than many separate ones.
//
// As of Prisma 7, PrismaClient no longer connects to the database on its
// own — it requires a "driver adapter" that knows how to actually talk
// to your specific database engine (here, PostgreSQL via the `pg` package).
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
});

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    super({ adapter });
  }

  // Runs automatically when this module starts up.
  // Opens the connection to PostgreSQL.
  async onModuleInit() {
    await this.$connect();
  }

  // Runs automatically when the app shuts down.
  // Cleanly closes the database connection instead of leaving it hanging.
  async onModuleDestroy() {
    await this.$disconnect();
  }
}