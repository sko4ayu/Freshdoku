import { applyStep, Grid, nextStep } from './solver';
import { levelScore } from './score';
import { Cell, Puzzle, Step } from './types';

/**
 * Game state for one attempt at one puzzle. Plain data, so it can be saved
 * after every move and restored after the app is closed.
 */
export interface GameState {
  puzzleId: string;
  size: number;
  /** Column of the good one found in each row, or -1. Includes any shown from the start. */
  found: number[];
  /**
   * Per cell (row * size + col): 0 empty, 1 marked by the player,
   * 2 revealed as wrong after the player picked it and lost a life.
   * The game never marks a cell on its own for any other reason.
   */
  marks: number[];
  lives: number;
  mistakes: number;
  hintsUsed: number;
  status: 'playing' | 'won' | 'lost';
}

export const MARK_NONE = 0;
export const MARK_PLAYER = 1;
export const MARK_REVEALED = 2;
export const START_LIVES = 3;

export function newGame(puzzle: Puzzle): GameState {
  const n = puzzle.size;
  const state: GameState = {
    puzzleId: puzzle.id,
    size: n,
    found: new Array<number>(n).fill(-1),
    marks: new Array<number>(n * n).fill(MARK_NONE),
    lives: START_LIVES,
    mistakes: 0,
    hintsUsed: 0,
    status: 'playing',
  };
  for (const r of puzzle.givens) state.found[r] = puzzle.solution[r];
  return state;
}

/** Tap: put a mark on an empty cell or take the mark off. Found cells are not affected. */
export function toggleMark(state: GameState, r: number, c: number): boolean {
  if (state.status !== 'playing' || state.found[r] === c) return false;
  const i = r * state.size + c;
  state.marks[i] = state.marks[i] === MARK_NONE ? MARK_PLAYER : MARK_NONE;
  return true;
}

export type PickResult = 'found' | 'won' | 'wrong' | 'lost' | 'ignored';

/**
 * Double tap: pick a cell as the good one. A correct pick stays. A wrong one
 * costs a life and the cell is revealed as wrong, since the player now knows.
 */
export function pick(state: GameState, puzzle: Puzzle, r: number, c: number): PickResult {
  if (state.status !== 'playing') return 'ignored';
  if (state.found[r] !== -1) return 'ignored';
  const i = r * state.size + c;

  if (puzzle.solution[r] !== c) {
    state.mistakes++;
    state.lives--;
    state.marks[i] = MARK_REVEALED;
    if (state.lives <= 0) {
      state.lives = 0;
      state.status = 'lost';
      return 'lost';
    }
    return 'wrong';
  }

  state.found[r] = c;
  state.marks[i] = MARK_NONE;
  if (state.found.every((col) => col !== -1)) {
    state.status = 'won';
    return 'won';
  }
  return 'found';
}

export function foundCount(state: GameState): number {
  return state.found.filter((c) => c !== -1).length;
}

/** What the level is worth right now, given the mistakes and hints so far. */
export function currentScore(state: GameState, puzzle: Puzzle): number {
  return levelScore(puzzle.difficulty, state.mistakes, state.hintsUsed);
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
  for (let r = 0; r < n; r++) if (state.found[r] !== -1) g.place(r, state.found[r]);

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
    if (state.found[r] === -1) {
      return { step: { technique: 'reveal', kind: 'place', cells: [[r, puzzle.solution[r]]], units: [] } };
    }
  }
  return null;
}
