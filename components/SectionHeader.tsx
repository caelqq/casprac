"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface SectionHeaderProps {
  title: string;
  showViewAll?: boolean;
  showArrows?: boolean;
  onViewAll?: () => void;
  onPrev?: () => void;
  onNext?: () => void;
}

// Shared "section title + divider line + (optional View All) + (optional
// prev/next arrows)" header used above horizontal rows on /home (Check this
// out, Original Games, etc.) so we don't repeat this markup on every section.
export default function SectionHeader({
  title,
  showViewAll = false,
  showArrows = true,
  onViewAll,
  onPrev,
  onNext,
}: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-4 mb-6">
      <h2 className="text-xl font-display font-bold text-foreground whitespace-nowrap">
        {title}
      </h2>
      <div className="flex-1 h-px bg-border" />

      {showViewAll && (
        <button
          type="button"
          onClick={onViewAll}
          className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-semibold rounded-full px-4 py-1.5 transition-colors duration-200 whitespace-nowrap"
        >
          View All
        </button>
      )}

      {showArrows && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrev}
            aria-label="Scroll left"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-foreground hover:border-violet-400/40 transition-colors duration-200"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={onNext}
            aria-label="Scroll right"
            className="flex items-center justify-center w-8 h-8 rounded-full bg-surface border border-border text-muted hover:text-foreground hover:border-violet-400/40 transition-colors duration-200"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}