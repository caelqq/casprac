// frontend/contexts/BalanceContext.tsx

"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useAuth } from "@/contexts/AuthContext";

const BACKEND_URL = "http://localhost:3001";

type BalanceContextValue = {
  // The user's real balance, in cents, straight from the database.
  balanceCents: number;
  // True only while a fetch is actively in flight.
  isLoading: boolean;
  // Call this after any action that changes the user's balance (e.g.
  // sending a tip) so every component reading from this context
  // updates together, instead of each screen showing a different
  // stale number until a full page reload.
  refreshBalance: () => Promise<void>;
};

const BalanceContext = createContext<BalanceContextValue | undefined>(
  undefined,
);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [balanceCents, setBalanceCents] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const refreshBalance = useCallback(async () => {
    // No logged-in user means there's nothing to fetch — balance is
    // just 0 (matches how the rest of the app treats a logged-out
    // state).
    if (!user) {
      setBalanceCents(0);
      return;
    }

    setIsLoading(true);
    try {
      // credentials: "include" is required here, same as every other
      // authenticated fetch in this project — without it, the browser
      // won't send the httpOnly auth_token cookie, and this request
      // would silently come back as "not logged in" even though the
      // user actually is.
      const response = await fetch(`${BACKEND_URL}/users/me/balance`, {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to load balance");
      }

      const data: { balanceCents: number } = await response.json();
      setBalanceCents(data.balanceCents);
    } catch {
      // A transient network hiccup shouldn't wipe the number back to 0
      // and make it look like the user's money vanished — just leave
      // whatever we last successfully fetched in place.
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  // Automatically fetch (or reset) balance whenever the logged-in user
  // changes — covers login, logout, and the initial page load once
  // AuthContext finishes figuring out who's logged in.
  useEffect(() => {
    refreshBalance();
  }, [refreshBalance]);

  return (
    <BalanceContext.Provider
      value={{ balanceCents, isLoading, refreshBalance }}
    >
      {children}
    </BalanceContext.Provider>
  );
}

export function useBalance() {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error("useBalance must be used within a BalanceProvider");
  }
  return context;
}