"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { MessageCircle, Trophy, Gift, ChevronDown, Plus } from "lucide-react";
import { useChat } from "@/contexts/ChatContext";
import { useAuthModal } from "@/contexts/AuthModalContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBalance } from "@/contexts/BalanceContext";
import { centsToDollarsString } from "@/lib/money";
import AccountMenu from "@/components/AccountMenu";
import WalletModal from "@/components/WalletModal";

// Animates a cents value smoothly from its previous value to a new one
// whenever it changes, instead of jumping straight to the new number.
// Also reports which direction the change went in ("up" | "down" | null)
// so the caller can flash a color, then clears that flag after the
// animation finishes.
function useAnimatedBalance(targetCents: number, durationMs = 600) {
  const [displayCents, setDisplayCents] = useState(targetCents);
  const [flashDirection, setFlashDirection] = useState<"up" | "down" | null>(
    null,
  );
  const previousTargetRef = useRef(targetCents);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const startValue = previousTargetRef.current;
    const endValue = targetCents;

    // Nothing changed (e.g. first render, or an unrelated re-render) —
    // don't animate or flash.
    if (startValue === endValue) {
      return;
    }

    setFlashDirection(endValue > startValue ? "up" : "down");
    previousTargetRef.current = endValue;

    const startTime = performance.now();

    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / durationMs, 1);
      // Ease-out so the count-up slows down near the end instead of
      // stopping abruptly.
      const eased = 1 - Math.pow(1 - progress, 3);
      const currentValue = Math.round(
        startValue + (endValue - startValue) * eased,
      );
      setDisplayCents(currentValue);

      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(tick);
      } else {
        // Animation done — clear the flash a little after, so the
        // color fade-out (handled via CSS transition) has time to play.
        setTimeout(() => setFlashDirection(null), 400);
      }
    }

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [targetCents, durationMs]);

  return { displayCents, flashDirection };
}

export default function Header() {
  const { toggle } = useChat();
  const { openLogin, openRegister } = useAuthModal();
  const { user, isLoading } = useAuth();
  const { balanceCents } = useBalance();
  const pathname = usePathname();

  const { displayCents, flashDirection } = useAnimatedBalance(balanceCents);

  // Controls the Wallet modal (opened via the "+" button next to the
  // balance pill). Lives here since the button that triggers it lives
  // here — same pattern as how AuthModalContext works for Login/Register,
  // just local state since only this one button needs it.
  const [isWalletOpen, setIsWalletOpen] = useState(false);

  // Only the public landing page ("/") gets the logged-out header.
  // Every other route is "app area" and gets the balance/account header
  // (assuming the user is actually logged in — see the isAppArea && user
  // checks below). This is a denylist, same pattern as AuthRedirect.tsx:
  // instead of trying to list every logged-in route (which breaks the
  // moment a new route like /games/mines is added), we just exclude the
  // one route that's actually public.
  const isAppArea = pathname !== "/";

  return (
    <header className="border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-30">
      <div className="max-w-7xl mx-auto px-6 py-4 grid grid-cols-3 items-center">
        {/* Left column — logo */}
        <Link
          href="/"
          className="text-2xl font-display font-extrabold tracking-tight justify-self-start"
        >
          <span className="bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Casilo
          </span>
        </Link>

        {/* Center column — balance pill + deposit button (logged-in app area only) */}
        <div className="justify-self-center">
          {isAppArea && user && (
            <div className="flex items-center gap-3">
              {/* Balance pill — animates smoothly between old and new
                  values, and briefly tints green (increase) or red
                  (decrease) whenever the balance changes. */}
              <button
                type="button"
                className={`flex items-center gap-1 border rounded-full pl-2 pr-2.5 py-1 text-sm font-semibold transition-colors duration-300 ${
                  flashDirection === "up"
                    ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-300"
                    : flashDirection === "down"
                    ? "bg-red-500/15 border-red-500/40 text-red-300"
                    : "bg-surface border-border text-foreground hover:border-violet-400/40"
                }`}
              >
                <Image
                  src="/icons/dollarphot.svg"
                  alt=""
                  width={16}
                  height={16}
                />
                {centsToDollarsString(displayCents)}
                <ChevronDown size={12} className="text-muted" />
              </button>

              {/* Deposit button — opens the Wallet modal */}
              <button
                type="button"
                aria-label="Deposit"
                onClick={() => setIsWalletOpen(true)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 transition-all duration-200"
              >
                <Plus size={16} className="text-white" />
              </button>
            </div>
          )}
        </div>

        {/* Right column — account/trophy/gift/chat icons, or Login/Register when logged out */}
        <div className="justify-self-end flex items-center gap-3">
          {isAppArea && user ? (
            <>
              {/* Icon order matches reference: account, trophy, gift, chat */}
              <AccountMenu />

              <button
                type="button"
                aria-label="Rewards"
                className="text-muted hover:text-foreground transition-colors duration-200 p-2"
              >
                <Trophy size={18} />
              </button>

              <button
                type="button"
                aria-label="Gifts"
                className="text-muted hover:text-foreground transition-colors duration-200 p-2"
              >
                <Gift size={18} />
              </button>
            </>
          ) : isLoading ? (
            <div className="w-24 h-9" />
          ) : (
            <>
              <button
                onClick={openLogin}
                className="text-sm font-medium text-muted hover:text-foreground transition-colors duration-200"
              >
                Login
              </button>
              <button
                onClick={openRegister}
                className="text-sm font-semibold bg-foreground text-background rounded-full px-5 py-2 hover:scale-105 hover:bg-violet-200 transition-all duration-200"
              >
                Register
              </button>
            </>
          )}

          <button
            onClick={toggle}
            aria-label="Toggle chat"
            className="text-muted hover:text-foreground transition-colors duration-200 p-2"
          >
            <MessageCircle size={18} />
          </button>
        </div>
      </div>

      <WalletModal isOpen={isWalletOpen} onClose={() => setIsWalletOpen(false)} />
    </header>
  );
}