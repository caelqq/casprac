// components/games/mines/MinesGame.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { ArrowLeft, Settings, History, TrendingUp, ChevronDown } from 'lucide-react';
import MinesGrid from './MinesGrid';
import MinesControls from './MinesControls';
import { useBalance } from '@/contexts/BalanceContext';
import {
  MinesRoundState,
  StartRoundResponse,
  RevealTileResponse,
  CashoutResponse,
} from '@/types/mines';

const API_BASE = 'http://localhost:3001';

const initialRound: MinesRoundState = {
  roundId: null,
  betCents: 100,
  totalTiles: 25,
  minesCount: 3,
  revealedTiles: [],
  minePositions: [],
  currentMultiplier: 1.0,
  status: 'idle',
};

export default function MinesGame() {
  const router = useRouter();
  const { refreshBalance } = useBalance();
  const [round, setRound] = useState<MinesRoundState>(initialRound);
  const [gridSize, setGridSize] = useState(5);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);

  // Sound effects. Created once on mount via useRef instead of
  // `new Audio(...)` inline, so we're not constructing new Audio objects
  // on every render — we just reuse the same ones and reset playback
  // position each time they need to play again.
  const gemAudioRef = useRef<HTMLAudioElement | null>(null);
  const bombAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    gemAudioRef.current = new Audio('/sounds/gem-reveal.mp3');
    bombAudioRef.current = new Audio('/sounds/bomb-explosion.mp3');
  }, []);

  function playSound(audioRef: React.RefObject<HTMLAudioElement | null>) {
    const audio = audioRef.current;
    if (!audio) return;
    // Rewind to the start in case the previous play is still finishing —
    // lets rapid actions each trigger a fresh, snappy sound instead of
    // being ignored while the last one plays out.
    audio.currentTime = 0;
    // .play() returns a promise that rejects if the browser blocks
    // autoplay; swallow that instead of throwing an unhandled rejection,
    // since a blocked sound effect shouldn't crash the game.
    audio.play().catch(() => {});
  }

  const isActive = round.status === 'active';

  async function handleStart() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/mines/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          betCents: round.betCents,
          totalTiles: gridSize * gridSize,
          minesCount: round.minesCount,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to start round');
      }

      const data: StartRoundResponse = await res.json();
      setRound({
        roundId: data.roundId,
        betCents: data.betCents,
        totalTiles: data.totalTiles,
        minesCount: data.minesCount,
        revealedTiles: data.revealedTiles,
        minePositions: [],
        currentMultiplier: data.currentMultiplier,
        status: 'active',
      });

      // The backend just deducted this bet from the user's balance.
      // Refresh so the header pill reflects it immediately instead of
      // showing a stale (too-high) number until the next page load.
      refreshBalance();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleTileClick(tileIndex: number) {
    if (round.status !== 'active' || !round.roundId) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mines/reveal`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.roundId, tileIndex }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to reveal tile');
      }

      const data: RevealTileResponse = await res.json();

      // If the round is still active after this reveal, the tile was
      // safe — play the gem sound. Otherwise the round just busted
      // (mine hit) — play the bomb sound instead.
      if (data.status === 'active') {
        playSound(gemAudioRef);
      } else {
        playSound(bombAudioRef);
      }

      setRound((prev) => ({
        ...prev,
        revealedTiles: data.revealedTiles,
        currentMultiplier: data.currentMultiplier,
        minePositions: data.minePositions ?? prev.minePositions,
        status: data.status as MinesRoundState['status'],
      }));
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function handleCashout() {
    if (!round.roundId) return;
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/mines/cashout`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roundId: round.roundId }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message || 'Failed to cash out');
      }

      const data: CashoutResponse = await res.json();
      setRound((prev) => ({
        ...prev,
        currentMultiplier: data.currentMultiplier,
        revealedTiles: data.revealedTiles,
        status: 'cashed_out',
      }));

      // The backend just credited the payout to the user's balance.
      // Refresh so the header pill reflects the win immediately.
      refreshBalance();
    } catch (err: any) {
      setError(err.message);
    }
  }

  function handleBack() {
    if (isActive) return;
    router.push('/home');
  }

  const maxBetCents = 100000;
  const maxPayoutCents = 1000000;

  return (
    <div className="flex flex-col bg-zinc-950">
      {/* Back button — normal document flow */}
      <div className="px-6 pt-3">
        <button
          onClick={handleBack}
          disabled={isActive}
          title={isActive ? 'Cash out or lose the round before leaving' : 'Back to home'}
          className={`rounded-full p-2 border transition-colors ${
            isActive
              ? 'border-zinc-800 text-zinc-600 cursor-not-allowed opacity-50'
              : 'border-zinc-700 text-zinc-300 hover:border-indigo-500 hover:text-indigo-400 cursor-pointer'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-12 items-start justify-center pt-3 pb-4 px-6">
        <MinesControls
          betCents={round.betCents}
          onBetChange={(cents) => setRound((prev) => ({ ...prev, betCents: cents }))}
          gridSize={gridSize}
          onGridSizeChange={(size) => {
            setGridSize(size);
            setRound((prev) => ({ ...prev, totalTiles: size * size }));
          }}
          minesCount={round.minesCount}
          onMinesCountChange={(count) => setRound((prev) => ({ ...prev, minesCount: count }))}
          status={round.status}
          onStart={handleStart}
          onCashout={handleCashout}
          disabled={loading}
          maxBetCents={maxBetCents}
        />

        <div className="flex-1 w-full max-w-xl md:-mt-8">
          {error && <p className="text-red-400 text-sm mb-2">{error}</p>}
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <MinesGrid round={round} onTileClick={handleTileClick} />
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-800 bg-zinc-900 px-6 py-2 flex items-center justify-between">
        <div className="flex items-center gap-4 text-zinc-400">
          <button className="hover:text-white transition-colors" title="Settings">
            <Settings className="w-4 h-4" />
          </button>
          <button className="hover:text-white transition-colors" title="Bet history">
            <History className="w-4 h-4" />
          </button>
          <button className="hover:text-white transition-colors" title="Statistics">
            <TrendingUp className="w-4 h-4" />
          </button>
        </div>

        <span className="font-bold text-lg bg-gradient-to-r from-purple-500 to-indigo-500 bg-clip-text text-transparent">
          Casilo
        </span>

        <button className="text-xs text-zinc-400 hover:text-white transition-colors">
          Fairness
        </button>
      </div>

      {/* Collapsible Mines details panel */}
      <div className="border-t border-zinc-800 bg-zinc-900 px-6 py-3">
        <div className="flex items-center gap-4">
          <span className="font-bold text-xl whitespace-nowrap">Mines</span>

          <div
            className="grid transition-[grid-template-columns] duration-300 ease-in-out"
            style={{ gridTemplateColumns: detailsExpanded ? '0fr' : '1fr' }}
          >
            <div className="overflow-hidden flex items-center gap-3 min-w-0">
              <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                Edge: <span className="text-white font-medium">3%</span>
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                Max Bet: <span className="text-white font-medium">{(maxBetCents / 100).toLocaleString()}</span>
                <Image src="/icons/dollarphot.svg" alt="" width={16} height={16} className="rounded-sm" />
              </span>
              <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                Max Payout: <span className="text-white font-medium">{(maxPayoutCents / 100).toLocaleString()}</span>
                <Image src="/icons/dollarphot.svg" alt="" width={16} height={16} className="rounded-sm" />
              </span>
            </div>
          </div>

          <div className="flex-1 h-px bg-zinc-800" />

          <button
            onClick={() => setDetailsExpanded((prev) => !prev)}
            className="bg-zinc-800 hover:bg-zinc-700 rounded-full p-1.5 transition-colors"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                detailsExpanded ? 'rotate-180' : ''
              }`}
            />
          </button>
        </div>

        <div
          className="grid transition-[grid-template-rows] duration-300 ease-in-out"
          style={{ gridTemplateRows: detailsExpanded ? '1fr' : '0fr' }}
        >
          <div className="overflow-hidden">
            <div
              className={`flex items-start justify-between gap-8 pt-4 transition-all duration-300 ease-in-out ${
                detailsExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'
              }`}
            >
              <div className="flex-1 text-zinc-300 text-sm leading-relaxed space-y-3">
                <p>
                  Mines is a thrilling game offered by Casilo that's easy to pick up yet endlessly exciting.
                </p>
                <div>
                  <p>In this game, you'll encounter two key elements:</p>
                  <ul className="list-disc list-inside">
                    <li>The bet amount</li>
                    <li>The mines amount.</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                  Edge: <span className="text-white font-medium">3%</span>
                </span>
                <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                  Max Bet: <span className="text-white font-medium">{(maxBetCents / 100).toLocaleString()}</span>
                  <Image src="/icons/dollarphot.svg" alt="" width={16} height={16} className="rounded-sm" />
                </span>
                <span className="flex items-center gap-1.5 bg-zinc-800 rounded-full pl-3 pr-1.5 py-1 text-sm text-zinc-300 whitespace-nowrap">
                  Max Payout: <span className="text-white font-medium">{(maxPayoutCents / 100).toLocaleString()}</span>
                  <Image src="/icons/dollarphot.svg" alt="" width={16} height={16} className="rounded-sm" />
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}