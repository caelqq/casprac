"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";
import { io, Socket } from "socket.io-client";

const SOCKET_URL = "http://localhost:3001";

// How many messages we keep in memory per room. FRONTEND-ONLY display
// cap — does NOT delete anything from the database. All messages remain
// permanently stored in PostgreSQL; this only limits how far back a user
// can scroll/backread in the chat panel itself.
const MAX_MESSAGES_PER_ROOM = 30;

// Minimal shape of the message a reply points back to. Only what's
// needed to render the quoted preview — the server decides what this
// contains, based on the REAL original message, never on anything the
// client claims.
export interface ReplyPreview {
  id: string;
  content: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
}

export interface ChatMessage {
  id: string;
  room: string;
  userId: string;
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    avatarUrl: string | null;
  };
  replyToMessage: ReplyPreview | null;
}

type ChatContextType = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
  width: number;
  setWidth: (width: number) => void;
  room: string;
  setRoom: (room: string) => void;
  socket: Socket | null;
  connected: boolean;
  messages: ChatMessage[];
  isLoadingHistory: boolean;
  sendMessage: (content: string, replyToMessageId?: string) => void;
  chatError: string | null;
  chatErrorRetryAt: number | null;
  clearChatError: () => void;
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// Trims a message array down to the most recent MAX_MESSAGES_PER_ROOM
// entries, dropping the oldest ones off the front. Messages arrive in
// chronological order (oldest first).
function capMessages(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= MAX_MESSAGES_PER_ROOM) return messages;
  return messages.slice(messages.length - MAX_MESSAGES_PER_ROOM);
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(true);
  const [width, setWidth] = useState(320);
  const [room, setRoom] = useState("english");
  const [connected, setConnected] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [chatError, setChatError] = useState<string | null>(null);
  const [chatErrorRetryAt, setChatErrorRetryAt] = useState<number | null>(
    null,
  );

  const [messagesByRoom, setMessagesByRoom] = useState<Record<string, ChatMessage[]>>({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const newSocket = io(SOCKET_URL, {
      withCredentials: true,
    });

    newSocket.on("connect", () => {
      console.log("[socket] connected:", newSocket.id);
      setConnected(true);
    });

    newSocket.on("disconnect", () => {
      console.log("[socket] disconnected");
      setConnected(false);
    });

    newSocket.on("newMessage", (message: ChatMessage) => {
      setMessagesByRoom((prev) => {
        const existing = prev[message.room] ?? [];
        const updated = capMessages([...existing, message]);
        return { ...prev, [message.room]: updated };
      });
    });

    newSocket.on(
      "chatError",
      (payload: { message: string; retryAfterMs?: number }) => {
        setChatError(payload.message);
        setChatErrorRetryAt(
          payload.retryAfterMs ? Date.now() + payload.retryAfterMs : null,
        );
      },
    );

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
      socketRef.current = null;
      setSocket(null);
    };
  }, []);

  useEffect(() => {
    if (!socket || !connected) return;

    console.log(`[socket] joining room: ${room}`);
    socket.emit("joinRoom", room);

    return () => {
      console.log(`[socket] leaving room: ${room}`);
      socket.emit("leaveRoom", room);
    };
  }, [socket, connected, room]);

  useEffect(() => {
    if (messagesByRoom[room] !== undefined) return;

    let cancelled = false;

    const fetchHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const response = await fetch(
          `http://localhost:3001/chat/${room}/messages`,
        );

        if (!response.ok) {
          throw new Error("Failed to load message history.");
        }

        const history: ChatMessage[] = await response.json();

        if (!cancelled) {
          setMessagesByRoom((prev) => ({
            ...prev,
            [room]: capMessages(history),
          }));
        }
      } catch (err) {
        if (!cancelled) {
          setChatError("Couldn't load chat history. Try switching rooms.");
          setChatErrorRetryAt(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoadingHistory(false);
        }
      }
    };

    fetchHistory();

    return () => {
      cancelled = true;
    };
  }, [room, messagesByRoom]);

  useEffect(() => {
    setChatError(null);
    setChatErrorRetryAt(null);
  }, [room]);

  const sendMessage = (content: string, replyToMessageId?: string) => {
    if (!socket || !connected) return;

    const trimmed = content.trim();
    if (!trimmed) return;

    socket.emit("sendMessage", { room, content: trimmed, replyToMessageId });
  };

  return (
    <ChatContext.Provider
      value={{
        isOpen,
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        toggle: () => setIsOpen((v) => !v),
        width,
        setWidth,
        room,
        setRoom,
        socket,
        connected,
        messages: messagesByRoom[room] ?? [],
        isLoadingHistory,
        sendMessage,
        chatError,
        chatErrorRetryAt,
        clearChatError: () => {
          setChatError(null);
          setChatErrorRetryAt(null);
        },
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return ctx;
}