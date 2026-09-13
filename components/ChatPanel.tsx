"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  X,
  ChevronDown,
  Sword,
  Headphones,
  Send,
  MoreHorizontal,
  CornerUpLeft,
  ArrowDown,
} from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { useAuth } from "@/contexts/AuthContext";
import ChatRulesModal from "@/components/ChatRulesModal";

// Where the backend lives. Avatar paths returned by the backend (e.g.
// "/uploads/avatars/xyz.jpg") are relative — this is prefixed on so an
// <img> tag can actually load the real file from the backend server,
// not the frontend's own origin.
const BACKEND_URL = "http://localhost:3001";

const LANGUAGES = [
  { label: "English", icon: "/icons/englishphot.jpg" },
  { label: "Filipino", icon: "/icons/phphot.jpg" },
  { label: "Indonesian", icon: "/icons/indophot.jpg" },
  { label: "Highrollers", icon: "/icons/highrollersphot.png" },
];

// Max characters allowed per message. Spaces count as regular
// characters here too — the browser's native maxLength attribute
// counts every character in the string, no extra handling needed.
// NOTE: this is a UX convenience only. The real, trusted limit lives
// in backend/src/chat/chat.service.ts, which re-checks this
// server-side since a user could bypass the browser and send a raw
// socket payload of any length.
const MAX_MESSAGE_LENGTH = 150;

// How much of a quoted message's text to show before truncating with
// "...". This is purely a DISPLAY concern — the server never truncates
// or stores a snapshot, it always keeps the real full message and we
// just cut the string short here for the preview UI.
const REPLY_PREVIEW_LENGTH = 60;

// How close (in pixels) to the bottom of the scroll container counts
// as "at the bottom" for auto-scroll purposes. A little slack instead
// of requiring an exact 0 makes this feel natural — you don't have to
// be scrolled to the literal last pixel to still count as "caught up."
const BOTTOM_THRESHOLD_PX = 60;

// Fixed height (in px) used for BOTH the connector-line block (in the
// avatar column) and the reply-preview row (in the content column).
// Giving both the exact same height, plus the exact same bottom
// margin, is what keeps the main avatar and the main username row
// perfectly aligned whether or not a reply preview is present — both
// columns grow by an identical amount above their "main" row.
const REPLY_BLOCK_HEIGHT_PX = 20;

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength).trimEnd() + "...";
}

// What we track locally while composing a reply, before it's sent.
type ReplyDraft = {
  id: string;
  username: string;
  content: string;
};

export default function ChatPanel() {
  const {
    isOpen,
    close,
    width,
    setWidth,
    room,
    setRoom,
    messages,
    isLoadingHistory,
    sendMessage,
    chatError,
    chatErrorRetryAt,
    clearChatError,
  } = useChat();
  const { user } = useAuth();

  const [langOpen, setLangOpen] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [input, setInput] = useState("");
  const [replyDraft, setReplyDraft] = useState<ReplyDraft | null>(null);

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  // Whether the user is currently scrolled down to (near) the bottom of
  // the message list. Drives whether new incoming messages auto-scroll
  // or instead just increment the "new messages" counter below.
  const [isAtBottom, setIsAtBottom] = useState(true);

  // How many messages have arrived since the user last was at the
  // bottom. Shown in the "New messages" pill button. Resets to 0 once
  // they scroll back down (manually or via the button).
  const [unreadCount, setUnreadCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // We track the id of the LAST message in the array (rather than the
  // array's length) to detect new arrivals. This matters because
  // ChatContext caps each room at 30 displayed messages — once a room
  // hits that cap, adding a new message also drops the oldest one, so
  // the array length stops changing. The newest id still changes every
  // time though, so comparing ids keeps working correctly past the cap.
  const prevLastIdRef = useRef<string | null>(null);

  // Fires on every scroll inside the message list. Figures out whether
  // the user is close enough to the bottom to count as "caught up," and
  // clears the unread counter the moment they scroll back down manually
  // (not just via the button).
  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const nowAtBottom = distanceFromBottom < BOTTOM_THRESHOLD_PX;

    setIsAtBottom(nowAtBottom);
    if (nowAtBottom) {
      setUnreadCount(0);
    }
  };

  // Whenever the message list changes: if the newest message's id is
  // different from the last one we saw, a new message really did
  // arrive. If the user is at the bottom, follow it smoothly like
  // before. If they've scrolled up to backread, don't yank them down —
  // just bump the "new messages" counter instead.
  useEffect(() => {
    const newLastId = messages.length > 0 ? messages[messages.length - 1].id : null;
    const prevLastId = prevLastIdRef.current;

    // prevLastId === null means this is the very first time messages
    // loaded for this room (e.g. history just fetched, or room just
    // switched) — that's not a "new" message arriving, so we skip
    // scrolling/counting and just record the baseline.
    if (prevLastId !== null && newLastId !== null && newLastId !== prevLastId) {
      if (isAtBottom) {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      } else {
        setUnreadCount((c) => c + 1);
      }
    }

    prevLastIdRef.current = newLastId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (!chatErrorRetryAt) {
      setSecondsLeft(null);
      return;
    }

    const tick = () => {
      const remainingMs = chatErrorRetryAt - Date.now();
      const remainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
      setSecondsLeft(remainingSeconds);

      if (remainingMs <= 0) {
        clearChatError();
      }
    };

    tick();
    const interval = setInterval(tick, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatErrorRetryAt]);

  // Clear any pending reply if the user switches rooms — replying across
  // rooms doesn't make sense (the backend rejects it anyway), and leaving
  // a stale "Replying to..." banner up while looking at a different room
  // would be confusing. Also reset the scroll-tracking state, since a
  // freshly opened room's history should just land at the bottom with
  // no leftover "new messages" count from the room you just left.
  useEffect(() => {
    setReplyDraft(null);
    setIsAtBottom(true);
    setUnreadCount(0);
    prevLastIdRef.current = null;
  }, [room]);

  if (!isOpen) return null;

  const currentLanguage =
    LANGUAGES.find((lang) => lang.label.toLowerCase() === room) ??
    LANGUAGES[0];

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newWidth = Math.min(Math.max(startWidth + delta, 260), 640);
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input, replyDraft?.id);
    setInput("");
    setReplyDraft(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend();
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Clicking the reply icon on a message sets it as the current reply
  // target and focuses the input — it does NOT touch the input's text
  // anymore (that was the rejected version). The actual reply reference
  // (replyDraft.id) travels separately and gets sent to the backend,
  // which re-verifies it's a real message before attaching it.
  const handleReplyClick = (message: (typeof messages)[number]) => {
    setReplyDraft({
      id: message.id,
      username: message.user.username,
      content: message.content,
    });
    inputRef.current?.focus();
  };

  // Called when the user clicks the "New messages" pill. Jumps to the
  // bottom and clears the unread state, same as if they'd scrolled down
  // manually.
  const handleJumpToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setIsAtBottom(true);
    setUnreadCount(0);
  };

  return (
    <>
      <aside
        style={{ width }}
        className="fixed top-0 left-0 h-screen bg-surface border-r border-border flex flex-col z-40"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <div className="relative">
            <button
              onClick={() => setLangOpen((v) => !v)}
              className="flex items-center gap-2 text-sm font-medium text-foreground bg-background border border-border rounded-lg px-3 py-2.5 min-w-[168px] hover:border-white/20 transition-colors duration-200"
            >
              <span className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                <Image
                  src={currentLanguage.icon}
                  alt={currentLanguage.label}
                  width={20}
                  height={20}
                  className="w-full h-full object-cover"
                />
              </span>
              <span className="flex-1 text-left whitespace-nowrap">
                {currentLanguage.label}
              </span>
              <ChevronDown size={14} className="shrink-0" />
            </button>

            {langOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-background border border-border rounded-lg overflow-hidden z-10">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.label}
                    onClick={() => {
                      setRoom(lang.label.toLowerCase());
                      setLangOpen(false);
                    }}
                    className={`w-full flex items-center gap-2 text-left text-sm px-3 py-2.5 transition-colors duration-200 ${
                      currentLanguage.label === lang.label
                        ? "text-foreground bg-white/5"
                        : "text-muted hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="w-5 h-5 rounded-full overflow-hidden shrink-0">
                      <Image
                        src={lang.icon}
                        alt={lang.label}
                        width={20}
                        height={20}
                        className="w-full h-full object-cover"
                      />
                    </span>
                    <span className="whitespace-nowrap">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={close}
            aria-label="Close chat"
            className="text-muted hover:text-foreground transition-colors duration-200 p-1"
          >
            <X size={18} />
          </button>
        </div>

        <div className="relative flex-1 min-h-0">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto px-4 py-4 chat-scrollbar"
          >
            {isLoadingHistory ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted">Loading messages...</p>
              </div>
            ) : messages.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted text-center">
                  No messages yet in {currentLanguage.label} chat.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                {messages.map((msg) => (
                  <div key={msg.id} className="group flex items-start gap-3">
                    {/* Avatar column. When this message is a reply, a
                        short vertical connector line fills the avatar
                        column above the main avatar — purely decorative,
                        just enough to visually tie the reply row above
                        to the message below. The mini avatar of the
                        ORIGINAL sender does NOT live here anymore; it's
                        inline with their username in the content column
                        instead (see below), matching the reference. */}
                    <div className="flex flex-col items-center shrink-0" style={{ width: 36 }}>
                      {msg.replyToMessage && (
                        <div
                          className="flex justify-center mb-1.5"
                          style={{ height: REPLY_BLOCK_HEIGHT_PX }}
                        >
                          <div className="w-px bg-border" />
                        </div>
                      )}

                      {msg.user.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={`${BACKEND_URL}${msg.user.avatarUrl}`}
                          alt={msg.user.username}
                          className="w-9 h-9 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-sm font-semibold">
                          {msg.user.username.charAt(0).toUpperCase()}
                        </div>
                      )}

                      <button
                        onClick={() => handleReplyClick(msg)}
                        aria-label={`Reply to ${msg.user.username}`}
                        title={`Reply to ${msg.user.username}`}
                        className="mt-1.5 text-muted opacity-0 group-hover:opacity-100 hover:text-violet-400 transition-all duration-200"
                      >
                        <CornerUpLeft size={12} />
                      </button>
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Reply-preview row: mini avatar, username, and
                          quoted text all sit BESIDE each other on one
                          horizontal line, matching the reference. Same
                          fixed height + bottom margin as the connector
                          block on the left, so the main username row
                          below it lands at the exact same y position as
                          the main avatar regardless of whether a reply
                          preview is present. */}
                      {msg.replyToMessage && (
                        <div
                          className="flex items-center gap-1.5 min-w-0 text-xs text-muted mb-1.5"
                          style={{ height: REPLY_BLOCK_HEIGHT_PX }}
                        >
                          {msg.replyToMessage.user.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${BACKEND_URL}${msg.replyToMessage.user.avatarUrl}`}
                              alt={msg.replyToMessage.user.username}
                              className="w-4 h-4 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-[9px] font-semibold shrink-0">
                              {msg.replyToMessage.user.username.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="font-medium text-muted shrink-0 max-w-[100px] truncate">
                            {msg.replyToMessage.user.username}
                          </span>
                          <span className="truncate">
                            {truncate(
                              msg.replyToMessage.content,
                              REPLY_PREVIEW_LENGTH,
                            )}
                          </span>
                        </div>
                      )}

                      <div className="flex items-baseline justify-between">
                        <div className="flex items-baseline gap-2">
                          <span className="text-base font-semibold text-foreground">
                            {msg.user.username}
                          </span>
                          <button
                            aria-label="Message options"
                            className="text-muted opacity-0 group-hover:opacity-100 hover:text-foreground transition-all duration-200"
                          >
                            <MoreHorizontal size={15} />
                          </button>
                        </div>
                        <span className="text-xs text-muted shrink-0">
                          {formatTime(msg.createdAt)}
                        </span>
                      </div>
                      <p className="text-[15px] leading-relaxed text-foreground/90 break-words mt-0.5">
                        {msg.content}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* "New messages" pill — only shown once the user has scrolled
              up (isAtBottom === false) AND at least one message has
              arrived since then. Clicking it jumps to the bottom and
              dismisses itself. Positioned floating over the message
              list, just above the input area. */}
          {!isAtBottom && unreadCount > 0 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
              <button
                onClick={handleJumpToBottom}
                className="flex items-center gap-1.5 bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold rounded-full pl-3 pr-3.5 py-2 shadow-lg shadow-black/40 transition-colors duration-200"
              >
                <ArrowDown size={13} />
                {unreadCount} New message{unreadCount === 1 ? "" : "s"}
              </button>
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-border shrink-0">
          {chatError && (
            <div className="mb-2 flex items-center justify-between bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <p className="text-xs text-red-400">
                {chatError}
                {secondsLeft !== null && secondsLeft > 0 && (
                  <span className="font-medium"> ({secondsLeft}s)</span>
                )}
              </p>
              <button
                onClick={clearChatError}
                aria-label="Dismiss error"
                className="text-red-400 hover:text-red-300 transition-colors duration-200"
              >
                <X size={12} />
              </button>
            </div>
          )}

          {/* "Replying to..." banner, shown above the input while composing
              a reply. Purely a draft — nothing is sent to the backend
              until the user actually hits Send. */}
          {replyDraft && (
            <div className="mb-2 flex items-center justify-between gap-2 bg-background border border-border rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-1.5 min-w-0">
                <CornerUpLeft size={14} className="text-violet-400 shrink-0" />
                <span className="text-xs text-muted shrink-0">
                  Replying to
                </span>
                <span className="text-xs font-medium text-foreground shrink-0 max-w-[90px] truncate">
                  {replyDraft.username}
                </span>
                <span className="text-xs text-muted truncate">
                  {truncate(replyDraft.content, 40)}
                </span>
              </div>
              <button
                onClick={() => setReplyDraft(null)}
                aria-label="Cancel reply"
                className="shrink-0 text-muted hover:text-foreground transition-colors duration-200"
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleInputKeyDown}
              disabled={!user}
              maxLength={MAX_MESSAGE_LENGTH}
              placeholder={user ? "Type a message..." : "Log in to chat"}
              className="flex-1 bg-background border border-border rounded-lg px-3.5 py-2.5 text-base text-foreground placeholder:text-muted outline-none disabled:cursor-not-allowed disabled:text-muted"
            />
            <button
              onClick={handleSend}
              disabled={!user || !input.trim()}
              aria-label="Send message"
              className="shrink-0 bg-background border border-border rounded-lg p-2.5 text-muted enabled:hover:text-foreground enabled:hover:border-white/20 transition-colors duration-200 disabled:cursor-not-allowed"
            >
              <Send size={17} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setRulesOpen(true)}
              className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors duration-200"
            >
              <Sword size={14} />
              Chat Rules
            </button>
            <Headphones size={16} className="text-muted" />
          </div>
        </div>

        <div
          onMouseDown={handleResizeStart}
          className="absolute top-0 right-0 h-full w-1 cursor-col-resize hover:bg-violet-400/40 transition-colors duration-200"
        />
      </aside>

      <ChatRulesModal isOpen={rulesOpen} onClose={() => setRulesOpen(false)} />
    </>
  );
}