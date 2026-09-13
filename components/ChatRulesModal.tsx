"use client";

import { X, Sword } from "lucide-react";

const RULES = [
  "Do not spam.",
  "Do not beg.",
  "Do not harass or be offensive to other players.",
  "Do not share any personal information of you or other players.",
  "Do not advertise cases in rooms other than case ad.",
  "Only speak the mentioned language in the rooms.",
  "Do not share non-Casilo links.",
  "Do not advertise.",
];

type ChatRulesModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

export default function ChatRulesModal({ isOpen, onClose }: ChatRulesModalProps) {
  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      className="modal-backdrop fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="modal-card w-full max-w-md bg-surface border border-border rounded-2xl p-6 relative"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-5 right-5 text-muted hover:text-foreground transition-colors duration-200"
        >
          <X size={18} />
        </button>

        <div className="flex items-center gap-2 mb-5">
          <Sword size={20} className="text-violet-400" />
          <h2 className="text-lg font-display font-bold text-foreground">
            Chat Rules
          </h2>
        </div>

        <ol className="space-y-3 mb-6">
          {RULES.map((rule, i) => (
            <li key={i} className="flex items-start gap-3 text-sm text-foreground">
              <span className="shrink-0 w-5 h-5 rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 text-white text-xs font-semibold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="leading-relaxed">{rule}</span>
            </li>
          ))}
        </ol>

        <button
          onClick={onClose}
          className="w-full bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-400 hover:to-indigo-400 text-white text-sm font-semibold rounded-lg py-3 transition-all duration-200"
        >
          I understand
        </button>
      </div>
    </div>
  );
}