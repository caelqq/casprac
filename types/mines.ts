// types/mines.ts

// Shared TypeScript types for the Mines game frontend. Keeping these
// centralized means every component agrees on the exact shape of the
// data flowing between them and the backend.

export type MinesStatus = 'idle' | 'active' | 'won' | 'lost' | 'cashed_out';

export interface MinesRoundState {
  roundId: string | null;
  betCents: number;
  totalTiles: number;
  minesCount: number;
  revealedTiles: number[];
  minePositions: number[]; // only populated once round ends (lost/won)
  currentMultiplier: number;
  status: MinesStatus;
}

export interface StartRoundResponse {
  roundId: string;
  betCents: number;
  totalTiles: number;
  minesCount: number;
  revealedTiles: number[];
  currentMultiplier: number;
  status: string;
}

export interface RevealTileResponse {
  safe: boolean;
  status: string;
  revealedTiles: number[];
  currentMultiplier: number;
  minePositions?: number[]; // present only when safe: false
  payoutCents?: number; // present only on auto-win
}

export interface CashoutResponse {
  status: string;
  revealedTiles: number[];
  currentMultiplier: number;
  payoutCents: number;
}