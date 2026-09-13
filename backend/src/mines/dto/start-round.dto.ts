// backend/src/mines/dto/start-round.dto.ts

import { IsInt, Min } from 'class-validator';

// Validates the incoming request body for POST /mines/start. Same
// pattern as TipDto — NestJS's global ValidationPipe runs these checks
// automatically before the controller method body ever executes.
export class StartRoundDto {
  // Bet amount in CENTS, never a decimal dollar amount — same reasoning
  // as every other money field in this app.
  @IsInt()
  @Min(1)
  betCents: number;

  // Total tiles on the board (16, 25, 36, 49, or 64 depending on grid
  // size). We don't restrict this to an enum here — mines.service.ts
  // re-validates the mines count against it either way, so an invalid
  // totalTiles just results in a harmless mismatch, not a security hole.
  @IsInt()
  @Min(4)
  totalTiles: number;

  @IsInt()
  @Min(1)
  minesCount: number;
}