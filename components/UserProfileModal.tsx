"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, User, Gamepad2, ChevronDown } from "lucide-react";

export interface PublicProfile {
  id: string;
  username: string;
  level: number;
  createdAt: string;
}

type UserProfileModalProps = {
  isOpen: boolean;
  onClose: () => void;
  profile: PublicProfile | null;
  isLoading: boolean;
  error: string | null;
};

// Turns an ISO date string into something like "July 30th, 2026" —
// matching the "Joined on July 30th" style from the reference design.
function formatJoinDate(isoString: string): string {
  const date = new Date(isoString);
  const month = date.toLocaleString(undefined, { month: "long" });
  const day = date.getDate();
  const year = date.getFullYear();

  // Ordinal suffix: 1st, 2nd, 3rd, 4th... 11th/12th/13th are exceptions
  // (they're always "th", not "1st"/"2nd"/"3rd") because English is weird.
  const suffix =
    day % 10 === 1 && day !== 11
      ? "st"
      : day % 10 === 2 && day !== 12
        ? "nd"
        : day % 10 === 3 && day !== 13
          ? "rd"
          : "th";

  return `${month} ${day}${suffix}, ${year}`;
}

export default function UserProfileModal({
  isOpen,
  onClose,
  profile,
  isLoading,
  error,
}: UserProfileModalProps) {
  // Whether the "Games Played" section is expanded. Starts collapsed —
  // we only show the (currently empty) content once the user actually
  // clicks the arrow, per your instructions.
  const [gamesExpanded, setGamesExpanded] = useState(false);

  // Portals need `document` to exist, which isn't true during server-side
  // rendering. This flag flips to true only after the component has
  // mounted in the browser, so we don't try to portal into `document.body`
  // before it's safe to do so.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  // Reset the expanded state whenever the modal closes, so it doesn't
  // stay expanded the next time a different user's profile is opened.
  const handleClose = () => {
    setGamesExpanded(false);
    onClose();
  };

  return createPortal(
    <div
      onClick={handleClose}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card w-full max-w-lg bg-surface border border-border rounded-2xl p-8 relative"
      >
        <button
          onClick={handleClose}
          aria-label="Close"
          className="absolute top-6 right-6 text-muted hover:text-foreground transition-colors duration-200"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <User size={22} className="text-violet-400" />
          <h2 className="text-xl font-display font-bold text-foreground">
            User Profile
          </h2>
        </div>

        {isLoading && (
          <p className="text-sm text-muted py-8 text-center">
            Loading profile...
          </p>
        )}

        {!isLoading && error && (
          <p className="text-sm text-red-400 py-8 text-center">{error}</p>
        )}

        {!isLoading && !error && profile && (
          <>
            <div className="flex items-center gap-5 mb-6">
              {/* Avatar wrapper is `relative` so the online dot can be
                  absolutely positioned in its bottom-right corner. */}
              <div className="relative shrink-0">
                <div className="w-20 h-20 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-3xl font-semibold flex items-center justify-center">
                  {profile.username.charAt(0).toUpperCase()}
                </div>
                {/* Online status dot. NOTE: there's no real presence/online
                    tracking in the backend yet — this modal is currently
                    only reachable from YOUR OWN AccountMenu (viewing your
                    own profile), so "always online" is accurate for now.
                    Once other users' profiles become viewable again (e.g.
                    clicking a username in chat), this needs to be driven
                    by real data instead of hardcoded. The border color
                    matches bg-surface so the dot looks "cut into" the
                    avatar rather than just floating on top of it. */}
                <span className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-green-500 border-[3px] border-surface" />
              </div>
              <div>
                <p className="text-xl font-semibold text-foreground">
                  {profile.username}
                </p>
                <p className="text-sm text-muted mt-1">
                  Joined on {formatJoinDate(profile.createdAt)}
                </p>
              </div>
            </div>

            <p className="text-base font-medium text-foreground mb-7">
              Level {profile.level}
            </p>

            <div className="border border-border rounded-lg overflow-hidden">
              <button
                onClick={() => setGamesExpanded((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm text-foreground hover:bg-white/5 transition-colors duration-200"
              >
                <span className="flex items-center gap-2">
                  <Gamepad2 size={17} className="text-muted" />
                  Games Played
                </span>
                <ChevronDown
                  size={17}
                  className={`text-muted transition-transform duration-300 ${
                    gamesExpanded ? "rotate-180" : ""
                  }`}
                />
              </button>

              {/* Smooth expand/collapse using a CSS grid-rows trick:
                  animating from 0fr to 1fr lets the browser smoothly
                  interpolate the height even though we never told it an
                  exact pixel value — this works regardless of how tall
                  the inner content ends up being (unlike animating
                  max-height, which requires guessing a fixed number). The
                  inner div needs overflow-hidden so content doesn't peek
                  out mid-animation while the row is still shrinking. */}
              <div
                className="grid transition-[grid-template-rows] duration-300 ease-in-out"
                style={{
                  gridTemplateRows: gamesExpanded ? "1fr" : "0fr",
                }}
              >
                <div className="overflow-hidden">
                  <div className="px-4 py-4 border-t border-border">
                    <p className="text-xs text-muted text-center">
                      No games played yet.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}