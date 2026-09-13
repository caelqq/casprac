// backend/src/chat/chat.gateway.ts

import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ChatService } from './chat.service';

interface JwtPayload {
  sub: string;
  username: string;
}

// Socket.io connections don't go through our normal Express cookie-parser
// middleware, so we manually parse the raw cookie header ourselves here.
// This just splits "auth_token=abc; other=xyz" into a lookup object.
function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach((pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return;
    cookies[key] = decodeURIComponent(rest.join('='));
  });

  return cookies;
}

// --- Rate limiting config -------------------------------------------------
// Simple sliding-window limiter: each user may send at most
// RATE_LIMIT_MAX messages within any RATE_LIMIT_WINDOW_MS window.
// This is intentionally in-memory (resets if the server restarts) —
// fine for a local practice project. A production app with multiple
// server instances would need this in something shared like Redis
// instead, since each server process would otherwise track its own
// separate counts.
const RATE_LIMIT_MAX = 3;
const RATE_LIMIT_WINDOW_MS = 30_000; // 30 seconds

@WebSocketGateway({
  cors: {
    origin: 'http://localhost:3000',
    credentials: true,
  },
})
export class ChatGateway implements OnGatewayConnection {
  @WebSocketServer()
  server: Server;

  // Tracks recent message timestamps per user, so we can enforce the
  // rate limit above. Keyed by userId (never trust anything else for
  // this — see the note on handleSendMessage below).
  private readonly messageTimestamps = new Map<string, number[]>();

  constructor(
    private readonly chatService: ChatService,
    private readonly jwtService: JwtService,
  ) {}

  // Runs automatically whenever any browser connects to the socket, logged
  // in or not. Viewing chat doesn't require auth — we just try to identify
  // the user if they have a valid cookie, so we know who they are IF they
  // later try to send a message. Guests simply won't have userId set.
  handleConnection(client: Socket) {
    const cookies = parseCookies(client.handshake.headers.cookie);
    const token = cookies['auth_token'];

    if (token) {
      try {
        const payload = this.jwtService.verify<JwtPayload>(token);
        client.data.userId = payload.sub;
        client.data.username = payload.username;
      } catch {
        // Invalid or expired token — treat this connection as a guest,
        // same as if there was no cookie at all.
      }
    }
  }

  // The frontend calls this once, right after connecting, to start
  // receiving messages for whichever room the user currently has open.
  @SubscribeMessage('joinRoom')
  handleJoinRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.join(room);
  }

  // Called when the user switches away from a room, so they stop
  // receiving messages meant for a room they're no longer viewing.
  @SubscribeMessage('leaveRoom')
  handleLeaveRoom(@ConnectedSocket() client: Socket, @MessageBody() room: string) {
    client.leave(room);
  }

  // Returns { limited: false } if the user is still allowed to send.
  // Returns { limited: true, retryAfterMs } if they've hit the cap —
  // retryAfterMs tells the client exactly how long until their oldest
  // message in the current window "ages out" and they can send again.
  private getRateLimitStatus(userId: string): {
    limited: boolean;
    retryAfterMs?: number;
  } {
    const now = Date.now();
    const timestamps = this.messageTimestamps.get(userId) ?? [];

    // Drop any timestamps older than the window — only what happened in
    // the last 30 seconds counts toward the limit.
    const recent = timestamps.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);

    if (recent.length >= RATE_LIMIT_MAX) {
      // Still store the trimmed array so old entries don't pile up
      // forever in memory for a user who keeps hammering the button.
      this.messageTimestamps.set(userId, recent);

      // The oldest timestamp in the window is the next one to expire —
      // that's the moment the user's send count drops back under the cap.
      const oldest = recent[0];
      const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldest);
      return { limited: true, retryAfterMs };
    }

    recent.push(now);
    this.messageTimestamps.set(userId, recent);
    return { limited: false };
  }

  @SubscribeMessage('sendMessage')
  async handleSendMessage(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: { room: string; content: string; replyToMessageId?: string },
  ) {
    // This is the critical security line: we ONLY use the userId we
    // ourselves extracted from the verified JWT cookie during
    // handleConnection — never anything the client's message payload
    // might claim about who's sending it.
    const userId = client.data.userId as string | undefined;

    if (!userId) {
      client.emit('chatError', { message: 'You must be logged in to chat.' });
      return;
    }

    // Rate limit check happens BEFORE we touch the database at all —
    // no point spending a DB write on a message we're about to reject.
    const rateLimitStatus = this.getRateLimitStatus(userId);
    if (rateLimitStatus.limited) {
      client.emit('chatError', {
        message: 'You are sending messages too quickly. Please wait a moment.',
        retryAfterMs: rateLimitStatus.retryAfterMs,
      });
      return;
    }

    // data.replyToMessageId comes straight from the client, so we don't
    // assume it's even a string. If it's some unexpected type, we just
    // treat it as "no reply" rather than passing garbage down to Prisma.
    // The real trust check (does this message exist? does it belong to
    // this room?) happens inside chatService.createMessage.
    const replyToMessageId =
      typeof data.replyToMessageId === 'string' && data.replyToMessageId.trim()
        ? data.replyToMessageId.trim()
        : undefined;

    try {
      const message = await this.chatService.createMessage(
        userId,
        data.room,
        data.content,
        replyToMessageId,
      );

      // Broadcast to everyone currently in that room (including the
      // sender), so the message appears instantly for all viewers.
      this.server.to(data.room).emit('newMessage', message);
    } catch (err) {
      client.emit('chatError', {
        message: err instanceof Error ? err.message : 'Failed to send message.',
      });
    }
  }
}