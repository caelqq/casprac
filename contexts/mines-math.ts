// lib/mines-math.ts

// Mirrors backend/src/mines/mines-math.ts EXACTLY. This file is used
// only to preview a multiplier on hover, before the player actually
// clicks a tile. The real, authoritative multiplier always comes from
// the backend response after a real /mines/reveal or /mines/cashout
// call — this file never decides an actual game outcome.

const HOUSE_EDGE = 0.03;

function combinations(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;

  const smallerK = Math.min(k, n - k);
  let result = 1;
  for (let i = 0; i < smallerK; i++) {
    result = (result * (n - i)) / (i + 1);
  }
  return result;
}

export function calculateMultiplier(
  totalTiles: number,
  minesCount: number,
  safeTilesOpened: number,
): number {
  if (safeTilesOpened === 0) return 1.0;

  const safeTilesTotal = totalTiles - minesCount;
  const fairMultiplier =
    combinations(totalTiles, safeTilesOpened) /
    combinations(safeTilesTotal, safeTilesOpened);

  const payoutMultiplier = fairMultiplier * (1 - HOUSE_EDGE);
  return Math.round(payoutMultiplier * 10000) / 10000;
}

export function calculatePayoutCents(betCents: number, multiplier: number): number {
  return Math.round(betCents * multiplier);
}

export function getMaxMines(totalTiles: number): number {
  return totalTiles - 1;
}

// Available grid sizes for the grid-size selector buttons.
export const GRID_SIZES = [4, 5, 6, 7, 8] as const;