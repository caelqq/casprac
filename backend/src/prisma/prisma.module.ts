// backend/src/prisma/prisma.module.ts

import { Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Marking PrismaService as "global" here (via @Global() would also work,
// but exporting it explicitly like this is clearer for a small project)
// means any other module that imports PrismaModule can inject PrismaService
// into its own services/controllers.
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}