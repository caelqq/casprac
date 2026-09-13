"use client";

import { ReactNode } from "react";
import { ChatProvider, useChat } from "@/contexts/ChatContext";
import { AuthModalProvider } from "@/contexts/AuthModalContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ChatPanel from "@/components/ChatPanel";
import LoginModal from "@/components/LoginModal";
import RegisterModal from "@/components/RegisterModal";

function Shell({ children }: { children: ReactNode }) {
  const { isOpen, width } = useChat();

  return (
    <>
      <ChatPanel />
      <div
        className="flex flex-col min-h-screen transition-[margin] duration-200"
        style={{ marginLeft: isOpen ? width : 0 }}
      >
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <LoginModal />
      <RegisterModal />
    </>
  );
}

export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <ChatProvider>
      <AuthModalProvider>
        <Shell>{children}</Shell>
      </AuthModalProvider>
    </ChatProvider>
  );
}