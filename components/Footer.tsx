import Image from "next/image";
import { Headphones, Mail, ChevronDown } from "lucide-react";

const SUPPORT_EMAIL = "foneofficials@gmail.com";
const SUPPORT_SUBJECT = "Casilo support request";
const SUPPORT_BODY = "Hi Casilo team,\n\nDescribe your issue here.\n\nUsername:";

const mailtoHref = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(SUPPORT_SUBJECT)}&body=${encodeURIComponent(SUPPORT_BODY)}`;

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border bg-background">
      <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 sm:grid-cols-3 gap-10">
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Support</h3>
          <div className="flex flex-col gap-2">
            <button className="flex items-center gap-2 text-sm font-medium text-foreground bg-surface border border-border rounded-lg px-4 py-2 w-fit hover:bg-white/5 hover:border-white/20 transition-colors duration-200">
              <Headphones size={16} />
              Live Support
            </button>
            <a href={mailtoHref} className="flex items-center gap-2 text-sm font-medium text-foreground bg-surface border border-border rounded-lg px-4 py-2 w-fit hover:bg-white/5 hover:border-white/20 transition-colors duration-200">
              <Mail size={16} />
              Email Us
            </a>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Legal</h3>
          <ul className="space-y-2 text-sm text-muted">
            <li className="hover:text-foreground transition-colors duration-200 cursor-pointer">
              Terms &amp; Conditions
            </li>
            <li className="hover:text-foreground transition-colors duration-200 cursor-pointer">
              Privacy Notice
            </li>
            <li className="hover:text-foreground transition-colors duration-200 cursor-pointer">
              Responsible Gaming
            </li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-foreground mb-4">Community</h3>
          <div className="flex gap-2">
            <a href="#" aria-label="Discord" className="flex items-center justify-center w-9 h-9 rounded-lg bg-black border border-border overflow-hidden hover:border-white/20 transition-colors duration-200">
              <Image src="/icons/discordphot.jpg" alt="Discord" width={20} height={20} />
            </a>
            <a href="#" aria-label="X" className="flex items-center justify-center w-9 h-9 rounded-lg bg-black border border-border overflow-hidden hover:border-white/20 transition-colors duration-200">
              <Image src="/icons/xphot.jpg" alt="X" width={20} height={20} />
            </a>
            <a href="#" aria-label="Twitch" className="flex items-center justify-center w-9 h-9 rounded-lg bg-black border border-border overflow-hidden hover:border-white/20 transition-colors duration-200">
              <Image src="/icons/twitchphot.jpg" alt="Twitch" width={20} height={20} />
            </a>
            <a href="#" aria-label="Instagram" className="flex items-center justify-center w-9 h-9 rounded-lg bg-black border border-border overflow-hidden hover:border-white/20 transition-colors duration-200">
              <Image src="/icons/instagramphot.jpg" alt="Instagram" width={20} height={20} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-10">
          <span className="text-xl font-display font-extrabold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
            Casilo
          </span>

          <div className="mt-4 space-y-3 text-xs text-muted leading-relaxed max-w-3xl">
            <p>
              This is a practice project built for learning purposes only and
              is not a real gambling platform. No real money, wagering, or
              gaming services are offered here. Any resemblance to a real
              operator is purely for design-study purposes.
            </p>
            <p>
              Contact us: <a href={mailtoHref} className="text-foreground font-medium hover:text-violet-300 transition-colors duration-200">{SUPPORT_EMAIL}</a>
            </p>
            <p className="text-foreground font-semibold">
              18+ | Play Responsibly.{" "}
              <span className="font-normal text-muted">
                If gambling stops being fun, it&apos;s time to take a break.
                This demo does not process real wagers or payments.
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <p className="text-xs text-muted">
            Copyright © {year} Casilo. All rights reserved.
          </p>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-1 text-xs font-medium text-foreground bg-surface border border-border rounded-lg px-3 py-2 hover:bg-white/5 hover:border-white/20 transition-colors duration-200">
              English
              <ChevronDown size={14} />
            </button>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-bold tracking-wide bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                VISA
              </span>
              <span className="text-[10px] font-bold tracking-wide bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                MASTERCARD
              </span>
              <span className="text-[10px] font-bold bg-gradient-to-r from-violet-400 to-indigo-400 bg-clip-text text-transparent">
                18+
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}