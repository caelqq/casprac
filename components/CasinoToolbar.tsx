"use client";

import { useState } from "react";
import {
  Dice5,
  Gamepad2,
  Radio,
  Trophy,
  Search,
  ChevronDown,
} from "lucide-react";

const TABS = [
  { label: "Games", icon: Gamepad2 },
  { label: "Live Games", icon: Radio },
  { label: "Sports", icon: Trophy },
];

const SORT_OPTIONS = ["Popular", "Category", "Event"];

interface CasinoToolbarProps {
  // Both optional — if a parent passes these, the tab selection becomes
  // "controlled" so the parent can react to tab changes (e.g. show/hide
  // the Original Games grid). If omitted, the toolbar just manages its
  // own tab state internally like before.
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}

export default function CasinoToolbar({
  activeTab: activeTabProp,
  onTabChange,
}: CasinoToolbarProps) {
  const [internalActiveTab, setInternalActiveTab] = useState("Games");
  const [sortBy, setSortBy] = useState("Popular");
  const [sortOpen, setSortOpen] = useState(false);

  const activeTab = activeTabProp ?? internalActiveTab;

  const handleTabClick = (label: string) => {
    onTabChange?.(label);
    if (activeTabProp === undefined) {
      setInternalActiveTab(label);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6 pt-10">
      <div className="flex items-center gap-2 mb-4">
        <Dice5 size={22} className="text-foreground" />
        <h1 className="text-xl font-display font-bold text-foreground">
          Casino
        </h1>
      </div>

      <div className="flex items-center gap-2 mb-6">
        {TABS.map(({ label, icon: Icon }) => {
          const isActive = activeTab === label;
          return (
            <button
              key={label}
              onClick={() => handleTabClick(label)}
              className={`flex items-center gap-2 text-sm font-medium rounded-full px-4 py-2 border transition-colors duration-200 ${
                isActive
                  ? "bg-surface border-white/20 text-foreground"
                  : "bg-transparent border-border text-muted hover:text-foreground hover:border-white/20"
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3">
        <div className="w-full max-w-md relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            placeholder="Search"
            maxLength={32}
            className="w-full bg-surface border border-border rounded-lg pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted outline-none focus:border-white/20 transition-colors duration-200"
          />
        </div>

        <div className="relative shrink-0">
          <button
            onClick={() => setSortOpen((v) => !v)}
            className="flex items-center justify-between gap-2 text-sm font-medium text-foreground bg-surface border border-border rounded-lg px-4 py-2.5 hover:border-white/20 transition-colors duration-200 w-44"
          >
            <span>Sort by: {sortBy}</span>
            <ChevronDown size={14} className="shrink-0" />
          </button>

          {sortOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-surface border border-border rounded-lg overflow-hidden z-10">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option}
                  onClick={() => {
                    setSortBy(option);
                    setSortOpen(false);
                  }}
                  className={`w-full text-left text-sm px-4 py-2.5 transition-colors duration-200 ${
                    sortBy === option
                      ? "text-foreground bg-white/5"
                      : "text-muted hover:text-foreground hover:bg-white/5"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}