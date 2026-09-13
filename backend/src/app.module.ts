// backend/src/app.module.ts

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './users/users.module';
import { ChatModule } from './chat/chat.module';
import { MinesModule } from './mines/mines.module';

@Module({
  imports: [PrismaModule, UsersModule, ChatModule, MinesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}