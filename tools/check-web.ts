/**
 * Plays the web slice in headless Chrome and saves screenshots:
 * `bun tools/check-web.ts`. Needs Chrome on the machine; no npm packages.
 * It uses real mouse and key events, so the tap, double-tap and keyboard
 * handlers are exercised the way a player would.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const PORT = 9333;
const chrome = Bun.spawn(
  [
    'google-chrome',
    '--headless=new',
    '--no-sandbox',
    '--disable-gpu',
    '--hide-scrollbars',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=/tmp/pz-check-${Date.now()}`,
    'about:blank',
  ],
  { stdout: 'ignore', stderr: 'ignore' },
);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));
let target: { webSocketDebuggerUrl: string } | undefined;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = (await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()) as any[];
    target = list.find((t) => t.type === 'page');
  } catch {
    /* not up yet */
  }
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
let nextId = 1;
const waiting = new Map<number, (v: any) => void>();
const problems: string[] = [];
ws.onmessage = (e) => {
  const msg = JSON.parse(String(e.data));
  if (msg.id && waiting.has(msg.id)) {
    waiting.get(msg.id)!(msg.result ?? msg.error);
    waiting.delete(msg.id);
  } else if (msg.method === 'Runtime.exceptionThrown') {
    problems.push('exception: ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text));
  } else if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
    problems.push('console.error: ' + msg.params.args.map((a: any) => a.value ?? a.description).join(' '));
  }
};
const send = (method: string, params: object = {}): Promise<any> =>
  new Promise((res) => {
    const id = nextId++;
    waiting.set(id, res);
    ws.send(JSON.stringify({ id, method, params }));
  });
const js = async (expression: string): Promise<any> => {
  const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (r.exceptionDetails) throw new Error('eval failed: ' + expression.slice(0, 120) + ' :: ' + (r.exceptionDetails.exception?.description ?? r.exceptionDetails.text).slice(0, 200));
  return r.result.value;
};

const results: [string, boolean, string][] = [];
const check = (name: string, ok: boolean, detail = ''): void => {
  results.push([name, ok, detail]);
};

const url = 'file://' + resolve('web/dist/index.html') + '?debug';
const viewport = (width: number, height: number, scale: number): Promise<any> =>
  send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
const shot = async (file: string): Promise<void> => {
  const r = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(file, Buffer.from(r.data, 'base64'));
};
const load = async (): Promise<void> => {
  await send('Page.navigate', { url });
  for (let i = 0; i < 50; i++) {
    await sleep(100);
    const ready = await js(`document.readyState === 'complete' && !!document.querySelector('#app')?.children.length && location.search === '?debug'`).catch(() => false);
    if (ready) return;
  }
  throw new Error('page did not load: ' + (await js('location.href')));
};
const click = async (x: number, y: number, count = 1): Promise<void> => {
  for (let i = 1; i <= count; i++) {
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: i });
    await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: i });
  }
};
const centre = (selector: string, index = 0): Promise<{ x: number; y: number } | null> =>
  js(`(() => { const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}]; if (!el) return null; el.scrollIntoView({ block: 'center' });
        const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; })()`);
const clickOn = async (selector: string, index = 0, count = 1): Promise<void> => {
  const p = await centre(selector, index);
  if (!p) throw new Error('not found: ' + selector);
  await click(p.x, p.y, count);
  await sleep(80);
};
const clickText = async (text: string): Promise<void> => {
  const i = await js(`[...document.querySelectorAll('button')].findIndex(b => b.textContent.trim().startsWith(${JSON.stringify(text)}))`);
  if (i < 0) throw new Error('no button: ' + text);
  await clickOn('button', i);
};
const key = async (k: string, code = k): Promise<void> => {
  const text = k === 'Enter' ? '\r' : k.length === 1 ? k : undefined;
  await send('Input.dispatchKeyEvent', { type: 'keyDown', key: k, code, text, windowsVirtualKeyCode: k === 'Enter' ? 13 : undefined });
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: k, code });
};
const session = (): Promise<any> => js('JSON.parse(JSON.stringify(window.__pz.session()))');
const level = (n: number): Promise<any> => js(`JSON.parse(JSON.stringify(window.__pz.level(${n})))`);
const openRows = (state: any): number[] => state.found.map((c: number, r: number) => (c === -1 ? r : -1)).filter((r: number) => r >= 0);

mkdirSync('docs/screens', { recursive: true });
await send('Page.enable');
await send('Runtime.enable');

/* 1. Home, at the reference viewport (414 x 736 at 3x = 1242 x 2208). */
await viewport(414, 736, 3);
await load();
await js('localStorage.clear()');
await load();
check('home shows a play button for level 1', await js(`!!document.querySelector('.home .btn')?.textContent.includes('level 1')`));
check('only level 1 is unlocked', (await js(`document.querySelectorAll('.levelbtn:not(:disabled)').length`)) === 1);
await shot('docs/screens/S03-home.png');

/* 2. Open level 1. */
await clickOn('.home .btn');
const p1 = await level(1);
const n = p1.size;
check('header shows points and no time', await js(`[...document.querySelectorAll('.stat small')].map(e => e.textContent).join() === 'Level,Points'`));
check('a fresh level is worth 100 x its grade', (await js(`document.querySelectorAll('.stat b')[1].textContent`)) === String(100 * p1.difficulty));
check('board has size x size cells', (await js(`document.querySelectorAll('.cell').length`)) === n * n);
await shot('docs/screens/S04-fresh.png');

/* 3. One tap marks, a second slow tap unmarks. */
let st = (await session()).state;
const row0 = openRows(st)[0];
const emptyCol = [...Array(n).keys()].find((c) => c !== p1.solution[row0] && st.marks[row0 * n + c] === 0)!;
const markIdx = row0 * n + emptyCol;
await clickOn('.cell', markIdx);
await sleep(350);
check('tap puts a mark', (await session()).state.marks[markIdx] === 1);
await clickOn('.cell', markIdx);
await sleep(350);
check('second tap removes it', (await session()).state.marks[markIdx] === 0);

/* 4. Double tap on a wrong cell costs a life. */
await clickOn('.cell', markIdx, 2);
st = (await session()).state;
check('wrong placement costs one life', st.lives === 2 && st.mistakes === 1, `lives ${st.lives}`);
check('a mistake lowers the points shown by 20%', (await js(`document.querySelectorAll('.stat b')[1].textContent`)) === String(Math.round(100 * p1.difficulty * 0.8)));
check('wrong cell is marked afterwards', st.marks[markIdx] === 2);
check('lives display shows one lost', (await js(`document.querySelectorAll('.life.lost').length`)) === 1);

/* 5. Double tap on the right cell places a piece and marks around it. */
await sleep(350);
await clickOn('.cell', row0 * n + p1.solution[row0], 2);
st = (await session()).state;
check('correct placement stays', st.found[row0] === p1.solution[row0]);
check('no cells are marked automatically', st.marks.filter((m: number) => m !== 0).length === 1, `${st.marks.filter((m: number) => m !== 0).length} marks`);
check('the found kind lights up in the tracker', (await js(`[...document.querySelectorAll('.kind')].map(k => k.classList.contains('found')).join()`)) === [...Array(n).keys()].map((k) => k === p1.regions[row0][p1.solution[row0]]).join());
check('found cell shows a fruit icon', await js(`!!document.querySelectorAll('.cell')[${row0 * n + p1.solution[row0]}].querySelector('.piece svg')`));
check('tracker shows one more piece', (await js(`document.querySelectorAll('.kind.found').length`)) === st.found.filter((c: number) => c !== -1).length);
await sleep(400);
await shot('docs/screens/S04-in-progress.png');

/* 6. Reload: the unfinished level comes back as it was (flow F08). */
const before = (await session()).state;
await load();
const after = (await session())?.state;
check(
  'reload restores pieces, marks, lives',
  !!after && JSON.stringify(after.found) === JSON.stringify(before.found) && JSON.stringify(after.marks) === JSON.stringify(before.marks) && after.lives === before.lives,
);
check('reload opens the board, not home', (await js(`document.querySelectorAll('.cell').length`)) === n * n);

/* 7. Hint: highlights cells, explains, spends one hint. */
const hintsBefore = await js('window.__pz.wallet().hints');
await clickText('Hint');
check('hint highlights at least one cell', (await js(`document.querySelectorAll('.cell.hint').length`)) >= 1);
check('hint text is shown', await js(`document.querySelector('.message').classList.contains('hinting')`));
check('hint count goes down by one', (await js('window.__pz.wallet().hints')) === hintsBefore - 1);
await shot('docs/screens/S05-hint.png');

/* 8. Finish level 1 with double taps: win dialog, progress saved. */
st = (await session()).state;
for (const r of openRows(st)) {
  await clickOn('.cell', r * n + p1.solution[r], 2);
  await sleep(330);
}
await sleep(900);
check('win dialog appears', (await js(`document.querySelector('.dialog h2')?.textContent`)) === 'Solved');
const best1 = await js(`JSON.parse(JSON.stringify(window.__pz.progress().best['1']))`);
check('level 1 result: 1 mistake and 1 hint give 70% and 1 star', best1.score === Math.round(100 * p1.difficulty * 0.7) && best1.stars === 1, JSON.stringify(best1));
check('win dialog shows the stars', (await js(`document.querySelector('.dialog .bigstars')?.getAttribute('aria-label')`)) === '1 of 3 stars');
check('no hint is earned after a mistake', (await js('window.__pz.wallet().hints')) === hintsBefore - 1);
check('level 2 unlocked', (await js('window.__pz.progress().next')) === 2);
check('session cleared after a win', (await js('window.__pz.session()')) === null);
await shot('docs/screens/S07-level-complete.png');

/* 9. Next level, then lose it: three wrong placements. */
await clickText('Next level');
const p2 = await level(2);
st = (await session()).state;
check('next level opens level 2', (await session()).level === 2);
let wrongs = 0;
for (const r of openRows(st)) {
  if (wrongs === 3) break;
  const c = [...Array(p2.size).keys()].find((cc) => cc !== p2.solution[r])!;
  await clickOn('.cell', r * p2.size + c, 2);
  await sleep(330);
  wrongs++;
}
check('three mistakes end the attempt', (await session()).state.status === 'lost');
check('out-of-lives dialog appears', (await js(`document.querySelector('.dialog h2')?.textContent`)) === 'Out of lives');
await shot('docs/screens/S06-out-of-lives.png');
await load();
check('a lost attempt is still lost after reload', (await js(`document.querySelector('.dialog h2')?.textContent`)) === 'Out of lives');
await clickText('Try again');
st = (await session()).state;
check('try again gives a fresh board', st.lives === 3 && st.mistakes === 0 && st.status === 'playing');

/* 10. Keyboard only: solve level 2 with arrows and Enter, mark with Space. */
await js(`document.querySelectorAll('.cell')[0].focus()`);
let pos = { r: 0, c: 0 };
const moveTo = async (r: number, c: number): Promise<void> => {
  while (pos.r < r) { await key('ArrowDown'); pos.r++; }
  while (pos.r > r) { await key('ArrowUp'); pos.r--; }
  while (pos.c < c) { await key('ArrowRight'); pos.c++; }
  while (pos.c > c) { await key('ArrowLeft'); pos.c--; }
};
st = (await session()).state;
const kr = openRows(st)[0];
const kc = [...Array(p2.size).keys()].find((c) => c !== p2.solution[kr] && st.marks[kr * p2.size + c] === 0)!;
await moveTo(kr, kc);
await key(' ', 'Space');
check('Space marks the focused cell', (await session()).state.marks[kr * p2.size + kc] === 1);
for (const r of openRows(st)) {
  await moveTo(r, p2.solution[r]);
  await key('Enter');
  await sleep(60);
}
await sleep(900);
check('keyboard-only play wins the level', (await js(`document.querySelector('.dialog h2')?.textContent`)) === 'Solved');
const best2 = await js(`JSON.parse(JSON.stringify(window.__pz.progress().best['2']))`);
check('a clean solve gives full points and 3 stars', best2.score === 100 * p2.difficulty && best2.stars === 3, JSON.stringify(best2));
check('a clean first solve earns a hint', (await js('window.__pz.wallet().hints')) === hintsBefore);
check('focus is inside the dialog', await js(`!!document.activeElement?.closest('.dialog')`));
await clickText('Home');
check('no region outlines by default', (await js(`document.querySelectorAll('.board.outlined').length`)) === 0);
check('home shows total points', await js(`document.body.textContent.includes('${best1.score + best2.score} points')`));
await clickOn('.levelbtn', 0);
const again = (await session()).state;
for (const r of openRows(again)) {
  await clickOn('.cell', r * n + p1.solution[r], 2);
  await sleep(330);
}
await sleep(900);
const best1b = await js(`JSON.parse(JSON.stringify(window.__pz.progress().best['1']))`);
check('replaying a level raises its best result', best1b.score === 100 * p1.difficulty && best1b.stars === 3, JSON.stringify(best1b));
check('replaying does not earn another hint', (await js('window.__pz.wallet().hints')) === hintsBefore);
await clickText('Home');
check('home shows 2 solved', await js(`document.body.textContent.includes('2 levels solved')`));

/* 11. A large board, and other widths. */
await js(`localStorage.setItem('fd.v2.progress', JSON.stringify({ next: 60, best: {} }))`);
await load();
await clickOn('.levelbtn', 49);
check('level 50 is a 9 x 9 board', (await js(`document.querySelectorAll('.cell').length`)) === 81);
await shot('docs/screens/S04-9x9.png');
for (const [w, hgt] of [[390, 844], [1440, 900]] as const) {
  await viewport(w, hgt, 1);
  await sleep(150);
  const fits = await js('document.documentElement.scrollWidth <= window.innerWidth');
  check(`no sideways scroll at ${w}px`, fits);
  const cellSize = await js(`document.querySelector('.cell').getBoundingClientRect().width`);
  check(`cells are square and visible at ${w}px`, cellSize > 20, `cell ${Math.round(cellSize)}px`);
  await shot(`docs/screens/S04-9x9-${w}.png`);
}

/* 11b. Settings: easy mode is gone; progress from the earlier build carries over. */
await viewport(414, 736, 3);
await js('window.__pz.dropSession()');
await load();
await clickOn('.levelbtn', 0);
await clickOn('.iconbtn[aria-label="Settings"]');
const toggles = await js(`[...document.querySelectorAll('.dialog .toggle span')].map(e => e.textContent).join(' | ')`);
check('settings has no easy mode', !/easy/i.test(toggles) && toggles.split(' | ').length === 2, toggles);
await js(`localStorage.clear(); localStorage.setItem('pz.v1.progress', JSON.stringify({ next: 7, best: { 1: { ms: 5000, mistakes: 0 } } }))`);
await load();
check('old progress carries over and the old keys are removed', (await js('window.__pz.progress().next')) === 7 && (await js(`localStorage.getItem('pz.v1.progress')`)) === null);

/* 12. Past the bundled pack: levels are generated on the device. */
await viewport(414, 736, 3);
const packSize = await js('window.__pz.packSize');
await js('window.__pz.dropSession()');
await js(`localStorage.setItem('fd.v2.progress', JSON.stringify({ next: ${packSize + 3}, best: {} }))`);
await load();
check('home offers a level past the pack', await js(`document.querySelector('.home .btn').textContent.includes('${packSize + 3}')`));
await clickOn('.home .btn');
const far = await level(packSize + 3);
check('a generated level opens with a full board', (await js(`document.querySelectorAll('.cell').length`)) === far.size * far.size, `size ${far.size}`);
check('the generated level is stable across reloads', JSON.stringify(far) === (await (async () => { await load(); return JSON.stringify(await level(packSize + 3)); })()));

check('no console errors or exceptions', problems.length === 0, problems.join(' | ').slice(0, 300));

ws.close();
chrome.kill();
let failed = 0;
for (const [name, ok, detail] of results) {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  (' + detail + ')' : ''}`);
}
console.log(`\n${results.length - failed} of ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
