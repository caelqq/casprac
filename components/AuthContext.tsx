"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";

interface User {
  id: string;
  username: string;
  email: string;
  // Path to the user's uploaded avatar image, e.g.
  // "/uploads/avatars/<uuid>.jpg", served by the backend. Null/undefined
  // means the user hasn't uploaded one yet — the UI should fall back to
  // showing their initial letter in that case.
  avatarUrl?: string | null;
}

interface AuthContextValue {
  user: User | null;
  // True while we're still checking /users/me on initial page load.
  // Lets the UI avoid a flash of "Login/Register" before we know for
  // sure whether the user is actually logged in.
  isLoading: boolean;
  // Called by LoginModal/RegisterModal right after a successful
  // login/register, so the rest of the app updates immediately without
  // needing to wait for a page refresh. Also reused by SettingsModal
  // right after a successful avatar upload, since the backend returns
  // the same full user shape (id, username, email, avatarUrl) in both
  // cases.
  setUser: (user: User) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch("http://localhost:3001/users/me", {
          credentials: "include",
        });

        if (response.ok) {
          const data = await response.json();
          setUser(data);
        } else {
          setUser(null);
        }
      } catch (err) {
        // Backend unreachable, or some other network issue — treat as
        // logged out rather than crashing the app.
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkSession();
  }, []);

  const logout = async () => {
    try {
      await fetch("http://localhost:3001/users/logout", {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      // Even if the request fails, clear the local state below so the UI
      // still reflects "logged out" immediately.
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, setUser, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}