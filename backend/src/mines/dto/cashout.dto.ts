// backend/src/mines/dto/cashout.dto.ts

import { IsString } from 'class-validator';

// Validates the incoming request body for POST /mines/cashout.
export class CashoutDto {
  @IsString()
  roundId: string;
}