"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, Settings as SettingsIcon, Pencil } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type TabId = "account" | "notifications" | "display" | "chat" | "performance";

const TABS: { id: TabId; label: string }[] = [
  { id: "account", label: "Account" },
  { id: "notifications", label: "Notifications" },
  { id: "display", label: "Display" },
  { id: "chat", label: "Chat" },
  { id: "performance", label: "Performance" },
];

// Where the backend lives. Avatar paths returned by the backend (e.g.
// "/uploads/avatars/xyz.jpg") are relative — this is prefixed on so an
// <img> tag can actually load the real file from the backend server,
// not the frontend's own origin (which has no such route).
const BACKEND_URL = "http://localhost:3001";

// Client-side-only convenience checks, so a user gets instant feedback
// instead of waiting on a round trip to the server for an obviously
// wrong file. This is NOT the real security boundary — the backend
// re-validates both of these itself (see avatar-upload.config.ts) since
// a malicious user could bypass anything the browser checks.
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB

// Very basic client-side email shape check — just for instant feedback
// before hitting the server. The REAL validation is the @IsEmail()
// decorator on ChangeEmailDto in the backend, which runs no matter
// what the frontend does or doesn't check.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Small reusable pill-style toggle switch, styled to match the rest of
// Casilo's dark theme. Purely presentational — it just reports the new
// boolean value on click, the parent decides what that means.
function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative w-11 h-6 rounded-full shrink-0 transition-colors duration-200 ${
        checked ? "bg-violet-500" : "bg-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform duration-200 ${
          checked ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const { user, setUser } = useAuth();

  const [activeTab, setActiveTab] = useState<TabId>("account");
  const [newEmail, setNewEmail] = useState("");

  // --- Change email state -------------------------------------------
  const [isChangingEmail, setIsChangingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);

  // --- Avatar upload state -----------------------------------------------
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  // --- Toggle state -----------------------------------------------------
  // UI-only for now — there's no `settings` table/columns in the backend
  // yet, so flipping these doesn't persist anywhere or do anything real.
  // They're here so the layout/interaction matches the reference design;
  // wiring them to real backend fields is a later step.
  const [anonymousMode, setAnonymousMode] = useState(false);
  const [hideOnlineStatus, setHideOnlineStatus] = useState(false);
  const [hideGamesPlayed, setHideGamesPlayed] = useState(false);

  // Same portal pattern as UserProfileModal — renders directly into
  // document.body so this modal always centers over the full viewport,
  // regardless of where in the component tree (the AccountMenu dropdown)
  // it was triggered from.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  const initial = user?.username?.charAt(0).toUpperCase() ?? "?";

  // Clicking the avatar circle (or its pencil overlay) just opens the
  // hidden native file picker — no custom UI needed for that part, the
  // browser handles it.
  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  // Fires once the user has picked a file in the native dialog. Does a
  // quick client-side sanity check (instant feedback, better UX), then
  // uploads it. The real validation happens server-side regardless.
  const handleFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    // Reset the input's value immediately so selecting the SAME file
    // again later (e.g. after an error) still fires this handler — the
    // browser otherwise treats "same file" as no change.
    e.target.value = "";

    if (!file) return;

    setAvatarError(null);

    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      setAvatarError("Only JPG, PNG, WEBP, or GIF images are allowed");
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setAvatarError("Image must be smaller than 2MB");
      return;
    }

    setIsUploadingAvatar(true);

    try {
      const formData = new FormData();
      // "avatar" here MUST match the field name the backend expects —
      // FileInterceptor('avatar', ...) in users.controller.ts.
      formData.append("avatar", file);

      const response = await fetch(`${BACKEND_URL}/users/me/avatar`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setAvatarError(data?.message ?? "Failed to upload image");
        return;
      }

      const updatedUser = await response.json();
      // Backend returns the full, current user shape (id, username,
      // email, avatarUrl) — passing it straight into setUser updates
      // this modal AND every other place in the app that reads the
      // logged-in user (e.g. the account menu) immediately, no refresh
      // needed.
      setUser(updatedUser);
    } catch (err) {
      setAvatarError("Could not reach the server — please try again");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  // Fires when the user clicks "Update" next to the new-email input.
  // Does a quick client-side format check first (instant feedback), then
  // calls the backend, which is the REAL authority on both the email
  // format (again) AND the 7-day cooldown — that check can only ever be
  // trusted server-side, since the client has no way to know the true
  // "last changed" timestamp on its own.
  const handleChangeEmail = async () => {
    setEmailError(null);
    setEmailSuccess(null);

    const trimmed = newEmail.trim();

    if (!trimmed) {
      setEmailError("Please enter a new email address");
      return;
    }

    if (!EMAIL_PATTERN.test(trimmed)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    setIsChangingEmail(true);

    try {
      const response = await fetch(`${BACKEND_URL}/users/me/email`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ newEmail: trimmed }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // The backend's error messages (cooldown remaining, "already in
        // use", etc.) are written to be shown directly to the user, so
        // we just display data.message as-is rather than writing our
        // own generic text over it.
        setEmailError(data?.message ?? "Failed to update email");
        return;
      }

      // Backend returns the full, current user shape (id, username,
      // email, avatarUrl) — same pattern as the avatar upload above.
      setUser(data);
      setNewEmail("");
      setEmailSuccess("Your email has been updated.");
    } catch (err) {
      setEmailError("Could not reach the server — please try again");
    } finally {
      setIsChangingEmail(false);
    }
  };

  return createPortal(
    <div
      onClick={onClose}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card w-full max-w-xl bg-surface border border-border rounded-2xl p-8 relative max-h-[85vh] overflow-y-auto chat-scrollbar"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-6 right-6 text-muted hover:text-foreground transition-colors duration-200"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-6">
          <SettingsIcon size={22} className="text-violet-400" />
          <h2 className="text-xl font-display font-bold text-foreground">
            Settings
          </h2>
        </div>

        {/* Tab strip. overflow-x-auto still lets it scroll horizontally on
            very narrow screens, but scrollbar-none hides the visible
            scrollbar track/arrows so it doesn't look like a stray UI
            element next to the tabs. */}
        <div className="flex items-center gap-1 mb-7 border-b border-border overflow-x-auto scrollbar-none">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors duration-200 border-b-2 -mb-px ${
                activeTab === tab.id
                  ? "text-foreground border-violet-500"
                  : "text-muted border-transparent hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "account" ? (
          <div className="flex flex-col gap-6">
            {/* Profile Picture row */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  Profile Picture
                </p>
                <p className="text-xs text-muted mt-0.5">
                  Change your profile picture.
                </p>
                {avatarError && (
                  <p className="text-xs text-red-400 mt-1">{avatarError}</p>
                )}
              </div>

              {/* Hidden native file input — never shown directly, just
                  triggered programmatically by clicking the avatar
                  button below. accept="image/*" is another convenience
                  hint for the browser's file picker UI; it is NOT a
                  real security boundary on its own (a user could still
                  pick "all files"), which is why we still validate
                  file.type in JS above AND the backend validates the
                  real file content server-side regardless. */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelected}
                className="hidden"
              />

              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={isUploadingAvatar}
                aria-label="Change profile picture"
                className="relative w-16 h-16 rounded-full shrink-0 group disabled:cursor-not-allowed"
              >
                {user?.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`${BACKEND_URL}${user.avatarUrl}`}
                    alt="Your avatar"
                    className="w-16 h-16 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white text-2xl font-semibold">
                    {initial}
                  </div>
                )}

                {/* Pencil overlay — always slightly visible, brightens
                    on hover, matching common "edit avatar" patterns. */}
                <span className="absolute -bottom-0.5 -right-0.5 w-6 h-6 rounded-full bg-background border border-border flex items-center justify-center text-muted group-hover:text-foreground transition-colors duration-200">
                  <Pencil size={12} />
                </span>

                {/* Loading overlay while the upload is in flight. */}
                {isUploadingAvatar && (
                  <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px] font-medium">
                    ...
                  </span>
                )}
              </button>
            </div>

            <div className="h-px bg-border" />

            {/* Change Email row */}
            <div>
              <p className="text-sm font-semibold text-foreground mb-1">
                Change Email
              </p>
              <p className="text-xs text-muted mb-3">
                Your current email is{" "}
                <span className="text-foreground font-medium">
                  {user?.email ?? "—"}
                </span>
                . You can change it once every 7 days.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isChangingEmail}
                  placeholder="Enter new email..."
                  className="flex-1 bg-background border border-border rounded-lg px-3 py-2.5 text-sm text-foreground placeholder:text-muted outline-none disabled:cursor-not-allowed"
                />
                <button
                  type="button"
                  onClick={handleChangeEmail}
                  disabled={isChangingEmail || !newEmail.trim()}
                  className="shrink-0 bg-violet-500 enabled:hover:bg-violet-600 disabled:bg-violet-500/40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg px-4 py-2.5 transition-colors duration-200"
                >
                  {isChangingEmail ? "Updating..." : "Update"}
                </button>
              </div>
              {emailError && (
                <p className="text-xs text-red-400 mt-2">{emailError}</p>
              )}
              {emailSuccess && (
                <p className="text-xs text-green-400 mt-2">{emailSuccess}</p>
              )}
            </div>

            <div className="h-px bg-border" />

            {/* Toggles */}
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Anonymous Mode
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Hide yourself from Live Bets
                  </p>
                </div>
                <ToggleSwitch checked={anonymousMode} onChange={setAnonymousMode} />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Hide Online Status
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Makes your online status invisible to other users
                  </p>
                </div>
                <ToggleSwitch
                  checked={hideOnlineStatus}
                  onChange={setHideOnlineStatus}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    Hide Games Played
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    Hide your games played count
                  </p>
                </div>
                <ToggleSwitch
                  checked={hideGamesPlayed}
                  onChange={setHideGamesPlayed}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted">
              {TABS.find((t) => t.id === activeTab)?.label} settings are
              coming soon.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}