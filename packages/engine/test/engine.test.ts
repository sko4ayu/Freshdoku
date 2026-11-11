import {
  attacks,
  bandFor,
  currentScore,
  findSolutions,
  foundCount,
  generateLevel,
  generatePuzzle,
  hintFor,
  isValidSolution,
  levelScore,
  levelStars,
  MARK_NONE,
  MARK_PLAYER,
  MARK_REVEALED,
  newGame,
  pick,
  regionsAreWellFormed,
  solveLogic,
  toggleMark,
  Puzzle,
} from '../src';

// A hand-made 5x5 board, written for these tests.
const REGIONS = [
  [0, 0, 1, 1, 1],
  [0, 0, 1, 2, 2],
  [3, 0, 1, 2, 2],
  [3, 3, 4, 2, 2],
  [3, 4, 4, 4, 2],
];
const SOLUTION = [0, 2, 4, 1, 3];

describe('rules', () => {
  test('attacks: row, column, region, neighbours, not itself', () => {
    expect(attacks(REGIONS, 0, 0, 0, 4)).toBe(true);
    expect(attacks(REGIONS, 0, 0, 4, 0)).toBe(true);
    expect(attacks(REGIONS, 0, 0, 2, 1)).toBe(true); // same region
    expect(attacks(REGIONS, 1, 2, 2, 3)).toBe(true); // diagonal neighbour
    expect(attacks(REGIONS, 0, 0, 0, 0)).toBe(false);
    expect(attacks(REGIONS, 0, 3, 3, 0)).toBe(false);
  });

  test('isValidSolution accepts the solution and rejects rule breaks', () => {
    expect(isValidSolution(REGIONS, SOLUTION)).toBe(true);
    expect(isValidSolution(REGIONS, [0, 2, 4, 1, 1])).toBe(false); // column twice
    expect(isValidSolution(REGIONS, [0, 1, 3, 0, 2])).toBe(false); // touching
    expect(isValidSolution(REGIONS, [0, 2, 4, 1])).toBe(false); // too short
  });

  test('findSolutions only returns valid placements', () => {
    for (const s of findSolutions(REGIONS, 50)) expect(isValidSolution(REGIONS, s)).toBe(true);
  });

  test('regionsAreWellFormed catches a split region', () => {
    expect(regionsAreWellFormed(REGIONS)).toBe(true);
    const broken = REGIONS.map((row) => row.slice());
    broken[4][4] = 0; // region 0 gets a far-away cell
    expect(regionsAreWellFormed(broken)).toBe(false);
  });
});

describe('generator and solver', () => {
  const cases = [
    { size: 5, maxTier: 2 },
    { size: 6, maxTier: 2 },
    { size: 7, maxTier: 3 },
    { size: 8, maxTier: 4 },
    { size: 9, maxTier: 5 },
  ];

  for (const { size, maxTier } of cases) {
    test(`size ${size}, tier <= ${maxTier}: unique, well formed, solvable by logic`, () => {
      for (let seed = 1; seed <= 6; seed++) {
        const p = generatePuzzle({ size, seed: seed * 7919 + size, maxTier, maxGivens: 1 });
        expect(p).not.toBeNull();
        const puzzle = p as Puzzle;
        expect(regionsAreWellFormed(puzzle.regions)).toBe(true);
        expect(isValidSolution(puzzle.regions, puzzle.solution)).toBe(true);
        const all = findSolutions(puzzle.regions, 2);
        expect(all.length).toBe(1);
        expect(all[0]).toEqual(puzzle.solution);
        const logic = solveLogic(puzzle, maxTier);
        expect(logic.solved).toBe(true);
        expect(logic.tier).toBeLessThanOrEqual(maxTier);
        expect(puzzle.tier).toBe(logic.tier);
        expect(puzzle.difficulty).toBeGreaterThanOrEqual(1);
        expect(puzzle.difficulty).toBeLessThanOrEqual(10);
      }
    });
  }

  test('the same seed gives the same puzzle', () => {
    const a = generatePuzzle({ size: 7, seed: 42, maxTier: 3 });
    const b = generatePuzzle({ size: 7, seed: 42, maxTier: 3 });
    expect(a).toEqual(b);
  });

  test('every solver step agrees with the solution', () => {
    const puzzle = generatePuzzle({ size: 8, seed: 99, maxTier: 5 }) as Puzzle;
    const { steps, solved } = solveLogic(puzzle, 5);
    expect(solved).toBe(true);
    for (const step of steps) {
      for (const [r, c] of step.cells) {
        if (step.kind === 'place') expect(puzzle.solution[r]).toBe(c);
        else expect(puzzle.solution[r]).not.toBe(c);
      }
    }
  });
});

describe('game', () => {
  const puzzle = generatePuzzle({ size: 6, seed: 2024, maxTier: 3 }) as Puzzle;

  test('correct picks win the game and the game adds no marks of its own', () => {
    const state = newGame(puzzle);
    let last = '';
    for (let r = 0; r < puzzle.size; r++) {
      if (state.found[r] !== -1) continue;
      last = pick(state, puzzle, r, puzzle.solution[r]);
    }
    expect(last).toBe('won');
    expect(state.status).toBe('won');
    expect(foundCount(state)).toBe(puzzle.size);
    expect(state.lives).toBe(3);
    expect(state.marks.every((m) => m === MARK_NONE)).toBe(true);
  });

  test('three wrong picks lose the game; only the wrong cells are revealed', () => {
    const state = newGame(puzzle);
    const wrongCol = (r: number): number => (puzzle.solution[r] + 1) % puzzle.size;
    const rows = Array.from({ length: puzzle.size }, (_, r) => r).filter((r) => state.found[r] === -1);
    expect(pick(state, puzzle, rows[0], wrongCol(rows[0]))).toBe('wrong');
    expect(state.lives).toBe(2);
    expect(state.marks[rows[0] * puzzle.size + wrongCol(rows[0])]).toBe(MARK_REVEALED);
    expect(pick(state, puzzle, rows[1], wrongCol(rows[1]))).toBe('wrong');
    expect(pick(state, puzzle, rows[2], wrongCol(rows[2]))).toBe('lost');
    expect(state.status).toBe('lost');
    expect(state.marks.filter((m) => m !== MARK_NONE).length).toBe(3);
    expect(pick(state, puzzle, rows[0], puzzle.solution[rows[0]])).toBe('ignored');
  });

  test('marks toggle and never land on a found cell', () => {
    const state = newGame(puzzle);
    const r = state.found.findIndex((c) => c === -1);
    const c = (puzzle.solution[r] + 2) % puzzle.size;
    expect(toggleMark(state, r, c)).toBe(true);
    expect(state.marks[r * puzzle.size + c]).toBe(MARK_PLAYER);
    expect(toggleMark(state, r, c)).toBe(true);
    expect(state.marks[r * puzzle.size + c]).toBe(MARK_NONE);
    pick(state, puzzle, r, puzzle.solution[r]);
    expect(toggleMark(state, r, puzzle.solution[r])).toBe(false);
  });

  test('state has no time field and survives a save and restore', () => {
    const state = newGame(puzzle);
    const r = state.found.findIndex((c) => c === -1);
    pick(state, puzzle, r, puzzle.solution[r]);
    expect('elapsedMs' in state).toBe(false);
    const restored = JSON.parse(JSON.stringify(state));
    expect(restored).toEqual(state);
  });

  test('following hints alone solves the puzzle without a mistake', () => {
    for (const seed of [5, 6, 7, 8]) {
      const p = generatePuzzle({ size: 8, seed, maxTier: 5 }) as Puzzle;
      const state = newGame(p);
      for (let guard = 0; guard < 2000 && state.status === 'playing'; guard++) {
        const hint = hintFor(state, p);
        expect(hint).not.toBeNull();
        const step = hint!.step;
        expect(step.cells.length).toBeGreaterThan(0);
        if (step.kind === 'place') {
          const [r, c] = step.cells[0];
          expect(pick(state, p, r, c)).not.toBe('wrong');
        } else {
          for (const [r, c] of step.cells) {
            expect(p.solution[r]).not.toBe(c);
            toggleMark(state, r, c);
          }
        }
      }
      expect(state.status).toBe('won');
      expect(state.mistakes).toBe(0);
    }
  });
});

describe('score', () => {
  test('points: 100 per difficulty grade, minus 20% per mistake and 10% per hint, floor 20%', () => {
    expect(levelScore(5, 0, 0)).toBe(500);
    expect(levelScore(5, 1, 0)).toBe(400);
    expect(levelScore(5, 0, 1)).toBe(450);
    expect(levelScore(5, 1, 1)).toBe(350);
    expect(levelScore(5, 2, 2)).toBe(200);
    expect(levelScore(5, 9, 9)).toBe(100); // floor
    expect(levelScore(1, 0, 0)).toBe(100);
    expect(levelScore(10, 0, 0)).toBe(1000);
  });

  test('stars: 3 clean, 2 for one mistake or hints only, 1 otherwise', () => {
    expect(levelStars(0, 0)).toBe(3);
    expect(levelStars(1, 0)).toBe(2);
    expect(levelStars(0, 1)).toBe(2);
    expect(levelStars(0, 4)).toBe(2);
    expect(levelStars(1, 1)).toBe(1);
    expect(levelStars(2, 0)).toBe(1);
    expect(levelStars(7, 0)).toBe(1);
  });

  test('current score follows the state', () => {
    const puzzle = generatePuzzle({ size: 6, seed: 2024, maxTier: 3 }) as Puzzle;
    const state = newGame(puzzle);
    expect(currentScore(state, puzzle)).toBe(100 * puzzle.difficulty);
    const r = state.found.findIndex((c) => c === -1);
    pick(state, puzzle, r, (puzzle.solution[r] + 1) % puzzle.size);
    expect(currentScore(state, puzzle)).toBe(Math.round(100 * puzzle.difficulty * 0.8));
  });
});

describe('level curve', () => {
  test('a level number always gives the same valid board', () => {
    for (const level of [1, 9, 61, 250, 1001, 5000]) {
      const a = generateLevel(level);
      const b = generateLevel(level);
      expect(a).toEqual(b);
      expect(a.size).toBe(bandFor(level).size);
      expect(a.tier).toBeLessThanOrEqual(bandFor(level).maxTier);
      expect(findSolutions(a.regions, 2).length).toBe(1);
      expect(solveLogic(a, 5).solved).toBe(true);
    }
  });
});
