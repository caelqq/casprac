// backend/src/users/dto/change-email.dto.ts
//
// Defines the shape and validation rules for the "change email" request
// body. NestJS's ValidationPipe (already enabled globally in main.ts)
// automatically checks incoming requests against these rules BEFORE our
// controller code ever runs — so if someone sends garbage, it's
// rejected with a 400 error automatically, no manual checking needed.

import { IsEmail, IsNotEmpty } from 'class-validator';

export class ChangeEmailDto {
  // @IsEmail() checks it's a structurally valid email address
  // (something@something.something). @IsNotEmpty() rejects an empty
  // string. Between the two, obviously malformed input never reaches
  // our actual business logic in users.service.ts.
  @IsEmail()
  @IsNotEmpty()
  newEmail: string;
}