// backend/src/users/users.controller.ts

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  Res,
  UseInterceptors,
  UploadedFile,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangeEmailDto } from './dto/change-email.dto';
import { TipDto } from './dto/tip.dto';
import { avatarUploadOptions } from './avatar-upload.config';

// How long the cookie itself should live in the browser, in milliseconds.
// This should match (or be shorter than) the JWT's own expiry (7d, set in
// users.module.ts) — no point in a cookie outliving the token inside it.
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  async register(
    @Body() dto: RegisterDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.usersService.register(dto);
    this.setAuthCookie(res, token);
    return user;
  }

  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { user, token } = await this.usersService.login(dto);
    this.setAuthCookie(res, token);
    return user;
  }

  // The "who am I" check. The frontend calls this on every page load.
  // If there's a valid auth_token cookie, we return the current user.
  // If not (missing, expired, or tampered), UsersService throws
  // UnauthorizedException, which Nest automatically turns into a 401.
  @Get('me')
  async me(@Req() req: Request) {
    const token = req.cookies?.auth_token;

    if (!token) {
      // Same 401 shape as an invalid token, so the frontend can treat
      // "no cookie" and "bad cookie" identically: just "not logged in."
      return this.usersService.getUserFromToken('');
    }

    return this.usersService.getUserFromToken(token);
  }

  // Returns the logged-in user's real wallet balance (in cents). Same
  // manual cookie-check pattern as every other "me/..." route on this
  // controller: we read auth_token ourselves, verify it, and only then
  // fetch data — we NEVER accept a userId from the client for this.
  @Get('me/balance')
  async getBalance(@Req() req: Request) {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    const currentUser = await this.usersService.getUserFromToken(token);

    return this.usersService.getBalance(currentUser.id);
  }

  // Sends a tip from the logged-in user to another user by username.
  // Same manual cookie-check pattern as every other "me/..." route —
  // the sender's identity comes ONLY from their verified JWT cookie,
  // never from anything in the request body. TipDto (validated
  // automatically by our global ValidationPipe) guarantees
  // recipientUsername is a non-empty string and amountCents is a
  // positive whole number before this method body even runs.
  @Post('me/tip')
  async tip(@Body() dto: TipDto, @Req() req: Request) {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    const currentUser = await this.usersService.getUserFromToken(token);

    return this.usersService.tipUser(
      currentUser.id,
      dto.recipientUsername,
      dto.amountCents,
    );
  }

  // Uploads (or replaces) the current logged-in user's avatar image.
  // Auth check follows the exact same manual cookie pattern as the rest
  // of this controller — we read auth_token ourselves and verify it via
  // getUserFromToken, rather than trusting anything the client claims
  // about who they are. The actual file validation (type/size/naming)
  // lives in avatar-upload.config.ts, applied via FileInterceptor below.
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('avatar', avatarUploadOptions))
  async uploadAvatar(
    @UploadedFile() file: Express.Multer.File,
    @Req() req: Request,
  ) {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    // Re-verifies the token AND re-fetches the user fresh from the
    // database — same trust model as every other route here.
    const currentUser = await this.usersService.getUserFromToken(token);

    if (!file) {
      throw new BadRequestException('No file was uploaded');
    }

    // This is the PUBLIC path the frontend will use in an <img src="">
    // tag, e.g. "/uploads/avatars/3f2c1a...-e91.jpg". The actual file
    // sits on disk at backend/uploads/avatars/<filename>, and main.ts
    // is configured to serve that folder at this exact URL prefix.
    const avatarUrl = `/uploads/avatars/${file.filename}`;

    return this.usersService.updateAvatar(currentUser.id, avatarUrl);
  }

  // Changes the logged-in user's email address. Same manual cookie auth
  // pattern as every other protected route here — we never trust a
  // userId sent in the request body, only the one baked into the
  // caller's own verified JWT cookie. ChangeEmailDto (validated
  // automatically by our global ValidationPipe in main.ts) guarantees
  // `newEmail` is at least a structurally valid email string before this
  // method body even runs. The actual cooldown + uniqueness checks live
  // in usersService.changeEmail.
  @Post('me/email')
  async changeEmail(@Body() dto: ChangeEmailDto, @Req() req: Request) {
    const token = req.cookies?.auth_token;
    if (!token) {
      throw new UnauthorizedException('Not logged in');
    }

    const currentUser = await this.usersService.getUserFromToken(token);

    return this.usersService.changeEmail(currentUser.id, dto.newEmail);
  }

  // Public profile lookup — used by the chat "click a username" popup.
  // Intentionally has NO auth check: viewing someone's public profile
  // (username, level, join date) shouldn't require being logged in
  // yourself, same as clicking a username on the real site. The service
  // method is responsible for only ever returning safe, non-sensitive
  // fields (never email, passwordHash, etc).
  @Get(':id/profile')
  async getPublicProfile(@Param('id') id: string) {
    return this.usersService.getPublicProfile(id);
  }

  // Clears the auth_token cookie. Note: with plain JWTs, the token itself
  // technically remains "valid" until it naturally expires (7 days) — we
  // can't force-invalidate it server-side without a blocklist. But since
  // the cookie is httpOnly (frontend JS can never read or resend it once
  // cleared) and the browser deletes it, this is effectively a full logout
  // for any normal user. This is one of the tradeoffs of JWTs we discussed
  // earlier, vs. database-backed sessions.
  @Post('logout')
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('auth_token');
    return { message: 'Logged out' };
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie('auth_token', token, {
      // httpOnly: JavaScript in the browser (e.g. document.cookie) can
      // NEVER read this cookie. This is our main defense against a
      // malicious script (from an XSS bug) stealing a user's login token.
      httpOnly: true,
      // secure: only send this cookie over HTTPS. We keep this false for
      // now since we're developing on plain http://localhost — we will
      // need to set this to true once this is ever deployed for real.
      secure: false,
      // sameSite: 'lax' is a reasonable default that still allows our
      // frontend (different port, but same "site") to send the cookie.
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
    });
  }
}