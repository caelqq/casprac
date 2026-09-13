import type { Metadata } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";
import FluidBackground from "@/components/FluidBackground";
import { AuthProvider } from "@/contexts/AuthContext";
import { BalanceProvider } from "@/contexts/BalanceContext";
import AuthRedirect from "@/components/AuthRedirect";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["600", "700", "800"],
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Casilo",
  description: "Casilo — a practice casino demo project",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${sora.variable} ${inter.variable} antialiased bg-background text-foreground font-sans min-h-screen`}
      >
        <FluidBackground />
        <AuthProvider>
          {/* BalanceProvider goes INSIDE AuthProvider — it needs to know
              who's logged in (via useAuth) before it can decide whether
              to fetch a balance at all. */}
          <BalanceProvider>
            <AuthRedirect />
            <AppShell>{children}</AppShell>
          </BalanceProvider>
        </AuthProvider>
      </body>
    </html>
  );
}