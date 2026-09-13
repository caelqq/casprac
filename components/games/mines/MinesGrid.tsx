// components/games/mines/MinesGrid.tsx
'use client';

import { useState, useEffect } from 'react';
import MinesTile from './MinesTile';
import { calculateMultiplier } from '@/lib/mines-math';
import { MinesRoundState } from '@/types/mines';

interface MinesGridProps {
  round: MinesRoundState;
  onTileClick: (index: number) => void;
}

export default function MinesGrid({ round, onTileClick }: MinesGridProps) {
  const [hoveredTile, setHoveredTile] = useState<number | null>(null);
  const columns = Math.sqrt(round.totalTiles);

  // Whenever the grid size changes (4x4 -> 5x5, etc.), briefly fade the whole
  // grid out then back in. round.totalTiles changing is what triggers this —
  // it fires every time the grid dimensions change.
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setIsResizing(true);
    const timeout = setTimeout(() => setIsResizing(false), 200);
    return () => clearTimeout(timeout);
  }, [round.totalTiles]);

  const isRoundActive = round.status === 'active';

  return (
    <div
      className={`grid gap-2 w-full max-w-xl mx-auto transition-opacity duration-200 ease-in-out ${
        isResizing ? 'opacity-0' : 'opacity-100'
      }`}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: round.totalTiles }, (_, index) => {
        const isRevealed =
          round.revealedTiles.includes(index) ||
          (round.status !== 'active' && round.status !== 'idle' && round.minePositions.includes(index));
        const isMine = round.minePositions.includes(index);
        const isClickable = isRoundActive && !round.revealedTiles.includes(index);

        const previewMultiplier =
          isRoundActive && hoveredTile === index
            ? calculateMultiplier(round.totalTiles, round.minesCount, round.revealedTiles.length + 1)
            : null;

        return (
          <MinesTile
            key={index}
            index={index}
            isRevealed={isRevealed}
            isMine={isMine}
            isClickable={isClickable}
            previewMultiplier={previewMultiplier}
            onClick={onTileClick}
            onHoverStart={setHoveredTile}
            onHoverEnd={() => setHoveredTile(null)}
          />
        );
      })}
    </div>
  );
}