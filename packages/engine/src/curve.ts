import { generatePuzzle } from './generator';
import { Puzzle } from './types';

export interface Band {
  size: number;
  maxTier: number;
  minTier: number;
}

/**
 * The difficulty curve: which board size and technique tier a level number
 * gets. The first 60 levels climb from 5x5 to 10x10. After that the curve
 * repeats a ten-level cycle of large boards with one smaller "breather".
 */
export function bandFor(level: number): Band {
  if (level <= 3) return { size: 5, maxTier: 2, minTier: 1 };
  if (level <= 8) return { size: 5, maxTier: 2, minTier: 2 };
  if (level <= 16) return { size: 6, maxTier: 2, minTier: 2 };
  if (level <= 24) return { size: 7, maxTier: 3, minTier: 2 };
  if (level <= 34) return { size: 8, maxTier: 3, minTier: 2 };
  if (level <= 44) return { size: 8, maxTier: 4, minTier: 3 };
  if (level <= 54) return { size: 9, maxTier: 4, minTier: 3 };
  if (level <= 60) return { size: 10, maxTier: 5, minTier: 3 };
  const cycle: Band[] = [
    { size: 8, maxTier: 4, minTier: 3 },
    { size: 9, maxTier: 4, minTier: 3 },
    { size: 9, maxTier: 5, minTier: 3 },
    { size: 10, maxTier: 4, minTier: 3 },
    { size: 8, maxTier: 5, minTier: 3 },
    { size: 9, maxTier: 5, minTier: 3 },
    { size: 10, maxTier: 5, minTier: 3 },
    { size: 10, maxTier: 5, minTier: 3 },
    { size: 7, maxTier: 3, minTier: 2 },
    { size: 10, maxTier: 5, minTier: 3 },
  ];
  return cycle[(level - 61) % cycle.length];
}

/**
 * The puzzle for a level number. The level number is the seed, so level 5000
 * is the same board for every player, whether it comes from a bundled pack or
 * is generated on the device. There is no last level.
 */
export function generateLevel(level: number): Puzzle {
  const band = bandFor(level);
  let seed = level * 104_729 + 7;
  for (;;) {
    const p = generatePuzzle({ ...band, seed, attempts: 200 });
    if (p) return { ...p, id: `g1-L${level}` };
    seed += 1_000_003;
  }
}
