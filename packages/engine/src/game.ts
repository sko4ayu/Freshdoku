import { attacks } from './rules';
import { applyStep, Grid, nextStep } from './solver';
import { Cell, Puzzle, Step } from './types';

/**
 * Game state for one attempt at one puzzle. Plain data, so it can be saved
 * after every move and restored after the app is closed.
 */
export interface GameState {
  puzzleId: string;
  size: number;
  /** Column of the piece in each row, or -1. Includes the pre-placed ones. */
  cats: number[];
  /** Per cell (row * size + col): 0 empty, 1 marked by the player, 2 marked by the game. */
  marks: number[];
  lives: number;
  mistakes: number;
  hintsUsed: number;
  elapsedMs: number;
  status: 'playing' | 'won' | 'lost';
}

export const MARK_NONE = 0;
export const MARK_PLAYER = 1;
export const MARK_AUTO = 2;
export const START_LIVES = 3;

export function newGame(puzzle: Puzzle, autoMarks = true): GameState {
  const n = puzzle.size;
  const state: GameState = {
    puzzleId: puzzle.id,
    size: n,
    cats: new Array<number>(n).fill(-1),
    marks: new Array<number>(n * n).fill(MARK_NONE),
    lives: START_LIVES,
    mistakes: 0,
    hintsUsed: 0,
    elapsedMs: 0,
    status: 'playing',
  };
  for (const r of puzzle.givens) {
    state.cats[r] = puzzle.solution[r];
    if (autoMarks) markAround(state, puzzle, r, puzzle.solution[r]);
  }
  return state;
}

function hasCat(state: GameState, r: number, c: number): boolean {
  return state.cats[r] === c;
}

function markAround(state: GameState, puzzle: Puzzle, r: number, c: number): void {
  const n = state.size;
  for (let rr = 0; rr < n; rr++) {
    for (let cc = 0; cc < n; cc++) {
      if (hasCat(state, rr, cc)) continue;
      const i = rr * n + cc;
      if (state.marks[i] === MARK_NONE && attacks(puzzle.regions, r, c, rr, cc)) {
        state.marks[i] = MARK_AUTO;
      }
    }
  }
}

/** Tap: put a mark on an empty cell or take the mark off. Pieces are not affected. */
export function toggleMark(state: GameState, r: number, c: number): boolean {
  if (state.status !== 'playing' || hasCat(state, r, c)) return false;
  const i = r * state.size + c;
  state.marks[i] = state.marks[i] === MARK_NONE ? MARK_PLAYER : MARK_NONE;
  return true;
}

export type PlaceResult = 'placed' | 'won' | 'wrong' | 'lost' | 'ignored';

/**
 * Double tap: try to put a piece on a cell. A correct piece stays. A wrong
 * one costs a life and the cell gets a mark, since it is now known to be empty.
 */
export function placeCat(
  state: GameState,
  puzzle: Puzzle,
  r: number,
  c: number,
  autoMarks = true,
): PlaceResult {
  if (state.status !== 'playing') return 'ignored';
  if (state.cats[r] !== -1) return 'ignored';
  const i = r * state.size + c;

  if (puzzle.solution[r] !== c) {
    state.mistakes++;
    state.lives--;
    state.marks[i] = MARK_AUTO;
    if (state.lives <= 0) {
      state.lives = 0;
      state.status = 'lost';
      return 'lost';
    }
    return 'wrong';
  }

  state.cats[r] = c;
  state.marks[i] = MARK_NONE;
  if (autoMarks) markAround(state, puzzle, r, c);
  if (state.cats.every((col) => col !== -1)) {
    state.status = 'won';
    return 'won';
  }
  return 'placed';
}

export function catsPlaced(state: GameState): number {
  return state.cats.filter((c) => c !== -1).length;
}

export interface Hint {
  /** 'reveal' is the fallback when no deduction is found: it shows a solution cell. */
  step: Step | { technique: 'reveal'; kind: 'place'; cells: Cell[]; units: [] };
}

/**
 * The next useful deduction from the current board. Deductions that only rule
 * out cells the player has already marked are applied silently and skipped, so
 * a hint always says something new.
 */
export function hintFor(state: GameState, puzzle: Puzzle): Hint | null {
  if (state.status !== 'playing') return null;
  const n = state.size;
  const g = new Grid(puzzle.regions);
  for (let r = 0; r < n; r++) if (state.cats[r] !== -1) g.place(r, state.cats[r]);

  for (let guard = 0; guard < n * n * 4; guard++) {
    if (g.solved() || g.deadEnd()) break;
    const step = nextStep(g, 5);
    if (!step) break;
    if (step.kind === 'place') return { step };
    const fresh = step.cells.filter(([r, c]) => state.marks[r * n + c] === MARK_NONE);
    if (fresh.length > 0) return { step: { ...step, cells: fresh } };
    applyStep(g, step);
  }

  for (let r = 0; r < n; r++) {
    if (state.cats[r] === -1) {
      return { step: { technique: 'reveal', kind: 'place', cells: [[r, puzzle.solution[r]]], units: [] } };
    }
  }
  return null;
}
