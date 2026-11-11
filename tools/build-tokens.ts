/**
 * Regenerates docs/design/tokens.css and theme.ts from tokens.json:
 * `bun tools/build-tokens.ts`. Run it after any token change.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const dir = 'docs/design';
const t = JSON.parse(readFileSync(`${dir}/tokens.json`, 'utf8'));

const css: string[] = ['/* Generated from tokens.json. Do not edit by hand. */', ':root {'];
for (const [k, v] of Object.entries(t.color)) css.push(`  --color-${k}: ${v};`);
for (const [k, v] of Object.entries(t.overlay)) css.push(`  --overlay-${k}: ${v};`);
for (const [k, v] of Object.entries(t.font)) css.push(`  --font-${k}: ${v};`);
for (const [k, v] of Object.entries<any>(t.type)) {
  css.push(`  --text-${k}-size: ${v.size}px;`, `  --text-${k}-line: ${v.line}px;`, `  --text-${k}-weight: ${v.weight};`);
}
t.space.forEach((v: number, i: number) => css.push(`  --space-${i}: ${v}px;`));
for (const group of ['radius', 'border', 'size']) {
  for (const [k, v] of Object.entries(t[group])) css.push(`  --${group}-${k}: ${v}px;`);
}
for (const [k, v] of Object.entries(t.scale)) css.push(`  --scale-${k}: ${v};`);
for (const [k, v] of Object.entries(t.shadow)) css.push(`  --shadow-${k}: ${v};`);
for (const [k, v] of Object.entries(t.motion)) css.push(`  --motion-${k}: ${v};`);
css.push('}');
writeFileSync(`${dir}/tokens.css`, css.join('\n') + '\n');

const motion = Object.fromEntries(
  Object.entries<string>(t.motion).map(([k, v]) => [k, v.endsWith('ms') ? Number(v.slice(0, -2)) : v]),
);
const obj = (o: unknown): string => JSON.stringify(o, null, 2).replace(/\n/g, '\n  ');
const ts = [
  '// Generated from tokens.json. Do not edit by hand.',
  "// React Native theme: the app's equivalent of the Tailwind mapping.",
  '// Components read from `theme`, never from raw hex or pixel values.',
  '',
  'export const theme = {',
  `  color: ${obj(t.color)},`,
  `  overlay: ${obj(t.overlay)},`,
  "  font: { sans: 'Nunito', arabic: 'Cairo' },",
  `  type: ${obj(t.type)},`,
  `  space: ${JSON.stringify(t.space)},`,
  `  radius: ${JSON.stringify(t.radius)},`,
  `  border: ${JSON.stringify(t.border)},`,
  `  size: ${JSON.stringify(t.size)},`,
  `  scale: ${JSON.stringify(t.scale)},`,
  `  motion: ${JSON.stringify(motion)},`,
  '} as const;',
  '',
  `export const regionColors = [${Array.from({ length: 12 }, (_, i) => `theme.color['region-${i + 1}']`).join(', ')}] as const;`,
  '',
  'export type Theme = typeof theme;',
  '',
];
writeFileSync(`${dir}/theme.ts`, ts.join('\n'));
console.log('tokens.css and theme.ts written');
