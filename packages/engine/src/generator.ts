import { findSolutions, isConnected } from './rules';
import { gradeDifficulty, solveLogic } from './solver';
import { Puzzle } from './types';

/** Small seeded random generator (mulberry32), so a seed always gives the same puzzle. */
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/** A random placement with one piece per row and column and no two touching. */
export function randomSolution(n: number, rng: () => number): number[] | null {
  const cols = new Array<number>(n).fill(-1);
  const used = new Array<boolean>(n).fill(false);
  const search = (r: number): boolean => {
    if (r === n) return true;
    const order = shuffle(Array.from({ length: n }, (_, i) => i), rng);
    for (const c of order) {
      if (used[c]) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols[r] = c;
      used[c] = true;
      if (search(r + 1)) return true;
      used[c] = false;
    }
    cols[r] = -1;
    return false;
  };
  return search(0) ? cols : null;
}

/** Grows one connected region around each piece until the board is full. */
function growRegions(n: number, solution: number[], rng: () => number): number[][] {
  const regions = Array.from({ length: n }, () => new Array<number>(n).fill(-1));
  const ids = shuffle(Array.from({ length: n }, (_, i) => i), rng);
  // Uneven growth weights give a mix of large and small regions.
  const weight = ids.map(() => 0.25 + rng() * 1.5);
  for (let r = 0; r < n; r++) regions[r][solution[r]] = ids[r];

  let remaining = n * n - n;
  while (remaining > 0) {
    const options: { r: number; c: number; reg: number; w: number }[] = [];
    let total = 0;
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        if (regions[r][c] !== -1) continue;
        const near = new Set<number>();
        if (r > 0 && regions[r - 1][c] !== -1) near.add(regions[r - 1][c]);
        if (r < n - 1 && regions[r + 1][c] !== -1) near.add(regions[r + 1][c]);
        if (c > 0 && regions[r][c - 1] !== -1) near.add(regions[r][c - 1]);
        if (c < n - 1 && regions[r][c + 1] !== -1) near.add(regions[r][c + 1]);
        for (const reg of near) {
          options.push({ r, c, reg, w: weight[reg] });
          total += weight[reg];
        }
      }
    }
    let pick = rng() * total;
    let chosen = options[options.length - 1];
    for (const o of options) {
      pick -= o.w;
      if (pick <= 0) {
        chosen = o;
        break;
      }
    }
    regions[chosen.r][chosen.c] = chosen.reg;
    remaining--;
  }
  return regions;
}

/**
 * Reshapes regions until `solution` is the only solution. Each round takes a
 * second solution, picks one of its pieces that the real solution does not
 * have, and hands that cell to a neighbouring region. The second solution then
 * has two pieces in one region and is gone; the real one is untouched.
 */
function makeUnique(regions: number[][], solution: number[], rng: () => number, rounds = 400): boolean {
  const n = regions.length;
  for (let round = 0; round < rounds; round++) {
    const found = findSolutions(regions, 2);
    if (found.length === 1) return true;
    const other = found.find((s) => s.some((c, r) => c !== solution[r]));
    if (!other) return false;

    const rows = shuffle(
      Array.from({ length: n }, (_, r) => r).filter((r) => other[r] !== solution[r]),
      rng,
    );
    let changed = false;
    for (const r of rows) {
      const c = other[r];
      const from = regions[r][c];
      const rest: number[] = [];
      for (let rr = 0; rr < n; rr++) {
        for (let cc = 0; cc < n; cc++) {
          if (regions[rr][cc] === from && !(rr === r && cc === c)) rest.push(rr * n + cc);
        }
      }
      if (rest.length === 0 || !isConnected(rest, n)) continue;
      const near: number[] = [];
      if (r > 0) near.push(regions[r - 1][c]);
      if (r < n - 1) near.push(regions[r + 1][c]);
      if (c > 0) near.push(regions[r][c - 1]);
      if (c < n - 1) near.push(regions[r][c + 1]);
      const targets = shuffle([...new Set(near.filter((id) => id !== from))], rng);
      if (targets.length === 0) continue;
      regions[r][c] = targets[0];
      changed = true;
      break;
    }
    if (!changed) return false;
  }
  return false;
}

export interface GenerateOptions {
  size: number;
  seed: number;
  /** Hardest technique tier a solver may need (1 to 5). */
  maxTier: number;
  /** Reject puzzles easier than this tier. */
  minTier?: number;
  /** Pre-place up to this many pieces when the puzzle is otherwise too hard. */
  maxGivens?: number;
  /** Reject boards with more single-cell regions than this (they solve themselves). */
  maxTinyRegions?: number;
  attempts?: number;
}

/**
 * Makes a puzzle with exactly one solution that the logic solver can finish
 * using techniques up to `maxTier`. Returns null when no attempt qualifies.
 */
export function generatePuzzle(opts: GenerateOptions): Puzzle | null {
  const { size: n, seed, maxTier } = opts;
  const minTier = opts.minTier ?? 1;
  const maxGivens = opts.maxGivens ?? 0;
  const maxTiny = opts.maxTinyRegions ?? 1;
  const attempts = opts.attempts ?? 400;
  const rng = makeRng(seed);

  for (let attempt = 0; attempt < attempts; attempt++) {
    const solution = randomSolution(n, rng);
    if (!solution) return null;
    const regions = growRegions(n, solution, rng);
    if (!makeUnique(regions, solution, rng)) continue;

    const sizeOf = new Array<number>(n).fill(0);
    for (const row of regions) for (const id of row) sizeOf[id]++;
    if (sizeOf.filter((s) => s === 1).length > maxTiny) continue;

    const givens: number[] = [];
    let result = solveLogic({ regions, solution, givens }, maxTier);
    // Too hard for the allowed techniques: reveal the piece of the largest
    // region still unsolved, then try again.
    while (!result.solved && givens.length < maxGivens) {
      const candidates = Array.from({ length: n }, (_, r) => r)
        .filter((r) => !givens.includes(r))
        .sort((a, b) => sizeOf[regions[b][solution[b]]] - sizeOf[regions[a][solution[a]]]);
      givens.push(candidates[0]);
      result = solveLogic({ regions, solution, givens }, maxTier);
    }
    if (!result.solved) continue;
    if (result.tier < minTier) continue;

    return {
      id: `g1-${n}-${seed}`,
      size: n,
      regions,
      solution,
      givens: givens.sort((a, b) => a - b),
      difficulty: gradeDifficulty(n, result),
      tier: result.tier,
    };
  }
  return null;
}
