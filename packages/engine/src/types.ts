/** A cell as [row, column], both zero-based. */
export type Cell = readonly [number, number];

/**
 * One puzzle. `regions[r][c]` is the region id of a cell (0..size-1).
 * `solution[r]` is the column of the piece in row r.
 * `givens` lists the rows whose piece is already on the board at the start.
 */
export interface Puzzle {
  id: string;
  size: number;
  regions: number[][];
  solution: number[];
  givens: number[];
  /** 1 (easiest) to 10. A heuristic grade, see solver.ts. */
  difficulty: number;
  /** Highest technique tier the logic solver needed, 1 to 5. */
  tier: number;
}

export type UnitType = 'row' | 'col' | 'region';

export interface Unit {
  type: UnitType;
  index: number;
}

export type Technique = 'single' | 'blocker' | 'group2' | 'group3' | 'chain';

export const TECHNIQUE_TIER: Record<Technique, number> = {
  single: 1,
  blocker: 2,
  group2: 3,
  group3: 4,
  chain: 5,
};

/** One deduction: either a piece that must go somewhere, or cells that cannot hold one. */
export interface Step {
  technique: Technique;
  kind: 'place' | 'eliminate';
  cells: Cell[];
  /** The rows, columns or regions the deduction is about, for highlighting. */
  units: Unit[];
}
