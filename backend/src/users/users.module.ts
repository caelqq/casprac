// backend/src/users/users.module.ts

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    // Registers NestJS's JWT helper for this module. We read the secret
    // from our .env file (never hardcode it directly in source code —
    // that would defeat the purpose of keeping it in .env in the first
    // place). We also set a default expiry here: after 7 days, a token
    // stops being valid and the user will need to log in again.
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '7d' },
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  // Exposes UsersService to any OTHER module that imports UsersModule.
  // Without this, UsersService would stay private to UsersModule only —
  // even importing UsersModule elsewhere wouldn't be enough to use it.
  // MinesModule needs this so MinesController can verify the logged-in
  // user's JWT cookie the same way every other protected route does.
  exports: [UsersService],
})
export class UsersModule {}