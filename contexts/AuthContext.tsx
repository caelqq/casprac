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
  avatarUrl?: string;
}

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
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
          // DIAGNOSTIC LOGGING: this is new. If the logout bug happens
          // again, check the browser console for this exact message —
          // it tells us whether the backend actively rejected the
          // request (e.g. 401, meaning the cookie either wasn't sent or
          // was invalid) versus some other failure.
          console.warn(
            `[AuthContext] /users/me returned ${response.status} — treating as logged out.`
          );
          setUser(null);
        }
      } catch (err) {
        // A network-level failure (backend unreachable, CORS blocked
        // entirely, etc.) lands here instead — different root cause
        // than a 401, so logging it separately matters.
        console.error("[AuthContext] /users/me request failed entirely:", err);
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
      console.error("[AuthContext] logout request failed:", err);
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