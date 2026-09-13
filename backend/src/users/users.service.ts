// backend/src/users/users.service.ts

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import * as bcrypt from 'bcrypt';

interface JwtPayload {
  sub: string;
  username: string;
}

// How long a user must wait between successful email changes.
// Kept as a single constant so the cooldown length is easy to find and
// change later if needed.
const EMAIL_CHANGE_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  // Builds the JWT "payload" — the data we're sealing onto the badge.
  // Keep this minimal: just enough to identify the user, nothing sensitive
  // like their password or email. Anyone who inspects a JWT can decode
  // (not forge, but read) its payload, so never put secrets in here.
  private generateToken(user: { id: string; username: string }) {
    const payload: JwtPayload = { sub: user.id, username: user.username };
    return this.jwtService.sign(payload);
  }

  async register(dto: RegisterDto) {
    const existingUsername = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });
    if (existingUsername) {
      throw new ConflictException('That username is already taken');
    }

    const existingEmail = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingEmail) {
      throw new ConflictException('That email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        username: dto.username,
        email: dto.email,
        passwordHash,
      },
    });

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { username: dto.username },
    });

    // Deliberately vague error message — we don't tell the caller whether
    // the username or the password was wrong.
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      throw new UnauthorizedException('Invalid username or password');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
      },
      token,
    };
  }

  // Used by GET /users/me. Takes the raw cookie value, verifies its
  // signature and expiry using our JWT_SECRET, then re-fetches the user
  // fresh from the database (rather than trusting the payload alone) —
  // this way, if a user was ever deleted or renamed after the token was
  // issued, we always reflect current, accurate data.
  async getUserFromToken(token: string) {
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      // Covers both a tampered/invalid signature AND an expired token.
      throw new UnauthorizedException('Invalid or expired session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    return {
      id: user.id,
      username: user.username,
      email: user.email,
      avatarUrl: user.avatarUrl,
    };
  }

  // Saves a new avatar path for the given user and returns the updated,
  // safe-to-send-to-frontend fields. Called by POST /users/me/avatar
  // after multer has already saved the physical file to disk — this
  // method only ever deals with the STRING PATH, never raw file bytes.
  async updateAvatar(userId: string, avatarUrl: string) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    return user;
  }

  // Changes the logged-in user's email address, enforcing a 7-day
  // cooldown between changes. Called by POST /users/me/email.
  //
  // Security notes:
  // - userId is ALWAYS the ID from the caller's verified JWT cookie
  //   (checked in the controller) — never trusted from the request body.
  //   This means a user can only ever change their OWN email, never
  //   someone else's, no matter what they send.
  // - The cooldown check happens server-side, using the DATABASE's
  //   lastEmailChangeAt value, not anything the client claims. A client
  //   could lie about "when they last changed it" if we trusted the
  //   frontend, so we never do.
  // - We re-check email uniqueness here too (not just at registration),
  //   since two different users could otherwise end up with the same
  //   email if we didn't.
  async changeEmail(userId: string, newEmail: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Reject "changing" to the exact same email you already have — this
    // isn't a real change, and allowing it would needlessly burn a
    // cooldown cycle for nothing.
    if (user.email.toLowerCase() === newEmail.toLowerCase()) {
      throw new ConflictException('That is already your current email');
    }

    // Cooldown check. If lastEmailChangeAt is null, the user has never
    // changed their email before, so no cooldown applies yet.
    if (user.lastEmailChangeAt) {
      const nextAllowedChangeAt = new Date(
        user.lastEmailChangeAt.getTime() + EMAIL_CHANGE_COOLDOWN_MS,
      );
      const now = new Date();

      if (now < nextAllowedChangeAt) {
        const msRemaining = nextAllowedChangeAt.getTime() - now.getTime();
        const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));

        throw new ForbiddenException(
          `You can change your email again in ${daysRemaining} day${
            daysRemaining === 1 ? '' : 's'
          }.`,
        );
      }
    }

    // Make sure no OTHER user already has this email. We exclude the
    // current user's own row from this check (though it's already
    // handled by the "same email" check above, this is a safe backstop).
    const emailTaken = await this.prisma.user.findUnique({
      where: { email: newEmail },
    });

    if (emailTaken && emailTaken.id !== userId) {
      throw new ConflictException('That email is already in use');
    }

    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
        lastEmailChangeAt: new Date(),
      },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
      },
    });

    return updatedUser;
  }

  // Used by GET /users/:id/profile — the chat "click a username" popup.
  // This is a PUBLIC lookup (no token needed), so we're extra careful
  // here: `select` is an explicit whitelist of only the fields that are
  // safe to show to anyone. We deliberately do NOT select email,
  // passwordHash, registrationIp, or the lockout fields — even by
  // accident — because select only returns what we list, nothing more.
  async getPublicProfile(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        level: true,
        createdAt: true,
        avatarUrl: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  // Returns the logged-in user's real wallet balance. Called by
  // GET /users/me/balance.
  //
  // SECURITY NOTE: `userId` here always comes from the caller's verified
  // JWT cookie (checked in the controller, same as every other "me/..."
  // route) — never from anything the client could type into a URL or
  // request body. This is what makes it impossible for user A to read
  // user B's balance by just guessing an ID.
  //
  // `select` is used (instead of returning the whole user row) so this
  // endpoint can NEVER accidentally leak the password hash, email, or
  // any other sensitive field — only the one number it's meant to return.
  async getBalance(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        balanceCents: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      balanceCents: user.balanceCents,
    };
  }

  // Moves money from the logged-in sender to another user by username.
  // Called by POST /users/me/tip.
  //
  // Security / correctness notes:
  // - `senderId` always comes from the caller's verified JWT cookie
  //   (checked in the controller) — a user can only ever spend their
  //   OWN balance, never anyone else's, no matter what they send.
  // - The whole operation runs inside `prisma.$transaction`, which means
  //   every write inside it either ALL succeed together, or (if any step
  //   throws) ALL of them are rolled back as if nothing happened. There
  //   is no possible outcome where the sender loses money but the
  //   recipient never receives it, or vice versa.
  // - The balance check and the deduction happen as ONE atomic database
  //   write (`updateMany` with a `balanceCents: { gte: amountCents }`
  //   condition), not as a separate "read balance, then decide, then
  //   write" sequence. This closes the race-condition window where two
  //   simultaneous tips could otherwise both pass a balance check before
  //   either one actually subtracts, driving the balance negative.
  async tipUser(senderId: string, recipientUsername: string, amountCents: number) {
    return this.prisma.$transaction(async (tx) => {
      const recipient = await tx.user.findUnique({
        where: { username: recipientUsername },
        select: { id: true, username: true },
      });

      if (!recipient) {
        throw new NotFoundException(
          `No user found with username "${recipientUsername}"`,
        );
      }

      if (recipient.id === senderId) {
        throw new BadRequestException('You cannot tip yourself');
      }

      // Atomic "check and subtract in one step". The WHERE clause means
      // Postgres only performs the update at all if balanceCents is
      // still >= amountCents at the exact moment it writes — and it's
      // guaranteed no other transaction can sneak in a conflicting write
      // in between the check and the write, because they're the SAME
      // database operation, not two separate ones.
      const deductResult = await tx.user.updateMany({
        where: {
          id: senderId,
          balanceCents: { gte: amountCents },
        },
        data: {
          balanceCents: { decrement: amountCents },
        },
      });

      // updateMany returns a count of how many rows it actually changed.
      // If it's 0, either the sender's balance was too low, or (in a
      // scenario that shouldn't be reachable here since the controller
      // already verified the token) the sender row didn't exist.
      if (deductResult.count === 0) {
        throw new ForbiddenException('Insufficient balance');
      }

      await tx.user.update({
        where: { id: recipient.id },
        data: { balanceCents: { increment: amountCents } },
      });

      const updatedSender = await tx.user.findUnique({
        where: { id: senderId },
        select: { balanceCents: true },
      });

      return {
        newBalanceCents: updatedSender!.balanceCents,
        recipientUsername: recipient.username,
        amountCents,
      };
    });
  }
}