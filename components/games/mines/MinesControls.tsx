// components/games/mines/MinesControls.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { getMaxMines, GRID_SIZES } from '@/lib/mines-math';
import { MinesStatus } from '@/types/mines';

interface MinesControlsProps {
  betCents: number;
  onBetChange: (cents: number) => void;
  gridSize: number;
  onGridSizeChange: (size: number) => void;
  minesCount: number;
  onMinesCountChange: (count: number) => void;
  status: MinesStatus;
  onStart: () => void;
  onCashout: () => void;
  disabled: boolean;
  maxBetCents: number;
}

export default function MinesControls({
  betCents,
  onBetChange,
  gridSize,
  onGridSizeChange,
  minesCount,
  onMinesCountChange,
  status,
  onStart,
  onCashout,
  disabled,
  maxBetCents,
}: MinesControlsProps) {
  const totalTiles = gridSize * gridSize;
  const maxMines = getMaxMines(totalTiles);
  const isActive = status === 'active';
  const maxBetDollars = maxBetCents / 100;

  const [betText, setBetText] = useState((betCents / 100).toFixed(2));
  const [betError, setBetError] = useState<string | null>(null);
  const isTypingRef = useRef(false);

  useEffect(() => {
    if (!isTypingRef.current) {
      setBetText((betCents / 100).toFixed(2));
    }
  }, [betCents]);

  function handleBetTextChange(raw: string) {
    isTypingRef.current = true;

    let cleaned = raw.replace(/[^0-9.]/g, '');

    const firstDotIndex = cleaned.indexOf('.');
    if (firstDotIndex !== -1) {
      const before = cleaned.slice(0, firstDotIndex + 1);
      const after = cleaned.slice(firstDotIndex + 1).replace(/\./g, '');
      cleaned = before + after;
    }

    const parsed = parseFloat(cleaned);
    const parsedCents = isNaN(parsed) ? 0 : Math.round(parsed * 100);

    // If this keystroke would push the bet over the max, reject it entirely —
    // betText is left unchanged, so the character never appears.
    if (parsedCents > maxBetCents) {
      setBetError(`Max bet is $${maxBetDollars.toLocaleString()}`);
      return;
    }

    setBetError(null);
    setBetText(cleaned);

    if (!isNaN(parsed) && parsed >= 0) {
      onBetChange(parsedCents);
    }
  }

  function handleBetBlur() {
    isTypingRef.current = false;
    setBetText((betCents / 100).toFixed(2));
  }

  // Shared helper for the ½ and 2× quick-bet buttons — clamps to the max
  // and shows the same warning if the calculated amount would exceed it.
  function updateBetCents(newCents: number) {
    if (newCents > maxBetCents) {
      onBetChange(maxBetCents);
      setBetError(`Max bet is $${maxBetDollars.toLocaleString()}`);
    } else {
      setBetError(null);
      onBetChange(newCents);
    }
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 w-full max-w-xs flex flex-col gap-4">
      <div className="flex bg-zinc-800 rounded-lg p-1">
        <button className="flex-1 rounded-md py-1.5 text-sm font-medium bg-zinc-700 text-white">
          Manual
        </button>
        <button
          disabled
          title="Auto-betting isn't built yet"
          className="flex-1 rounded-md py-1.5 text-sm font-medium text-zinc-500 cursor-not-allowed"
        >
          Auto
        </button>
      </div>

      <div>
        <label className="text-xs text-zinc-400">Bet Amount</label>
        <div className="flex gap-1 mt-1">
          <div className="relative flex-1">
            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-emerald-500 text-sm">
              $
            </span>
            <input
              type="text"
              inputMode="decimal"
              disabled={isActive}
              value={betText}
              onChange={(e) => handleBetTextChange(e.target.value)}
              onBlur={handleBetBlur}
              className={`bg-zinc-950 border outline-none rounded-md pl-6 pr-2 py-2 w-full text-sm transition-colors ${
                betError ? 'border-red-500 focus:border-red-500' : 'border-zinc-800 focus:border-indigo-500'
              }`}
            />
          </div>
          <button
            disabled={isActive}
            onClick={() => updateBetCents(Math.max(1, Math.round(betCents / 2)))}
            className="bg-zinc-800 hover:bg-zinc-700 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50"
          >
            ½
          </button>
          <button
            disabled={isActive}
            onClick={() => updateBetCents(betCents * 2)}
            className="bg-zinc-800 hover:bg-zinc-700 rounded-md px-3 text-xs font-medium transition-colors disabled:opacity-50"
          >
            2×
          </button>
        </div>
        {betError && (
          <p className="text-red-500 text-xs mt-1">{betError}</p>
        )}
      </div>

      <div>
        <label className="text-xs text-zinc-400">Grid Size</label>
        <div className="flex gap-1 mt-1">
          {GRID_SIZES.map((size) => (
            <button
              key={size}
              disabled={isActive}
              onClick={() => onGridSizeChange(size)}
              className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                gridSize === size
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300'
              }`}
            >
              {size}×{size}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="flex justify-between text-xs text-zinc-400 mb-1">
          <span>Mines</span>
          <span className="text-white font-medium">{minesCount}</span>
        </div>
        <input
          type="range"
          min={1}
          max={maxMines}
          disabled={isActive}
          value={minesCount}
          onChange={(e) => onMinesCountChange(parseInt(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      {isActive ? (
        <button
          onClick={onCashout}
          className="bg-amber-500 hover:bg-amber-400 rounded-md py-2.5 font-semibold transition-colors shadow-lg shadow-amber-500/20"
        >
          Cashout
        </button>
      ) : (
        <button
          onClick={onStart}
          disabled={disabled}
          className="bg-indigo-600 hover:bg-indigo-500 rounded-md py-2.5 font-semibold transition-colors shadow-lg shadow-indigo-600/30 disabled:opacity-50 disabled:shadow-none"
        >
          Start
        </button>
      )}
    </div>
  );
}