/**
 * Builds the bundled level pack: `bun tools/generate-levels.ts [count]`.
 * A pack is a cache of generateLevel(1..count), so bundled and on-device
 * levels are the same boards. Every level is re-verified before the file is
 * written. Output: levels/pack-001.json.
 */
import { writeFileSync } from 'node:fs';
import { findSolutions, generateLevel, Puzzle, regionsAreWellFormed, solveLogic } from '../packages/engine/src';

const count = Number(process.argv[2] ?? 1000);
const started = Date.now();
const levels: Puzzle[] = [];
let slowest = 0;
for (let level = 1; level <= count; level++) {
  const t = Date.now();
  const p = generateLevel(level);
  slowest = Math.max(slowest, Date.now() - t);
  if (!regionsAreWellFormed(p.regions)) throw new Error(`${p.id}: bad regions`);
  const all = findSolutions(p.regions, 2);
  if (all.length !== 1) throw new Error(`${p.id}: ${all.length} solutions`);
  if (!solveLogic(p, 5).solved) throw new Error(`${p.id}: not solvable by logic`);
  levels.push(p);
}
const file = 'levels/pack-001.json';
const json = JSON.stringify({ generator: 'g1', count, levels });
writeFileSync(file, json + '\n');
const tally = (f: (p: Puzzle) => number): string =>
  Object.entries(levels.reduce<Record<number, number>>((a, p) => ((a[f(p)] = (a[f(p)] ?? 0) + 1), a), {}))
    .map(([k, v]) => `${k}:${v}`)
    .join(' ');
console.log(`${file}: ${count} levels, ${(json.length / 1024).toFixed(0)} KB, ${Date.now() - started} ms, slowest level ${slowest} ms`);
console.log(`sizes  ${tally((p) => p.size)}`);
console.log(`tiers  ${tally((p) => p.tier)}`);
console.log(`first 60 sizes ${levels.slice(0, 60).map((p) => (p.size === 10 ? 'X' : p.size)).join('')}`);
