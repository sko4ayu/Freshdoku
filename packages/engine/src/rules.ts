/**
 * The four rules:
 *   one piece in every row, one in every column, one in every region,
 *   and no two pieces touching, diagonals included.
 */

/** True when a piece on cell 1 rules out a piece on cell 2. A cell does not attack itself. */
export function attacks(
  regions: number[][],
  r1: number,
  c1: number,
  r2: number,
  c2: number,
): boolean {
  if (r1 === r2 && c1 === c2) return false;
  if (r1 === r2 || c1 === c2) return true;
  if (regions[r1][c1] === regions[r2][c2]) return true;
  return Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

/** Checks a full placement (`cols[r]` = column of the piece in row r) against every rule. */
export function isValidSolution(regions: number[][], cols: number[]): boolean {
  const n = regions.length;
  if (cols.length !== n) return false;
  const seenCol = new Set<number>();
  const seenRegion = new Set<number>();
  for (let r = 0; r < n; r++) {
    const c = cols[r];
    if (!Number.isInteger(c) || c < 0 || c >= n) return false;
    if (seenCol.has(c)) return false;
    seenCol.add(c);
    const reg = regions[r][c];
    if (seenRegion.has(reg)) return false;
    seenRegion.add(reg);
    if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) return false;
  }
  return true;
}

/**
 * Exhaustive search. Returns up to `limit` solutions, so `limit = 2` answers
 * "is the solution unique?" without enumerating everything.
 */
export function findSolutions(regions: number[][], limit = 2): number[][] {
  const n = regions.length;
  const out: number[][] = [];
  const cols = new Array<number>(n).fill(-1);
  let usedCols = 0;
  let usedRegions = 0;

  const search = (r: number): void => {
    if (out.length >= limit) return;
    if (r === n) {
      out.push(cols.slice());
      return;
    }
    for (let c = 0; c < n; c++) {
      if (usedCols & (1 << c)) continue;
      const bit = 1 << regions[r][c];
      if (usedRegions & bit) continue;
      if (r > 0 && Math.abs(cols[r - 1] - c) <= 1) continue;
      cols[r] = c;
      usedCols |= 1 << c;
      usedRegions |= bit;
      search(r + 1);
      usedCols &= ~(1 << c);
      usedRegions &= ~bit;
      if (out.length >= limit) return;
    }
    cols[r] = -1;
  };

  search(0);
  return out;
}

/** Structural check of a puzzle's region map: square, ids 0..n-1, every region connected. */
export function regionsAreWellFormed(regions: number[][]): boolean {
  const n = regions.length;
  if (n === 0 || regions.some((row) => row.length !== n)) return false;
  const cellsByRegion = new Map<number, number[]>();
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const id = regions[r][c];
      if (!Number.isInteger(id) || id < 0 || id >= n) return false;
      if (!cellsByRegion.has(id)) cellsByRegion.set(id, []);
      cellsByRegion.get(id)!.push(r * n + c);
    }
  }
  if (cellsByRegion.size !== n) return false;
  for (const cells of cellsByRegion.values()) {
    if (!isConnected(cells, n)) return false;
  }
  return true;
}

/** True when the cells (as row * n + col) form one orthogonally connected group. */
export function isConnected(cells: number[], n: number): boolean {
  if (cells.length === 0) return false;
  const set = new Set(cells);
  const seen = new Set<number>([cells[0]]);
  const queue = [cells[0]];
  while (queue.length) {
    const i = queue.pop()!;
    const r = Math.floor(i / n);
    const c = i % n;
    const next: number[] = [];
    if (r > 0) next.push(i - n);
    if (r < n - 1) next.push(i + n);
    if (c > 0) next.push(i - 1);
    if (c < n - 1) next.push(i + 1);
    for (const j of next) {
      if (set.has(j) && !seen.has(j)) {
        seen.add(j);
        queue.push(j);
      }
    }
  }
  return seen.size === set.size;
}
