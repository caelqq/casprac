// components/AuthRedirect.tsx
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

// Invisible component — renders nothing. Its only job is watching login
// state and the current URL, and redirecting when the two don't match
// where they should be:
//   - logged in, but sitting on the public landing page  -> go to /home
//   - logged out, but somehow sitting on an app page       -> go to /
export default function AuthRedirect() {
  const { user, isLoading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    // Wait until we actually know whether the user is logged in —
    // otherwise we'd redirect based on a false "not logged in" state
    // during the brief moment AuthContext is still checking /users/me.
    if (isLoading) return;

    // The ONLY public-only route is the bare landing page "/" itself.
    // Every other route (/home, /games/mines, /settings, future pages,
    // etc.) counts as "app area" — this way adding a new page never
    // requires touching this redirect logic again.
    const isPublicLandingPage = pathname === "/";

    if (user && isPublicLandingPage) {
      router.replace("/home");
    }

    if (!user && !isPublicLandingPage) {
      router.replace("/");
    }
  }, [user, isLoading, pathname, router]);

  return null;
}