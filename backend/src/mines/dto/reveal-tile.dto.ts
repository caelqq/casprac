// backend/src/mines/dto/reveal-tile.dto.ts

import { IsInt, IsString, Min } from 'class-validator';

// Validates the incoming request body for POST /mines/reveal.
export class RevealTileDto {
  @IsString()
  roundId: string;

  // Which tile the player clicked (0-based index into the grid).
  @IsInt()
  @Min(0)
  tileIndex: number;
}