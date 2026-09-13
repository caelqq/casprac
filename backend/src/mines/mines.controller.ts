// backend/src/mines/mines.controller.ts

import { Body, Controller, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { MinesService } from './mines.service';
import { UsersService } from '../users/users.service';
import { StartRoundDto } from './dto/start-round.dto';
import { RevealTileDto } from './dto/reveal-tile.dto';
import { CashoutDto } from './dto/cashout.dto';

@Controller('mines')
export class MinesController {
  constructor(
    private readonly minesService: MinesService,
    private readonly usersService: UsersService,
  ) {}

  // Same manual cookie-check pattern used everywhere else in this app —
  // we read auth_token ourselves, verify it via usersService, and only
  // then let the real logic run. Repeated in each method below rather
  // than factored into a shared Guard, matching how the rest of this
  // codebase currently works (no Guards used anywhere yet).
  private async getAuthenticatedUserId(req: Request): Promise<string> {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    const currentUser = await this.usersService.getUserFromToken(token);
    return currentUser.id;
  }

  @Post('start')
  async start(@Body() dto: StartRoundDto, @Req() req: Request) {
    const userId = await this.getAuthenticatedUserId(req);

    return this.minesService.startRound(
      userId,
      dto.betCents,
      dto.totalTiles,
      dto.minesCount,
    );
  }

  @Post('reveal')
  async reveal(@Body() dto: RevealTileDto, @Req() req: Request) {
    const userId = await this.getAuthenticatedUserId(req);

    return this.minesService.revealTile(userId, dto.roundId, dto.tileIndex);
  }

  @Post('cashout')
  async cashout(@Body() dto: CashoutDto, @Req() req: Request) {
    const userId = await this.getAuthenticatedUserId(req);

    return this.minesService.cashOut(userId, dto.roundId);
  }
}