"use client";

import { useEffect, useRef, useState } from "react";
import { User, Settings, HandCoins, Ticket, Gift, Headset, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import UserProfileModal, { PublicProfile } from "@/components/UserProfileModal";
import SettingsModal from "@/components/SettingsModal";
import TipModal from "@/components/TipModal";

// Where the backend lives. Avatar paths (e.g. "/uploads/avatars/xyz.jpg")
// are relative — this is prefixed on so an <img> tag can actually load
// the real file from the backend server, not the frontend's own origin.
const BACKEND_URL = "http://localhost:3001";

export default function AccountMenu() {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // --- User Profile Popup state -------------------------------------
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileData, setProfileData] = useState<PublicProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  // --- Settings modal state ------------------------------------------
  const [settingsOpen, setSettingsOpen] = useState(false);

  // --- Tip modal state -------------------------------------------------
  const [tipOpen, setTipOpen] = useState(false);

  // Closes the dropdown if the user clicks anywhere outside of it.
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  // Called when the avatar/username/level row is clicked. Closes the
  // dropdown (so the modal isn't appearing underneath it), opens the
  // modal right away in a loading state, then fetches this user's own
  // profile from the same public endpoint the chat popup would use.
  const handleOpenProfile = async () => {
    if (!user) return;

    setIsOpen(false);
    setProfileOpen(true);
    setProfileLoading(true);
    setProfileError(null);
    setProfileData(null);

    try {
      const response = await fetch(
        `http://localhost:3001/users/${user.id}/profile`,
      );

      if (!response.ok) {
        throw new Error("Couldn't load your profile.");
      }

      const data: PublicProfile = await response.json();
      setProfileData(data);
    } catch (err) {
      setProfileError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setProfileLoading(false);
    }
  };

  const handleCloseProfile = () => {
    setProfileOpen(false);
    setProfileData(null);
    setProfileError(null);
  };

  const handleOpenSettings = () => {
    setIsOpen(false);
    setSettingsOpen(true);
  };

  const handleOpenTip = () => {
    setIsOpen(false);
    setTipOpen(true);
  };

  // Placeholder level/XP data — there is no leveling system in the backend
  // yet. XP starts at 0 since the user hasn't played any games yet; this
  // will rise for real once game logic exists and reports XP back here.
  const level = 1;
  const nextLevel = 2;
  const xpProgress = 0; // percent, starts at 0 until games exist

  // Fallback avatar: a colored circle with the user's first initial,
  // shown only when the user has no uploaded avatarUrl.
  const initial = user?.username?.charAt(0).toUpperCase() ?? "?";

  // Menu items that just open a panel/page later — currently unwired
  // no-op buttons. "Settings" and "Tip" are handled separately above
  // since they now have real behavior (they open their own modals).
  const menuItems = [
    { label: "Codes", icon: Ticket },
    { label: "Rewards", icon: Gift },
    { label: "Live Support", icon: Headset },
  ];

  return (
    <div ref={menuRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-label="Account menu"
        className="text-muted hover:text-foreground transition-colors duration-200 p-2"
      >
        <User size={18} />
      </button>

      {isOpen && (
        <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-40 bg-surface border border-border rounded-xl shadow-2xl shadow-black/40 overflow-hidden z-40">
          {/* Profile header: avatar + username + level bar — clickable,
              opens UserProfileModal for your own profile. */}
          <button
            type="button"
            onClick={handleOpenProfile}
            className="w-full text-left px-2.5 py-2.5 hover:bg-white/5 transition-colors duration-200"
          >
            <div className="flex items-center gap-2">
              {user?.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${BACKEND_URL}${user.avatarUrl}`}
                  alt={user.username}
                  className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-[11px] flex-shrink-0">
                  {initial}
                </div>
              )}
              <span className="text-foreground font-medium text-sm truncate">
                {user?.username ?? ""}
              </span>
            </div>

            {/* Level progress bar */}
            <div className="flex items-center gap-1.5 mt-2">
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-violet-600 text-white text-[9px] font-bold flex-shrink-0">
                {level}
              </span>
              <div className="flex-1 h-1 rounded-full bg-border overflow-hidden">
                <div
                  className="h-full bg-violet-500"
                  style={{ width: `${xpProgress}%` }}
                />
              </div>
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-background border border-border text-muted text-[9px] font-bold flex-shrink-0">
                {nextLevel}
              </span>
            </div>
          </button>

          <div className="h-px bg-border" />

          {/* Menu items */}
          <div className="py-1">
            <button
              type="button"
              onClick={handleOpenSettings}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-foreground hover:bg-violet-500/15 transition-colors duration-200"
            >
              <Settings size={17} className="text-muted flex-shrink-0" />
              Settings
            </button>

            <button
              type="button"
              onClick={handleOpenTip}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-foreground hover:bg-violet-500/15 transition-colors duration-200"
            >
              <HandCoins size={17} className="text-muted flex-shrink-0" />
              Tip
            </button>

            {menuItems.map(({ label, icon: Icon }) => (
              <button
                key={label}
                type="button"
                className="w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-foreground hover:bg-violet-500/15 transition-colors duration-200"
              >
                <Icon size={17} className="text-muted flex-shrink-0" />
                {label}
              </button>
            ))}

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-2.5 py-2 text-sm font-medium text-red-400 hover:bg-violet-500/15 transition-colors duration-200"
            >
              <LogOut size={17} className="flex-shrink-0" />
              Logout
            </button>
          </div>
        </div>
      )}

      <UserProfileModal
        isOpen={profileOpen}
        onClose={handleCloseProfile}
        profile={profileData}
        isLoading={profileLoading}
        error={profileError}
      />

      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />

      <TipModal isOpen={tipOpen} onClose={() => setTipOpen(false)} />
    </div>
  );
}