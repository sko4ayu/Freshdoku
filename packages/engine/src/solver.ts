import { attacks } from './rules';
import { Cell, Puzzle, Step, Technique, TECHNIQUE_TIER, Unit } from './types';

/**
 * The logic solver. It never guesses: it applies named deductions, easiest
 * first, and reports each one as a Step. The same code grades generated
 * puzzles and produces in-game hints.
 *
 * Techniques, by tier:
 *   1 single   a row, column or region has one possible cell left
 *   2 blocker  a cell that would leave some row, column or region with no
 *              possible cell cannot hold a piece
 *   3 group2   two regions that fit inside two lines own those lines (and the
 *              reverse: two lines that fit inside two regions own those regions)
 *   4 group3   the same with three
 *   5 chain    assume a piece on a cell; if single-cell deductions alone then
 *              reach a dead end, the cell is ruled out
 */
export class Grid {
  readonly n: number;
  readonly regions: number[][];
  /** 1 when the cell may still hold a piece (a placed piece keeps its 1). */
  readonly cand: Uint8Array;
  /** Column of the piece in each row, or -1. */
  readonly cat: Int8Array;
  /** Rows are units 0..n-1, columns n..2n-1, regions 2n..3n-1. */
  readonly units: number[][];
  readonly unitDone: Uint8Array;
  private readonly attackList: number[][];

  constructor(regions: number[][], shared?: { units: number[][]; attackList: number[][] }) {
    const n = regions.length;
    this.n = n;
    this.regions = regions;
    this.cand = new Uint8Array(n * n).fill(1);
    this.cat = new Int8Array(n).fill(-1);
    this.unitDone = new Uint8Array(3 * n);
    if (shared) {
      this.units = shared.units;
      this.attackList = shared.attackList;
      return;
    }
    this.units = Array.from({ length: 3 * n }, () => [] as number[]);
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        this.units[r].push(i);
        this.units[n + c].push(i);
        this.units[2 * n + regions[r][c]].push(i);
      }
    }
    this.attackList = [];
    for (let i = 0; i < n * n; i++) {
      const list: number[] = [];
      const r1 = Math.floor(i / n);
      const c1 = i % n;
      for (let j = 0; j < n * n; j++) {
        if (attacks(regions, r1, c1, Math.floor(j / n), j % n)) list.push(j);
      }
      this.attackList.push(list);
    }
  }

  clone(): Grid {
    const g = new Grid(this.regions, { units: this.units, attackList: this.attackList });
    g.cand.set(this.cand);
    g.cat.set(this.cat);
    g.unitDone.set(this.unitDone);
    return g;
  }

  cellOf(i: number): Cell {
    return [Math.floor(i / this.n), i % this.n];
  }

  unitOf(u: number): Unit {
    const n = this.n;
    if (u < n) return { type: 'row', index: u };
    if (u < 2 * n) return { type: 'col', index: u - n };
    return { type: 'region', index: u - 2 * n };
  }

  attacksOf(i: number): number[] {
    return this.attackList[i];
  }

  isCat(i: number): boolean {
    return this.cat[Math.floor(i / this.n)] === i % this.n;
  }

  /** Puts a piece on a cell. Returns false when the cell was already ruled out. */
  place(r: number, c: number): boolean {
    const n = this.n;
    const i = r * n + c;
    if (!this.cand[i]) return false;
    if (this.cat[r] === c) return true;
    if (this.cat[r] !== -1) return false;
    this.cat[r] = c;
    this.unitDone[r] = 1;
    this.unitDone[n + c] = 1;
    this.unitDone[2 * n + this.regions[r][c]] = 1;
    for (const j of this.attackList[i]) this.cand[j] = 0;
    return true;
  }

  eliminate(i: number): void {
    this.cand[i] = 0;
  }

  solved(): boolean {
    for (let r = 0; r < this.n; r++) if (this.cat[r] === -1) return false;
    return true;
  }

  candidatesOf(u: number): number[] {
    const out: number[] = [];
    for (const i of this.units[u]) if (this.cand[i]) out.push(i);
    return out;
  }

  /** True when some unfinished row, column or region has no possible cell. */
  deadEnd(): boolean {
    for (let u = 0; u < 3 * this.n; u++) {
      if (!this.unitDone[u] && this.candidatesOf(u).length === 0) return true;
    }
    return false;
  }
}

export function gridFor(puzzle: Pick<Puzzle, 'regions' | 'solution' | 'givens'>): Grid {
  const g = new Grid(puzzle.regions);
  for (const r of puzzle.givens) g.place(r, puzzle.solution[r]);
  return g;
}

function findSingle(g: Grid): Step | null {
  for (let u = 0; u < 3 * g.n; u++) {
    if (g.unitDone[u]) continue;
    const list = g.candidatesOf(u);
    if (list.length === 1) {
      return { technique: 'single', kind: 'place', cells: [g.cellOf(list[0])], units: [g.unitOf(u)] };
    }
  }
  return null;
}

function findBlocker(g: Grid): Step | null {
  const n = g.n;
  // Smallest units first: they give the deductions a person spots first.
  const order: number[] = [];
  for (let u = 0; u < 3 * n; u++) if (!g.unitDone[u]) order.push(u);
  const sizes = new Map(order.map((u) => [u, g.candidatesOf(u).length]));
  order.sort((a, b) => sizes.get(a)! - sizes.get(b)!);

  for (const u of order) {
    const list = g.candidatesOf(u);
    if (list.length === 0) continue;
    const inList = new Set(list);
    const hit: number[] = [];
    // A blocking cell must attack list[0], so only those need checking.
    for (const x of g.attacksOf(list[0])) {
      if (!g.cand[x] || inList.has(x) || g.isCat(x)) continue;
      const attacked = new Set(g.attacksOf(x));
      if (list.every((i) => attacked.has(i))) hit.push(x);
    }
    if (hit.length) {
      return {
        technique: 'blocker',
        kind: 'eliminate',
        cells: hit.map((i) => g.cellOf(i)),
        units: [g.unitOf(u)],
      };
    }
  }
  return null;
}

function popcount(x: number): number {
  let count = 0;
  while (x) {
    x &= x - 1;
    count++;
  }
  return count;
}

function combinations(items: number[], k: number): number[][] {
  const out: number[][] = [];
  const pick = (start: number, chosen: number[]): void => {
    if (chosen.length === k) {
      out.push(chosen.slice());
      return;
    }
    for (let i = start; i < items.length; i++) {
      chosen.push(items[i]);
      pick(i + 1, chosen);
      chosen.pop();
    }
  };
  pick(0, []);
  return out;
}

function findGroup(g: Grid, k: 2 | 3): Step | null {
  const n = g.n;
  const technique: Technique = k === 2 ? 'group2' : 'group3';

  for (const lineType of ['row', 'col'] as const) {
    const lineOf = (i: number): number => (lineType === 'row' ? Math.floor(i / n) : i % n);
    const lineUnit = (line: number): number => (lineType === 'row' ? line : n + line);

    // k regions whose possible cells all sit in k lines: those lines belong to them.
    const openRegions: number[] = [];
    const regionMask = new Array<number>(n).fill(0);
    for (let reg = 0; reg < n; reg++) {
      if (g.unitDone[2 * n + reg]) continue;
      openRegions.push(reg);
      for (const i of g.candidatesOf(2 * n + reg)) regionMask[reg] |= 1 << lineOf(i);
    }
    for (const combo of combinations(openRegions, k)) {
      let mask = 0;
      for (const reg of combo) mask |= regionMask[reg];
      if (popcount(mask) !== k) continue;
      const hit: number[] = [];
      for (let line = 0; line < n; line++) {
        if (!(mask & (1 << line))) continue;
        for (const i of g.candidatesOf(lineUnit(line))) {
          const [r, c] = g.cellOf(i);
          if (!combo.includes(g.regions[r][c])) hit.push(i);
        }
      }
      if (hit.length) {
        const units: Unit[] = combo.map((reg) => ({ type: 'region' as const, index: reg }));
        for (let line = 0; line < n; line++) {
          if (mask & (1 << line)) units.push({ type: lineType, index: line });
        }
        return { technique, kind: 'eliminate', cells: hit.map((i) => g.cellOf(i)), units };
      }
    }

    // k lines whose possible cells all sit in k regions: those regions belong to them.
    const openLines: number[] = [];
    const lineMask = new Array<number>(n).fill(0);
    for (let line = 0; line < n; line++) {
      if (g.unitDone[lineUnit(line)]) continue;
      openLines.push(line);
      for (const i of g.candidatesOf(lineUnit(line))) {
        const [r, c] = g.cellOf(i);
        lineMask[line] |= 1 << g.regions[r][c];
      }
    }
    for (const combo of combinations(openLines, k)) {
      let mask = 0;
      for (const line of combo) mask |= lineMask[line];
      if (popcount(mask) !== k) continue;
      const hit: number[] = [];
      for (let reg = 0; reg < n; reg++) {
        if (!(mask & (1 << reg))) continue;
        for (const i of g.candidatesOf(2 * n + reg)) {
          if (!combo.includes(lineOf(i))) hit.push(i);
        }
      }
      if (hit.length) {
        const units: Unit[] = combo.map((line) => ({ type: lineType, index: line }));
        for (let reg = 0; reg < n; reg++) {
          if (mask & (1 << reg)) units.push({ type: 'region', index: reg });
        }
        return { technique, kind: 'eliminate', cells: hit.map((i) => g.cellOf(i)), units };
      }
    }
  }
  return null;
}

function findChain(g: Grid): Step | null {
  const n = g.n;
  for (let i = 0; i < n * n; i++) {
    if (!g.cand[i] || g.isCat(i)) continue;
    const [r, c] = g.cellOf(i);
    if (g.cat[r] !== -1) continue;
    const trial = g.clone();
    trial.place(r, c);
    let dead = trial.deadEnd();
    while (!dead) {
      const single = findSingle(trial);
      if (!single) break;
      const [sr, sc] = single.cells[0];
      trial.place(sr, sc);
      dead = trial.deadEnd();
    }
    if (dead) {
      return { technique: 'chain', kind: 'eliminate', cells: [[r, c]], units: [] };
    }
  }
  return null;
}

/** The easiest deduction available, limited to techniques of tier <= maxTier. */
export function nextStep(g: Grid, maxTier = 5): Step | null {
  const single = findSingle(g);
  if (single) return single;
  if (maxTier >= 2) {
    const s = findBlocker(g);
    if (s) return s;
  }
  if (maxTier >= 3) {
    const s = findGroup(g, 2);
    if (s) return s;
  }
  if (maxTier >= 4) {
    const s = findGroup(g, 3);
    if (s) return s;
  }
  if (maxTier >= 5) {
    const s = findChain(g);
    if (s) return s;
  }
  return null;
}

export function applyStep(g: Grid, step: Step): void {
  if (step.kind === 'place') {
    const [r, c] = step.cells[0];
    g.place(r, c);
  } else {
    for (const [r, c] of step.cells) g.eliminate(r * g.n + c);
  }
}

export interface LogicResult {
  solved: boolean;
  steps: Step[];
  /** Highest tier used. 0 when no deduction was needed. */
  tier: number;
  /** Number of deductions above tier 1. */
  hardSteps: number;
}

/** Solves by deduction only. `solved` is false when the allowed techniques run out. */
export function solveLogic(
  puzzle: Pick<Puzzle, 'regions' | 'solution' | 'givens'>,
  maxTier = 5,
): LogicResult {
  const g = gridFor(puzzle);
  const steps: Step[] = [];
  let tier = 0;
  let hardSteps = 0;
  while (!g.solved()) {
    if (g.deadEnd()) break;
    const step = nextStep(g, maxTier);
    if (!step) break;
    applyStep(g, step);
    steps.push(step);
    const t = TECHNIQUE_TIER[step.technique];
    if (t > tier) tier = t;
    if (t > 1) hardSteps++;
  }
  return { solved: g.solved(), steps, tier, hardSteps };
}

/**
 * A 1 to 10 grade from board size, the hardest technique needed and how many
 * non-trivial deductions there are. It orders levels sensibly; it is not a
 * measured human solving time.
 */
export function gradeDifficulty(size: number, result: LogicResult): number {
  const raw = result.tier * 1.4 + (size - 5) * 0.55 + result.hardSteps / 7;
  return Math.max(1, Math.min(10, Math.round(raw)));
}
