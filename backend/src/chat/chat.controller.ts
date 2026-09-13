// backend/src/chat/chat.controller.ts

import { Controller, Get, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  // GET /chat/:room/messages
  // Public endpoint — no login required to VIEW chat history, matching
  // the reference design (logged-out visitors can see the chat panel,
  // they just can't type in it). Sending a message will be a separate,
  // auth-required step once we build the WebSocket gateway.
  @Get(':room/messages')
  async getMessages(@Param('room') room: string) {
    return this.chatService.getMessageHistory(room);
  }
}