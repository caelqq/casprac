// backend/src/chat/chat.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// The only four rooms that currently exist. Kept as a hardcoded list here
// (rather than trusting whatever string the client sends) so nobody can
// query or post to fake/unexpected room values through the API or socket.
const VALID_ROOMS = ['english', 'filipino', 'indonesian', 'highrollers'];

// How many past messages we send back when someone opens a room. Keeps
// the initial page load fast — we don't want to send someone's entire
// chat history every single time they open the chat panel.
const MESSAGE_HISTORY_LIMIT = 50;

// Max characters allowed in a single chat message. Spaces count as
// regular characters (JavaScript's .length counts every character in
// the string, spaces included, so no special handling is needed for
// that). This is the REAL limit — the frontend also enforces 150 via
// the input's maxLength attribute, but that's just for a smoother
// typing experience. This server-side check is what actually matters,
// since a client could bypass the browser entirely and emit a raw
// socket message with any length it wants.
const MAX_MESSAGE_LENGTH = 150;

// Minimum level required to send messages in the Highrollers room.
const HIGHROLLERS_MIN_LEVEL = 10;

// Reused in both getMessageHistory and createMessage so replies always
// come back shaped the same way, no matter which endpoint returned them.
// avatarUrl is included on BOTH the main sender and the replied-to
// sender, so the frontend can show a real profile picture in either
// spot instead of always falling back to the colored-initial circle.
const MESSAGE_INCLUDE = {
  user: {
    select: {
      id: true,
      username: true,
      avatarUrl: true,
    },
  },
  replyToMessage: {
    select: {
      id: true,
      content: true,
      user: {
        select: {
          id: true,
          username: true,
          avatarUrl: true,
        },
      },
    },
  },
} as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async getMessageHistory(room: string) {
    if (!VALID_ROOMS.includes(room)) {
      throw new BadRequestException(`Unknown chat room: ${room}`);
    }

    // We fetch the most recent messages first (newest-to-oldest) so that
    // "take: 50" grabs the LAST 50 messages sent — not the very first 50
    // ever sent in that room's history. We then reverse the array so the
    // frontend receives them in natural reading order (oldest to newest).
    const messages = await this.prisma.chatMessage.findMany({
      where: { room },
      orderBy: { createdAt: 'desc' },
      take: MESSAGE_HISTORY_LIMIT,
      include: MESSAGE_INCLUDE,
    });

    return messages.reverse();
  }

  // Called by the WebSocket gateway whenever a logged-in user sends a
  // message. Note: userId is ALWAYS passed in from the server's own
  // verified JWT cookie data (see chat.gateway.ts) — never from anything
  // the client directly claims about their own identity.
  //
  // replyToMessageId is OPTIONAL and, if present, is treated as
  // completely untrusted input: we look the message up ourselves and use
  // ITS real content/username, never whatever the client might separately
  // claim the original message said.
  async createMessage(
    userId: string,
    room: string,
    content: string,
    replyToMessageId?: string,
  ) {
    if (!VALID_ROOMS.includes(room)) {
      throw new BadRequestException(`Unknown chat room: ${room}`);
    }

    const trimmed = content?.trim();

    if (!trimmed) {
      throw new BadRequestException('Message cannot be empty.');
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
      throw new BadRequestException(
        `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).`,
      );
    }

    // We re-fetch the user fresh from the database rather than trusting
    // any level info the client might send — the same "never trust the
    // client" principle applies to the Highrollers level gate.
    const user = await this.prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      throw new BadRequestException('User not found.');
    }

    if (room === 'highrollers' && user.level < HIGHROLLERS_MIN_LEVEL) {
      throw new ForbiddenException(
        `You must be level ${HIGHROLLERS_MIN_LEVEL} or higher to chat in Highrollers.`,
      );
    }

    // If a replyToMessageId was provided, verify it actually exists AND
    // belongs to the same room. Replying across rooms doesn't make sense
    // (the original wouldn't even be visible in the room you're posting
    // to), and silently trusting an id without checking would let a
    // client attach a reply preview to literally any message id it
    // guesses, in any room.
    let validatedReplyToMessageId: string | undefined = undefined;

    if (replyToMessageId) {
      const original = await this.prisma.chatMessage.findUnique({
        where: { id: replyToMessageId },
      });

      if (!original || original.room !== room) {
        throw new BadRequestException(
          'The message you are replying to could not be found.',
        );
      }

      validatedReplyToMessageId = original.id;
    }

    const message = await this.prisma.chatMessage.create({
      data: {
        room,
        userId,
        content: trimmed,
        replyToMessageId: validatedReplyToMessageId,
      },
      include: MESSAGE_INCLUDE,
    });

    return message;
  }
}