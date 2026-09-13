"use client";

import React from "react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  X,
  Wallet as WalletIcon,
  CreditCard,
  Smartphone,
  Landmark,
  Banknote,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { useBalance } from "@/contexts/BalanceContext";
import { centsToDollarsString, dollarsStringToCents } from "@/lib/money";

const BACKEND_URL = "http://localhost:3001";

type WalletModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

type TabId = "deposit" | "withdraw" | "tip";

const TABS: { id: TabId; label: string }[] = [
  { id: "deposit", label: "Deposit" },
  { id: "withdraw", label: "Withdraw" },
  { id: "tip", label: "Tip" },
];

// Shared row used for every payment method (Dollar, Crypto, Cash). All
// positioning is absolute inside a `relative` row so the icon can
// genuinely animate its own position (left offset -> centered) via
// `transition-all`, rather than two separate layers crossfading — that's
// what makes the motion read as "sliding" instead of "blinking".
//
// `hoverBg` is a literal Tailwind class (e.g. "hover:bg-orange-500/25")
// passed in per row so each coin/method fills with its own color on hover.
//
// `href` is optional — when provided, this row renders as a real link
// (used for the Dollar row, which links out to Facebook) instead of a
// disabled, non-interactive div.
function HoverFillRow({
  icon,
  label,
  hoverBg,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  hoverBg: string;
  href?: string;
}) {
  const rowClassName =
    "group relative block w-full h-[52px] rounded-lg border border-border bg-background opacity-70 " +
    (href ? "cursor-pointer" : "cursor-not-allowed") +
    " overflow-hidden transition-all duration-300 ease-out group-hover:opacity-100 hover:opacity-100 hover:border-transparent " +
    hoverBg;

  const innerContent = (
    <>
      {/* Icon — sits at a fixed left offset by default, its `left`
          position transitions to 50% (dead center) on hover. Both the
          position change AND the scale-up are driven by the same
          transition, so it reads as one smooth glide. */}
      <div className="absolute top-1/2 left-[28px] -translate-y-1/2 -translate-x-1/2 transition-all duration-300 ease-out group-hover:left-1/2 group-hover:scale-110">
        <div className="w-7 h-7 rounded-full bg-surface border border-border flex items-center justify-center shrink-0">
          {icon}
        </div>
      </div>

      {/* Label — positioned right after the icon's default spot. Fades
          and nudges left slightly as it disappears on hover. */}
      <span className="absolute top-1/2 left-[52px] -translate-y-1/2 max-w-[calc(100%-90px)] text-sm font-medium text-foreground truncate transition-all duration-300 group-hover:opacity-0 group-hover:-translate-x-2">
        {label}
      </span>

      {/* Badge — top right, fades out on hover. Only shown for rows that
          don't have a real destination yet (no href) — a row that's
          actually linked out, like Dollar, isn't "coming soon". */}
      {!href && (
        <span className="absolute top-1/2 right-3.5 -translate-y-1/2 text-[10px] font-semibold uppercase tracking-wide bg-border text-muted rounded-full px-2 py-0.5 transition-opacity duration-300 group-hover:opacity-0">
          Soon
        </span>
      )}
    </>
  );

  if (href) {
    // Real link — opens in a new tab. rel="noopener noreferrer" is a
    // security best practice for any target="_blank" link: "noopener"
    // stops the new tab from getting a `window.opener` reference back
    // to this page, and "noreferrer" stops the browser from sending
    // this page's URL as a referrer to the destination.
    const linkProps = {
      href: href,
      target: "_blank",
      rel: "noopener noreferrer",
      className: rowClassName,
    };
    return React.createElement("a", linkProps, innerContent);
  }

  return (
    <div className={rowClassName} aria-disabled="true">
      {innerContent}
    </div>
  );
}

// Small colored badge used for crypto rows in place of real brand logos
// (which are copyrighted assets we intentionally avoid reproducing).
function CryptoBadge({ ticker, bg }: { ticker: string; bg: string }) {
  return (
    <span
      className={`text-[9px] font-bold text-white ${bg} w-full h-full rounded-full flex items-center justify-center`}
    >
      {ticker}
    </span>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2.5">
      {children}
    </p>
  );
}

// The Tip tab. Now wired to the REAL balance (via BalanceContext) and
// the REAL tip endpoint (POST /users/me/tip).
//
// SECURITY NOTE: the amount/balance checks done here (in the browser)
// are purely for a responsive UI — they make the button feel instant
// and avoid a pointless network request for an obviously-invalid
// amount. They are NOT the real security boundary. The backend redoes
// every one of these checks itself, using the sender's balance read
// fresh from the database inside a single transaction — because a
// client-side check like this can always be bypassed (e.g. by editing
// the page's JavaScript). If the browser and server ever disagree, the
// server's answer is what actually happens to anyone's money.
function TipTab() {
  const { balanceCents, refreshBalance } = useBalance();

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Auto-dismiss the toasts after a few seconds, same as most toast UIs.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  const numericAmount = parseFloat(amount);

  // ½ and 2× are just typing shortcuts — they read whatever number is
  // currently in the amount field and halve/double it, so the user
  // doesn't have to clear the field and retype a new number.
  const handleHalf = () => {
    if (isNaN(numericAmount)) return;
    setAmount((numericAmount / 2).toFixed(2));
  };

  const handleDouble = () => {
    if (isNaN(numericAmount)) return;
    setAmount((numericAmount * 2).toFixed(2));
  };

  const handleSendTip = async () => {
    const trimmedRecipient = recipient.trim();
    const amountCents = dollarsStringToCents(amount);

    if (!trimmedRecipient) {
      setErrorMessage("Enter a recipient username");
      return;
    }

    if (amountCents === null || amountCents <= 0 || amountCents > balanceCents) {
      setErrorMessage("Invalid Amount");
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch(`${BACKEND_URL}/users/me/tip`, {
        method: "POST",
        // Required so the browser sends the httpOnly auth_token cookie
        // — without this, the backend would see the request as logged
        // out, even though the user really is logged in.
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUsername: trimmedRecipient,
          amountCents,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setErrorMessage(data?.message ?? "Something went wrong");
        return;
      }

      // Pull the sender's fresh balance back into every component that
      // reads from BalanceContext (Header pill, this tab, TipModal).
      await refreshBalance();
      setSuccessMessage(`Tip sent to ${trimmedRecipient}!`);
      setRecipient("");
      setAmount("0.01");
    } catch {
      setErrorMessage("Network error — please try again");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-5 animate-in fade-in duration-200">
      <div>
        <SectionHeading>Recipient Username</SectionHeading>
        <input
          type="text"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          placeholder="Username"
          className="w-full h-11 rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-violet-400/50 transition-colors duration-200"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Amount
          </p>
          <p className="text-xs text-muted">
            MAX ({centsToDollarsString(balanceCents)} USD)
          </p>
        </div>
        <div className="flex items-center h-11 rounded-lg border border-border bg-background pl-2.5 pr-1.5 gap-2">
          <span className="w-6 h-6 rounded-full bg-green-500 flex items-center justify-center shrink-0">
            <Image src="/icons/dollarphot.svg" alt="" width={12} height={12} />
          </span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button
            type="button"
            onClick={handleHalf}
            className="text-xs font-semibold text-muted hover:text-foreground bg-surface hover:bg-border rounded-md px-2.5 py-1.5 transition-colors duration-200"
          >
            ½
          </button>
          <button
            type="button"
            onClick={handleDouble}
            className="text-xs font-semibold text-muted hover:text-foreground bg-surface hover:bg-border rounded-md px-2.5 py-1.5 transition-colors duration-200"
          >
            2×
          </button>
        </div>
      </div>

      <button
        type="button"
        onClick={handleSendTip}
        disabled={isSending}
        className="w-full h-11 rounded-lg bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 disabled:opacity-60 disabled:cursor-not-allowed text-white text-sm font-semibold tracking-wide transition-all duration-200"
      >
        {isSending ? "SENDING..." : "SEND TIP"}
      </button>

      {errorMessage &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 bg-surface border border-border border-l-4 border-l-red-500 rounded-lg pl-3.5 pr-3 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <AlertCircle size={16} className="text-red-400 shrink-0" />
            <span className="text-sm text-foreground">{errorMessage}</span>
            <button
              type="button"
              onClick={() => setErrorMessage(null)}
              aria-label="Dismiss"
              className="text-muted hover:text-foreground transition-colors duration-200 ml-1"
            >
              <X size={14} />
            </button>
          </div>,
          document.body,
        )}

      {successMessage &&
        createPortal(
          <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 bg-surface border border-border border-l-4 border-l-green-500 rounded-lg pl-3.5 pr-3 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
            <CheckCircle2 size={16} className="text-green-400 shrink-0" />
            <span className="text-sm text-foreground">{successMessage}</span>
            <button
              type="button"
              onClick={() => setSuccessMessage(null)}
              aria-label="Dismiss"
              className="text-muted hover:text-foreground transition-colors duration-200 ml-1"
            >
              <X size={14} />
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
}

export default function WalletModal({ isOpen, onClose }: WalletModalProps) {
  const [activeTab, setActiveTab] = useState<TabId>("deposit");

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!isOpen || !mounted) return null;

  return createPortal(
    <div
      onClick={onClose}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card w-full max-w-2xl bg-surface border border-border rounded-2xl p-7 relative max-h-[85vh] overflow-y-auto chat-scrollbar animate-in fade-in zoom-in-95 duration-200"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-6 right-6 text-muted hover:text-foreground hover:rotate-90 transition-all duration-200"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <WalletIcon size={22} className="text-violet-400" />
          <h2 className="text-xl font-display font-bold text-foreground">
            Wallet
          </h2>
        </div>

        {/* Tab strip */}
        <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto scrollbar-none">
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

        {activeTab === "deposit" ? (
          <div className="flex flex-col gap-5 animate-in fade-in duration-200">
            {/* In Game — Dollar row, fills green on hover, links to Facebook */}
            <div>
              <SectionHeading>In Game</SectionHeading>
              <HoverFillRow
                icon={
                  <Image src="/icons/dollarphot.svg" alt="" width={14} height={14} />
                }
                label="Dollar"
                hoverBg="hover:bg-green-500"
                href="https://www.facebook.com/Jebwz"
              />
            </div>

            {/* Crypto — each row fills with that coin's own color */}
            <div>
              <SectionHeading>Crypto</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <HoverFillRow
                  icon={<CryptoBadge ticker="BTC" bg="bg-orange-500" />}
                  label="BTC"
                  hoverBg="hover:bg-orange-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="ETH" bg="bg-blue-500" />}
                  label="ETH"
                  hoverBg="hover:bg-blue-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="USDC" bg="bg-sky-500" />}
                  label="USDC"
                  hoverBg="hover:bg-sky-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="USDT" bg="bg-emerald-500" />}
                  label="USDT"
                  hoverBg="hover:bg-emerald-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="SOL" bg="bg-violet-500" />}
                  label="SOL"
                  hoverBg="hover:bg-violet-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="LTC" bg="bg-slate-400" />}
                  label="LTC"
                  hoverBg="hover:bg-slate-400/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="TRX" bg="bg-red-500" />}
                  label="TRX"
                  hoverBg="hover:bg-red-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="BNB" bg="bg-yellow-500" />}
                  label="BNB"
                  hoverBg="hover:bg-yellow-500/25"
                />
                <HoverFillRow
                  icon={<CryptoBadge ticker="XRP" bg="bg-neutral-800" />}
                  label="XRP"
                  hoverBg="hover:bg-neutral-500/25"
                />
              </div>
            </div>

            {/* Cash — subtle tint matching each method's usual brand tone */}
            <div>
              <SectionHeading>Cash</SectionHeading>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <HoverFillRow
                  icon={<CreditCard size={14} className="text-muted" />}
                  label="Cards"
                  hoverBg="hover:bg-neutral-500/25"
                />
                <HoverFillRow
                  icon={<WalletIcon size={14} className="text-muted" />}
                  label="PayPal"
                  hoverBg="hover:bg-blue-500/25"
                />
                <HoverFillRow
                  icon={<Smartphone size={14} className="text-muted" />}
                  label="Apple Pay"
                  hoverBg="hover:bg-neutral-500/25"
                />
                <HoverFillRow
                  icon={<Smartphone size={14} className="text-muted" />}
                  label="Google Pay"
                  hoverBg="hover:bg-sky-500/25"
                />
                <HoverFillRow
                  icon={<Landmark size={14} className="text-muted" />}
                  label="Bank Transfer"
                  hoverBg="hover:bg-emerald-500/25"
                />
                <HoverFillRow
                  icon={<Banknote size={14} className="text-muted" />}
                  label="Paysafecard"
                  hoverBg="hover:bg-red-500/25"
                />
              </div>
            </div>
          </div>
        ) : activeTab === "tip" ? (
          <TipTab />
        ) : (
          <div className="py-10 text-center animate-in fade-in duration-200">
            <p className="text-sm text-muted">
              {TABS.find((t) => t.id === activeTab)?.label} is coming soon.
            </p>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}