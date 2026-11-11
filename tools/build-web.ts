/**
 * Builds the playable web slice into one self-contained file:
 * `bun tools/build-web.ts` -> web/dist/index.html
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const result = await Bun.build({ entrypoints: ['web/src/main.ts'], target: 'browser', minify: false });
if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}
const script = (await result.outputs[0].text()).replace(/<\/script/g, '<\\/script');
const html = readFileSync('web/src/index.html', 'utf8')
  .replace('/*TOKENS*/', () => readFileSync('docs/design/tokens.css', 'utf8'))
  .replace('/*APP*/', () => readFileSync('web/src/app.css', 'utf8'))
  .replace('/*SCRIPT*/', () => script);
mkdirSync('web/dist', { recursive: true });
writeFileSync('web/dist/index.html', html);
console.log(`web/dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
