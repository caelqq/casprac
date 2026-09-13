"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { X, ArrowLeftRight, AlertCircle, CheckCircle2 } from "lucide-react";
import { useBalance } from "@/contexts/BalanceContext";

type TipModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const BACKEND_URL = "http://localhost:3001";

// A standalone Tip popup opened from the Account Menu — visually
// different from the Wallet modal's Tip tab, but the same underlying
// logic (recipient + amount + ½/2× shortcuts + invalid-amount check).
//
// userBalance is read from BalanceContext (the same source the header's
// balance pill uses), converted from cents to a plain dollar number
// since this modal's math (½, 2×, .toFixed(2), MAX display) all works
// in dollars.
//
// The actual send now calls the real backend endpoint (POST
// /users/me/tip). The client-side checks below (amount > 0, amount <=
// userBalance) only make the UI feel responsive — the backend redoes
// every one of these checks itself against the real database balance,
// since a client-side check can always be bypassed by editing the
// page's JavaScript.
export default function TipModal({ isOpen, onClose }: TipModalProps) {
  const { balanceCents, refreshBalance } = useBalance();
  const userBalance = balanceCents / 100;

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("0.01");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // Auto-dismiss the error toast after a few seconds.
  useEffect(() => {
    if (!errorMessage) return;
    const timer = setTimeout(() => setErrorMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [errorMessage]);

  // Auto-dismiss the success toast after a few seconds too.
  useEffect(() => {
    if (!successMessage) return;
    const timer = setTimeout(() => setSuccessMessage(null), 4000);
    return () => clearTimeout(timer);
  }, [successMessage]);

  // Reset the form whenever the modal closes, so reopening it later
  // doesn't show stale data from a previous attempt.
  useEffect(() => {
    if (!isOpen) {
      setRecipient("");
      setAmount("0.01");
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const numericAmount = parseFloat(amount);
  const hasBalance = userBalance > 0;

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
    if (!recipient.trim()) {
      setErrorMessage("Enter a username");
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0 || numericAmount > userBalance) {
      setErrorMessage("Invalid Amount");
      return;
    }

    setIsSending(true);
    setErrorMessage(null);

    try {
      const res = await fetch(`${BACKEND_URL}/users/me/tip`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientUsername: recipient.trim(),
          // Convert dollars back to whole cents, same rounding approach
          // used everywhere else in this project (e.g. Mines bets) —
          // never send a fractional-cent amount to the backend.
          amountCents: Math.round(numericAmount * 100),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        // NestJS's default error shape puts the human-readable reason
        // in `message` (e.g. "Insufficient balance", "No user found
        // with username \"x\"") — same pattern used for every other
        // fetch call in this project (Mines, etc).
        throw new Error(body?.message || "Failed to send tip");
      }

      const data: { newBalanceCents: number; recipientUsername: string; amountCents: number } =
        await res.json();

      setSuccessMessage(`Tipped $${(data.amountCents / 100).toFixed(2)} to ${data.recipientUsername}`);
      setRecipient("");
      setAmount("0.01");

      // The backend just moved real money — refresh so the header's
      // balance pill (and this modal's own MAX display) reflect the new,
      // lower balance immediately instead of waiting for a page reload.
      refreshBalance();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Failed to send tip");
    } finally {
      setIsSending(false);
    }
  };

  return createPortal(
    <>
      <div
        onClick={onClose}
        className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      >
        <div
          onClick={(e) => e.stopPropagation()}
          className="modal-card w-full max-w-sm bg-surface border border-border rounded-2xl p-6 relative animate-in fade-in zoom-in-95 duration-200"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-5 right-5 text-muted hover:text-foreground hover:rotate-90 transition-all duration-200"
          >
            <X size={18} />
          </button>

          <div className="flex items-center gap-2 mb-5">
            <ArrowLeftRight size={20} className="text-violet-400" />
            <h2 className="text-lg font-display font-bold text-foreground">
              Tip
            </h2>
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted mb-2">
                Username
              </p>
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Username"
                disabled={isSending}
                className="w-full h-11 rounded-lg border border-border bg-background px-3.5 text-sm text-foreground placeholder:text-muted focus:outline-none focus:border-violet-400/50 transition-colors duration-200 disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                  Tip Amount
                </p>
                <p className="text-xs text-muted">
                  MAX ({userBalance.toFixed(2)} USD)
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
                  disabled={isSending}
                  className="flex-1 min-w-0 bg-transparent text-sm font-medium text-foreground focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={handleHalf}
                  disabled={isSending}
                  className="text-xs font-semibold text-muted hover:text-foreground bg-surface hover:bg-border rounded-md px-2.5 py-1.5 transition-colors duration-200 disabled:opacity-60"
                >
                  ½
                </button>
                <button
                  type="button"
                  onClick={handleDouble}
                  disabled={isSending}
                  className="text-xs font-semibold text-muted hover:text-foreground bg-surface hover:bg-border rounded-md px-2.5 py-1.5 transition-colors duration-200 disabled:opacity-60"
                >
                  2×
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSendTip}
              disabled={!hasBalance || isSending}
              className={`w-full h-11 rounded-lg text-sm font-semibold tracking-wide transition-all duration-200 ${
                hasBalance && !isSending
                  ? "bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white cursor-pointer"
                  : "bg-border text-muted cursor-not-allowed"
              }`}
            >
              {!hasBalance ? "NO BALANCE" : isSending ? "SENDING..." : "SEND TIP"}
            </button>
          </div>
        </div>
      </div>

      {errorMessage && (
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
        </div>
      )}

      {successMessage && (
        <div className="fixed bottom-6 right-6 z-[60] flex items-center gap-2.5 bg-surface border border-border border-l-4 border-l-emerald-500 rounded-lg pl-3.5 pr-3 py-3 shadow-lg animate-in fade-in slide-in-from-bottom-2 duration-200">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span className="text-sm text-foreground">{successMessage}</span>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            aria-label="Dismiss"
            className="text-muted hover:text-foreground transition-colors duration-200 ml-1"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>,
    document.body,
  );
}