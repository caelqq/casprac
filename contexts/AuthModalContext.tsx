"use client";

import { createContext, useContext, useState, ReactNode } from "react";

type AuthModalMode = "closed" | "login" | "register";

type AuthModalContextType = {
  mode: AuthModalMode;
  openLogin: () => void;
  openRegister: () => void;
  close: () => void;
};

const AuthModalContext = createContext<AuthModalContextType | undefined>(
  undefined
);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<AuthModalMode>("closed");

  return (
    <AuthModalContext.Provider
      value={{
        mode,
        openLogin: () => setMode("login"),
        openRegister: () => setMode("register"),
        close: () => setMode("closed"),
      }}
    >
      {children}
    </AuthModalContext.Provider>
  );
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) {
    throw new Error("useAuthModal must be used within an AuthModalProvider");
  }
  return ctx;
}