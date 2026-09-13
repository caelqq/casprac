// backend/src/mines/mines.service.ts

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  calculateMultiplier,
  calculatePayoutCents,
  getMaxMines,
} from './mines-math';

@Injectable()
export class MinesService {
  constructor(private readonly prisma: PrismaService) {}

  // Starts a brand new Mines round for the given user.
  //
  // Security / correctness notes:
  // - userId ALWAYS comes from the caller's verified JWT cookie (checked
  //   in the controller) — a user can only ever spend their OWN balance,
  //   never anyone else's, same trust model as tipping.
  // - The bet deduction uses the exact same atomic "check and subtract
  //   in one step" pattern as tipUser(): a single updateMany() with a
  //   balanceCents: { gte: betCents } guard. This closes the same race-
  //   condition window — two simultaneous "Start Round" clicks can never
  //   both succeed if only one bet's worth of balance actually exists.
  // - Mine positions are generated HERE, on the server, using Node's
  //   own random number generation — never sent to or influenced by the
  //   frontend in any way. This is what makes it impossible for a
  //   player to predict or manipulate where the mines land.
  async startRound(
    userId: string,
    betCents: number,
    totalTiles: number,
    minesCount: number,
  ) {
    if (betCents <= 0) {
      throw new BadRequestException('Bet amount must be greater than 0');
    }

    const maxMines = getMaxMines(totalTiles);
    if (minesCount < 1 || minesCount > maxMines) {
      throw new BadRequestException(
        `Mines count must be between 1 and ${maxMines} for this grid size`,
      );
    }

    // Generate the mine positions. We pick `minesCount` UNIQUE random
    // tile indices out of `totalTiles` total tiles using a Set (which
    // automatically ignores duplicate values), looping until it's full.
    const minePositions = new Set<number>();
    while (minePositions.size < minesCount) {
      const randomTile = Math.floor(Math.random() * totalTiles);
      minePositions.add(randomTile);
    }

    return this.prisma.$transaction(async (tx) => {
      const deductResult = await tx.user.updateMany({
        where: {
          id: userId,
          balanceCents: { gte: betCents },
        },
        data: {
          balanceCents: { decrement: betCents },
        },
      });

      if (deductResult.count === 0) {
        throw new ForbiddenException('Insufficient balance');
      }

      const round = await tx.minesRound.create({
        data: {
          userId,
          betCents,
          totalTiles,
          minesCount,
          minePositions: Array.from(minePositions),
          revealedTiles: [],
          status: 'active',
          currentMultiplier: 1.0,
        },
      });

      // IMPORTANT: we deliberately return only the safe-to-share
      // fields here — never minePositions.
      return {
        roundId: round.id,
        betCents: round.betCents,
        totalTiles: round.totalTiles,
        minesCount: round.minesCount,
        revealedTiles: round.revealedTiles,
        currentMultiplier: round.currentMultiplier,
        status: round.status,
      };
    });
  }

  // Loads a round and verifies it belongs to the given user and is
  // still active. Shared by both revealTile and cashOut, since both
  // need this exact same check before doing anything else.
  //
  // SECURITY NOTE: checking round.userId === userId here is what stops
  // a player from ever revealing tiles or cashing out someone ELSE's
  // round, even if they somehow got hold of another user's roundId
  // (e.g. by guessing a UUID, which is astronomically unlikely, but we
  // never rely on "hard to guess" alone as a security boundary).
  private async loadActiveRound(userId: string, roundId: string) {
    const round = await this.prisma.minesRound.findUnique({
      where: { id: roundId },
    });

    if (!round) {
      throw new NotFoundException('Round not found');
    }

    if (round.userId !== userId) {
      throw new ForbiddenException('This round does not belong to you');
    }

    if (round.status !== 'active') {
      throw new BadRequestException('This round has already ended');
    }

    return round;
  }

  // Handles a player clicking a single tile.
  //
  // Three possible outcomes, matching the three ways a round can end:
  // 1. The tile is a mine -> round ends immediately, status 'lost', no
  //    payout. Mine positions are revealed in the response now, since
  //    it's safe to share them once the round is dead.
  // 2. The tile is safe, and safe tiles remain -> multiplier increases,
  //    round stays 'active'.
  // 3. The tile is safe, and it was the LAST safe tile on the board ->
  //    there's nothing left to click, so this is an automatic win. We
  //    pay out immediately at the final multiplier, same math as a
  //    manual cash out, status becomes 'won'.
  async revealTile(userId: string, roundId: string, tileIndex: number) {
    const round = await this.loadActiveRound(userId, roundId);

    if (tileIndex < 0 || tileIndex >= round.totalTiles) {
      throw new BadRequestException('Invalid tile index');
    }

    if (round.revealedTiles.includes(tileIndex)) {
      throw new BadRequestException('This tile has already been revealed');
    }

    const hitMine = round.minePositions.includes(tileIndex);

    if (hitMine) {
      const updatedRound = await this.prisma.minesRound.update({
        where: { id: roundId },
        data: { status: 'lost' },
      });

      return {
        safe: false,
        status: updatedRound.status,
        revealedTiles: updatedRound.revealedTiles,
        // Only revealed now, because the round is over — it was never
        // sent to the frontend at any earlier point.
        minePositions: updatedRound.minePositions,
        currentMultiplier: updatedRound.currentMultiplier,
      };
    }

    const newRevealedTiles = [...round.revealedTiles, tileIndex];
    const safeTilesTotal = round.totalTiles - round.minesCount;
    const isFullyCleared = newRevealedTiles.length === safeTilesTotal;

    const newMultiplier = calculateMultiplier(
      round.totalTiles,
      round.minesCount,
      newRevealedTiles.length,
    );

    // Every safe tile has now been revealed — nothing left to click, so
    // this is an automatic win. We pay out and close the round in one
    // atomic transaction, same reasoning as tipUser(): the payout and
    // the status change either both happen together, or neither does.
    if (isFullyCleared) {
      const payoutCents = calculatePayoutCents(round.betCents, newMultiplier);

      return this.prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: userId },
          data: { balanceCents: { increment: payoutCents } },
        });

        const updatedRound = await tx.minesRound.update({
          where: { id: roundId },
          data: {
            revealedTiles: newRevealedTiles,
            currentMultiplier: newMultiplier,
            status: 'won',
          },
        });

        return {
          safe: true,
          status: updatedRound.status,
          revealedTiles: updatedRound.revealedTiles,
          currentMultiplier: updatedRound.currentMultiplier,
          payoutCents,
        };
      });
    }

    // Normal case: safe tile, more safe tiles still remain. Just update
    // the round and keep playing.
    const updatedRound = await this.prisma.minesRound.update({
      where: { id: roundId },
      data: {
        revealedTiles: newRevealedTiles,
        currentMultiplier: newMultiplier,
      },
    });

    return {
      safe: true,
      status: updatedRound.status,
      revealedTiles: updatedRound.revealedTiles,
      currentMultiplier: updatedRound.currentMultiplier,
    };
  }

  // Handles a player clicking Cash Out. Pays out betCents x
  // currentMultiplier, closes the round as 'cashed_out'.
  //
  // Requires at least 1 safe tile to have been revealed — cashing out
  // at 0 revealed tiles would just be handing back the exact bet amount
  // for free (multiplier 1.00x with zero risk taken), so we block it,
  // matching how the Start button becomes Cashout only once a tile has
  // been safely opened.
  async cashOut(userId: string, roundId: string) {
    const round = await this.loadActiveRound(userId, roundId);

    if (round.revealedTiles.length === 0) {
      throw new BadRequestException(
        'Reveal at least one tile before cashing out',
      );
    }

    const payoutCents = calculatePayoutCents(
      round.betCents,
      round.currentMultiplier,
    );

    return this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { balanceCents: { increment: payoutCents } },
      });

      const updatedRound = await tx.minesRound.update({
        where: { id: roundId },
        data: { status: 'cashed_out' },
      });

      return {
        status: updatedRound.status,
        revealedTiles: updatedRound.revealedTiles,
        currentMultiplier: updatedRound.currentMultiplier,
        payoutCents,
      };
    });
  }
}