/**
 * Mass check of generated levels: `bun tools/verify-levels.ts <from> <to> [outFile]`.
 * For every level number in the range it generates the board and checks:
 * regions well formed, exactly one solution, solvable by logic alone, within
 * the technique tier its place in the curve allows, and that the solver's
 * steps never contradict the solution. Writes a JSON summary with a hash of
 * every board, so several runs can be merged and checked for duplicates.
 */
import { writeFileSync } from 'node:fs';
import { bandFor, findSolutions, generateLevel, isValidSolution, regionsAreWellFormed, solveLogic } from '../packages/engine/src';

const from = Number(process.argv[2] ?? 1);
const to = Number(process.argv[3] ?? 1000);
const out = process.argv[4];
const failures: string[] = [];
const hashes: string[] = [];
const sizes: Record<string, number> = {};
const tiers: Record<string, number> = {};
const grades: Record<string, number> = {};
let slowestMs = 0;
let slowestLevel = 0;
const started = Date.now();

for (let level = from; level <= to; level++) {
  const t = Date.now();
  const p = generateLevel(level);
  const ms = Date.now() - t;
  if (ms > slowestMs) {
    slowestMs = ms;
    slowestLevel = level;
  }
  const band = bandFor(level);
  if (p.size !== band.size) failures.push(`${level}: size ${p.size}, expected ${band.size}`);
  if (!regionsAreWellFormed(p.regions)) failures.push(`${level}: regions not well formed`);
  if (!isValidSolution(p.regions, p.solution)) failures.push(`${level}: stored solution breaks a rule`);
  const all = findSolutions(p.regions, 2);
  if (all.length !== 1) failures.push(`${level}: ${all.length} solutions`);
  else if (all[0].join() !== p.solution.join()) failures.push(`${level}: stored solution is not the unique one`);
  const logic = solveLogic(p, band.maxTier);
  if (!logic.solved) failures.push(`${level}: not solvable by logic within tier ${band.maxTier}`);
  for (const step of logic.steps) {
    for (const [r, c] of step.cells) {
      const isSolution = p.solution[r] === c;
      if ((step.kind === 'place') !== isSolution) failures.push(`${level}: solver step contradicts the solution`);
    }
  }
  if (p.difficulty < 1 || p.difficulty > 10) failures.push(`${level}: grade ${p.difficulty} out of range`);
  hashes.push(p.regions.map((row) => row.join('')).join('/'));
  sizes[p.size] = (sizes[p.size] ?? 0) + 1;
  tiers[p.tier] = (tiers[p.tier] ?? 0) + 1;
  grades[p.difficulty] = (grades[p.difficulty] ?? 0) + 1;
}

const summary = { from, to, count: to - from + 1, failures, sizes, tiers, grades, slowestMs, slowestLevel, totalMs: Date.now() - started, hashes };
if (out) writeFileSync(out, JSON.stringify(summary));
console.log(JSON.stringify({ ...summary, hashes: hashes.length }));
