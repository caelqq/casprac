// backend/src/mines/mines-math.ts

// This file contains ONLY pure math — no database calls, no HTTP, no
// side effects. Given the same inputs, these functions always return
// the same output. This makes them easy to reason about and easy to
// test in isolation.

// The house edge — how much the casino keeps, expressed as a decimal.
// 0.03 = 3%, matching the "Edge: 3%" badge shown in the reference site.
// This is what turns a "fair" (break-even) game into one that
// mathematically favors the house over many rounds, same as every real
// casino game.
const HOUSE_EDGE = 0.03;

// Calculates "n choose k" — the number of ways to choose k items from a
// set of n items, when order doesn't matter. This is the building block
// of the whole multiplier formula.
//
// Example: C(5, 2) = 10 — there are 10 different ways to pick 2 tiles
// out of 5 tiles.
//
// We use this instead of a full factorial calculation (n! / (k! *
// (n-k)!)) because factorials of large numbers (like 64! for an 8x8
// board) are astronomically large and would overflow a normal number.
// This loop-based approach multiplies and divides incrementally,
// keeping the intermediate numbers small and manageable.
function combinations(n: number, k: number): number {
  // Choosing more items than exist, or a negative amount, isn't
  // possible — 0 ways to do it.
  if (k < 0 || k > n) {
    return 0;
  }

  // Choosing 0 items is always possible exactly 1 way (choose nothing).
  if (k === 0 || k === n) {
    return 1;
  }

  // C(n, k) is the same as C(n, n-k) — picking which k items to KEEP is
  // equivalent to picking which (n-k) items to LEAVE OUT. We use
  // whichever is smaller to minimize the number of loop iterations.
  const smallerK = Math.min(k, n - k);

  let result = 1;
  for (let i = 0; i < smallerK; i++) {
    result = (result * (n - i)) / (i + 1);
  }

  return result;
}

// Calculates the current payout multiplier for a Mines round.
//
// totalTiles     — total tiles on the board (25 for a 5x5 grid, etc)
// minesCount     — how many mines are hidden
// safeTilesOpened — how many safe tiles the player has revealed SO FAR
//
// THE CORE IDEA: this is a probability calculation, not an arbitrary
// number. It answers the question "what were the odds of surviving
// this many clicks in a row, given how many mines are hidden?" — and
// then converts those odds directly into a fair payout multiplier.
//
// fairMultiplier = C(totalTiles, safeTilesOpened)
//                   / C(totalTiles - minesCount, safeTilesOpened)
//
// The numerator is "how many ways could the revealed tiles have been
// arranged at all" and the denominator is "how many of those
// arrangements would have been entirely mine-free." Dividing the two
// gives 1 / (probability of surviving this many clicks) — which is
// exactly what a mathematically FAIR (break-even) multiplier should be.
//
// We then multiply by (1 - HOUSE_EDGE) to shave off the casino's cut,
// same as every real Mines-style game does.
export function calculateMultiplier(
  totalTiles: number,
  minesCount: number,
  safeTilesOpened: number,
): number {
  // No tiles opened yet means no risk taken yet — multiplier is exactly
  // 1.00x (you'd just get your bet back, no profit, no loss).
  if (safeTilesOpened === 0) {
    return 1.0;
  }

  const safeTilesTotal = totalTiles - minesCount;

  const fairMultiplier =
    combinations(totalTiles, safeTilesOpened) /
    combinations(safeTilesTotal, safeTilesOpened);

  const payoutMultiplier = fairMultiplier * (1 - HOUSE_EDGE);

  // Round to 4 decimal places. This avoids ugly floating-point tails
  // (like 1.0800000000000003) leaking into anything we store or send
  // to the frontend, while still keeping enough precision that dollar
  // payouts round correctly.
  return Math.round(payoutMultiplier * 10000) / 10000;
}

// Convenience helper: converts a bet amount (in cents) and a multiplier
// into a payout amount (in cents), rounded to the nearest whole cent.
// Centralizing this one-line calculation here means every place in the
// codebase that needs "bet x multiplier" does it identically — no risk
// of one endpoint rounding differently than another.
export function calculatePayoutCents(
  betCents: number,
  multiplier: number,
): number {
  return Math.round(betCents * multiplier);
}

// The maximum allowed number of mines for a given grid, per the rule:
// always leave at least 1 guaranteed safe tile. E.g. a 5x5 grid (25
// tiles) allows at most 24 mines.
export function getMaxMines(totalTiles: number): number {
  return totalTiles - 1;
}