// backend/src/users/dto/tip.dto.ts

import { IsInt, IsNotEmpty, IsString, Min } from 'class-validator';

// Validates the incoming request body for POST /users/me/tip.
// NestJS's global ValidationPipe (set up in main.ts) runs these checks
// automatically before our controller method body ever executes.
export class TipDto {
  @IsString()
  @IsNotEmpty()
  recipientUsername: string;

  // Amount is always a whole number of CENTS, same reasoning as
  // balanceCents on the User model — never a decimal dollar amount, to
  // avoid floating-point rounding errors. The frontend is responsible
  // for converting a dollar input (e.g. "5.50") into cents (550) before
  // sending it here.
  //
  // @IsInt() rejects anything with a decimal point or that isn't a real
  // number. @Min(1) rejects zero, negative amounts, so someone can't
  // send a tip of $0 or try to send a "negative tip" to drain someone
  // else's balance into their own.
  @IsInt()
  @Min(1)
  amountCents: number;
}