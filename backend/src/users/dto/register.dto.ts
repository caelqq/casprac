// backend/src/users/dto/register.dto.ts

// Minimal shape check only — no format rules, per current project priorities.
// This just makes sure the three fields exist and are strings, so the
// service doesn't crash on missing data.

import { IsString } from 'class-validator';

export class RegisterDto {
  @IsString()
  username: string;

  @IsString()
  email: string;

  @IsString()
  password: string;
}