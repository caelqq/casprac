// components/games/mines/MinesTile.tsx
'use client';

import { Bomb, Gem } from 'lucide-react';

interface MinesTileProps {
  index: number;
  isRevealed: boolean;
  isMine: boolean;
  isClickable: boolean;
  previewMultiplier: number | null;
  onClick: (index: number) => void;
  onHoverStart: (index: number) => void;
  onHoverEnd: () => void;
}

export default function MinesTile({
  index,
  isRevealed,
  isMine,
  isClickable,
  previewMultiplier,
  onClick,
  onHoverStart,
  onHoverEnd,
}: MinesTileProps) {
  const showGem = isRevealed && !isMine;
  const showMine = isRevealed && isMine;
  const showPreview = !isRevealed && isClickable && previewMultiplier !== null;

  return (
    <button
      type="button"
      disabled={!isClickable}
      onClick={() => onClick(index)}
      onMouseEnter={() => onHoverStart(index)}
      onMouseLeave={onHoverEnd}
      className={`
        relative aspect-square w-full rounded-lg flex items-center justify-center
        transition-all duration-150 ease-out
        ${showGem ? 'bg-emerald-600 shadow-lg shadow-emerald-600/30 scale-100' : ''}
        ${showMine ? 'bg-red-600 shadow-lg shadow-red-600/30' : ''}
        ${!showGem && !showMine ? 'bg-zinc-800 border border-zinc-700' : ''}
        ${isClickable ? 'hover:bg-zinc-700 hover:scale-[1.03] hover:border-indigo-500 cursor-pointer active:scale-95' : 'cursor-default'}
      `}
    >
      {showGem && (
        <Gem className="w-1/2 h-1/2 text-white animate-[fadeIn_0.2s_ease-out]" />
      )}
      {showMine && (
        <Bomb className="w-1/2 h-1/2 text-white animate-[fadeIn_0.2s_ease-out]" />
      )}

      {showPreview && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="text-base font-bold text-indigo-200 font-mono drop-shadow-[0_2px_3px_rgba(0,0,0,0.9)]">
            {previewMultiplier!.toFixed(2)}x
          </span>
        </span>
      )}
    </button>
  );
}