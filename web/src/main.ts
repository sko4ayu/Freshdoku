import pack from '../../levels/pack-001.json';
import {
  currentScore,
  foundCount,
  GameState,
  generateLevel,
  hintFor,
  levelStars,
  MARK_REVEALED,
  MARK_NONE,
  newGame,
  pick,
  Puzzle,
  START_LIVES,
  toggleMark,
  Unit,
} from '../../packages/engine/src';
import { KIND_NAMES, kindIcon, WORM_ICON } from './icons';
import { S } from './strings';

/* ---------- data layer (local only; same shapes as architecture.md "Local data") ---------- */

interface Progress {
  next: number; // lowest unsolved level, 1-based
  /** Best result per level number. Replaying a level can only raise it. */
  best: Record<string, { score: number; stars: number }>;
}
interface Session {
  level: number;
  state: GameState;
}
interface Settings {
  /** Draw a line where two kinds meet, for players who cannot tell the colours apart. */
  outlines: boolean;
  showRules: boolean;
}

const PREFIX = 'fd.v2.';
function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown): void {
  try {
    if (value === null) localStorage.removeItem(PREFIX + key);
    else localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage can be unavailable; the game still runs for this visit */
  }
}

const packLevels = (pack as { levels: Puzzle[] }).levels;
const generated = new Map<number, Puzzle>();
/** Levels past the bundled pack are generated on the device from the level number. */
function getLevel(level: number): Puzzle {
  if (level <= packLevels.length) return packLevels[level - 1];
  let puzzle = generated.get(level);
  if (!puzzle) {
    puzzle = generateLevel(level);
    generated.set(level, puzzle);
  }
  return puzzle;
}
const PAGE = 60;
const HINTS_START = 3;
const HINTS_MAX = 5;
const DOUBLE_TAP_MS = 300;

let progress = load<Progress>('progress', { next: 1, best: {} });
migrateFromV1();
let wallet = load<{ hints: number }>('wallet', { hints: HINTS_START });
let settings = load<Settings>('settings', { outlines: false, showRules: true });
let session: Session | null = restoreSession();

/** Earlier builds saved under another prefix and tracked time. Only the unlocked level carries over. */
function migrateFromV1(): void {
  try {
    const old = localStorage.getItem('pz.v1.progress');
    if (!old) return;
    const next = Number(JSON.parse(old).next);
    if (Number.isInteger(next) && next > progress.next) {
      progress = { next, best: progress.best };
      save('progress', progress);
    }
    for (const key of ['progress', 'session', 'wallet', 'settings']) localStorage.removeItem('pz.v1.' + key);
  } catch {
    /* nothing to migrate */
  }
}

function restoreSession(): Session | null {
  const s = load<Partial<Session>>('session', {});
  if (!s.level || !s.state) return null;
  const puzzle = Number.isInteger(s.level) && s.level >= 1 ? getLevel(s.level) : undefined;
  const st = s.state;
  const ok =
    !!puzzle &&
    st.puzzleId === puzzle.id &&
    Array.isArray(st.found) &&
    st.found.length === puzzle.size &&
    Array.isArray(st.marks) &&
    st.marks.length === puzzle.size * puzzle.size;
  return ok ? { level: s.level, state: st } : null;
}

/* ---------- small DOM helpers ---------- */

type Attrs = Record<string, string | number | boolean | ((e: Event) => void)>;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  el.append(...children);
  return el;
}

const app = document.getElementById('app')!;
const live = h('div', { class: 'sr', 'aria-live': 'polite' });
document.body.append(live);
function announce(text: string): void {
  live.textContent = '';
  requestAnimationFrame(() => (live.textContent = text));
}

/* ---------- dialogs ---------- */

let closeDialog: (() => void) | null = null;
function openDialog(title: string, body: (Node | string)[], actions: HTMLElement[], dismissable = false): void {
  closeDialog?.();
  const previous = document.activeElement as HTMLElement | null;
  const dialog = h(
    'div',
    { class: 'dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('h2', {}, title),
    ...body,
    h('div', { class: 'actions' }, ...actions),
  );
  const scrim = h('div', { class: 'scrim' }, dialog);
  const close = (): void => {
    scrim.remove();
    document.removeEventListener('keydown', onKey, true);
    closeDialog = null;
    if (previous?.isConnected) previous.focus();
  };
  const onKey = (e: KeyboardEvent): void => {
    if (e.key === 'Escape' && dismissable) {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll<HTMLElement>('button, input')];
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  if (dismissable) scrim.addEventListener('click', (e) => e.target === scrim && close());
  document.addEventListener('keydown', onKey, true);
  document.body.append(scrim);
  closeDialog = close;
  dialog.querySelector<HTMLElement>('button, input')?.focus();
}

function openSettings(onChange: () => void): void {
  const toggle = (label: string, key: keyof Settings): HTMLElement => {
    const input = h('input', { type: 'checkbox' });
    input.checked = settings[key];
    input.addEventListener('change', () => {
      settings = { ...settings, [key]: input.checked };
      save('settings', settings);
      onChange();
    });
    return h('label', { class: 'toggle' }, h('span', {}, label), input);
  };
  let armed = false;
  const reset = h('button', { class: 'btn danger', type: 'button' }, S.resetProgress);
  reset.addEventListener('click', () => {
    if (!armed) {
      armed = true;
      reset.textContent = S.resetConfirm;
      return;
    }
    progress = { next: 1, best: {} };
    wallet = { hints: HINTS_START };
    session = null;
    save('progress', progress);
    save('wallet', wallet);
    save('session', null);
    closeDialog?.();
    showHome();
  });
  const done = h('button', { class: 'btn', type: 'button', onclick: () => closeDialog?.() }, S.close);
  openDialog(S.settingsTitle, [toggle(S.outlines, 'outlines'), toggle(S.showRules, 'showRules')], [reset, done], true);
}

/* ---------- S03 home ---------- */

function showHome(page?: number): void {
  closeDialog?.();
  const done = progress.next - 1;
  const results = Object.values(progress.best);
  const totalScore = results.reduce((sum, b) => sum + b.score, 0);
  const totalStars = results.reduce((sum, b) => sum + b.stars, 0);
  const resumable = session && session.state.status === 'playing' ? session.level : 0;
  const target = resumable || progress.next;
  const shown = page ?? Math.floor((target - 1) / PAGE);
  const first = shown * PAGE + 1;
  const last = first + PAGE - 1;

  const playLabel = resumable ? S.resume(target) : S.play(target);
  const play = h('button', { class: 'btn block', type: 'button', onclick: () => openLevel(target) }, playLabel);

  const grid = h('div', { class: 'levelgrid' });
  for (let level = first; level <= last; level++) {
    const solved = level < progress.next;
    const locked = level > progress.next;
    const stars = progress.best[String(level)]?.stars ?? 0;
    const label = locked ? S.levelLocked(level) : solved ? S.levelDone(level, stars) : S.levelN(level);
    const b = h(
      'button',
      { class: 'levelbtn' + (solved ? ' done' : ''), type: 'button', 'aria-label': label, disabled: locked },
      String(level),
    );
    if (stars) b.append(h('span', { class: 'stars', 'aria-hidden': 'true' }, '\u2605'.repeat(stars)));
    b.addEventListener('click', () => openLevel(level));
    grid.append(b);
  }
  const pager = h(
    'div',
    { class: 'row spread' },
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': S.earlier, disabled: shown === 0, onclick: () => showHome(shown - 1) }, '\u2039'),
    h('span', { class: 'range' }, S.pageRange(first, last)),
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': S.later, disabled: last >= progress.next, onclick: () => showHome(shown + 1) }, '\u203a'),
  );

  app.replaceChildren(
    h(
      'main',
      { class: 'home' },
      h('h1', {}, S.appTitle),
      h('p', {}, S.appTagline),
      play,
      h('p', {}, S.summary(done, totalScore, totalStars)),
      h('h2', {}, S.levels),
      pager,
      grid,
    ),
  );
  if (page === undefined) play.focus();
}

/* ---------- S04 game board, S06 out of lives, S07 level complete ---------- */

function openLevel(level: number, fresh = false): void {
  if (!Number.isInteger(level) || level < 1) return showHome();
  const puzzle = getLevel(level);
  const n = puzzle.size;
  if (fresh || !session || session.level !== level) {
    session = { level, state: newGame(puzzle) };
  }
  const state = session.state;
  const persist = (): void => save('session', session);
  persist();

  /* header */
  const scoreEl = h('b', {}, String(currentScore(state, puzzle)));
  const header = h(
    'div',
    { class: 'header' },
    h('button', { class: 'iconbtn', type: 'button', 'aria-label': S.back, onclick: () => showHome() }, '←'),
    h(
      'div',
      { class: 'stats' },
      h('div', { class: 'stat' }, h('small', {}, S.level), h('b', {}, String(level))),
      h('div', { class: 'stat' }, h('small', {}, S.points), scoreEl),
    ),
    h(
      'button',
      { class: 'iconbtn', type: 'button', 'aria-label': S.settings, onclick: () => openSettings(applySettings) },
      '⚙',
    ),
  );

  /* tracker and lives */
  const tracker = h('div', { class: 'pill', role: 'img' });
  const lives = h('div', { class: 'pill fixed', role: 'img' });
  const renderStatus = (): void => {
    scoreEl.textContent = String(currentScore(state, puzzle));
    const placed = foundCount(state);
    const foundKinds = new Set<number>();
    state.found.forEach((c, r) => {
      if (c !== -1) foundKinds.add(puzzle.regions[r][c]);
    });
    tracker.setAttribute('aria-label', S.foundOf(placed, n));
    tracker.replaceChildren(
      ...Array.from({ length: n }, (_, kind) => {
        const icon = h('span', { class: 'kind' + (foundKinds.has(kind) ? ' found' : '') });
        icon.innerHTML = kindIcon(kind);
        return icon;
      }),
    );
    lives.setAttribute('aria-label', S.livesLeft(state.lives, START_LIVES));
    lives.replaceChildren(
      ...Array.from({ length: START_LIVES }, (_, i) => h('span', { class: 'life' + (i < state.lives ? '' : ' lost') })),
    );
  };

  /* rules and message line */
  const rules = h(
    'div',
    { class: 'rules' },
    h('div', { class: 'rule' }, S.ruleRegion),
    h('div', { class: 'rule' }, S.ruleLine),
    h('div', { class: 'rule' }, S.ruleTouch),
  );
  const message = h('p', { class: 'message' }, S.howTo);
  const applySettings = (): void => {
    rules.hidden = !settings.showRules;
    board.classList.toggle('outlined', settings.outlines);
  };

  /* board */
  const board = h('div', { class: 'board', role: 'grid', style: `--n:${n}` });
  const cells: HTMLElement[] = [];
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      const reg = puzzle.regions[r][c];
      const edges =
        (r === 0 || puzzle.regions[r - 1][c] !== reg ? ' bt' : '') +
        (r === n - 1 || puzzle.regions[r + 1][c] !== reg ? ' bb' : '') +
        (c === 0 || puzzle.regions[r][c - 1] !== reg ? ' bl' : '') +
        (c === n - 1 || puzzle.regions[r][c + 1] !== reg ? ' br' : '');
      const cell = h('div', {
        class: 'cell' + edges,
        role: 'button',
        tabindex: r === 0 && c === 0 ? 0 : -1,
        style: `background:var(--color-region-${reg + 1})`,
      });
      const i = r * n + c;
      cell.addEventListener('click', () => onTap(i));
      cell.addEventListener('keydown', (e) => onKey(e, i));
      cells.push(cell);
      board.append(cell);
    }
  }

  applySettings();

  const renderCell = (i: number): void => {
    const r = Math.floor(i / n);
    const c = i % n;
    const cell = cells[i];
    const isFound = state.found[r] === c;
    const given = isFound && puzzle.givens.includes(r);
    let label = S.cellEmpty;
    if (isFound) {
      const piece = h('span', { class: 'piece' + (given ? ' given' : ''), style: `--i:${r}` });
      piece.innerHTML = kindIcon(puzzle.regions[r][c]);
      cell.replaceChildren(piece);
      label = given ? S.cellGiven : S.cellPiece;
    } else if (state.marks[i] !== MARK_NONE) {
      const mark = h('span', { class: 'mark' + (state.marks[i] === MARK_REVEALED ? ' revealed' : '') });
      mark.innerHTML = WORM_ICON;
      cell.replaceChildren(mark);
      label = S.cellMarked;
    } else {
      cell.replaceChildren();
    }
    cell.setAttribute('aria-label', S.cell(r + 1, c + 1, KIND_NAMES[puzzle.regions[r][c]], label));
  };
  const renderBoard = (): void => {
    for (let i = 0; i < n * n; i++) renderCell(i);
    renderStatus();
  };

  /* hint highlight */
  const clearHint = (): void => {
    for (const cell of cells) cell.classList.remove('hint', 'dim');
    message.classList.remove('hinting');
  };
  const inUnit = (u: Unit, r: number, c: number): boolean =>
    u.type === 'row' ? u.index === r : u.type === 'col' ? u.index === c : puzzle.regions[r][c] === u.index;
  const unitName = (u: Unit): string => (u.type === 'row' ? S.unitRow : u.type === 'col' ? S.unitCol : S.unitRegion);

  const hintBtn = h('button', { class: 'btn secondary grow', type: 'button' });
  const renderHintBtn = (): void => {
    const none = wallet.hints <= 0;
    hintBtn.textContent = none ? S.noHints : S.hint(wallet.hints);
    hintBtn.disabled = none || state.status !== 'playing';
  };
  hintBtn.addEventListener('click', () => {
    if (wallet.hints <= 0) return;
    const hint = hintFor(state, puzzle);
    if (!hint) return;
    const step = hint.step;
    clearHint();
    const targets = new Set(step.cells.map(([r, c]) => r * n + c));
    cells.forEach((cell, i) => {
      const r = Math.floor(i / n);
      const c = i % n;
      if (targets.has(i)) cell.classList.add('hint');
      else if (step.units.length && !step.units.some((u) => inUnit(u, r, c))) cell.classList.add('dim');
    });
    let text = S.hintReveal;
    if (step.technique === 'single') text = S.hintSingle(unitName(step.units[0]));
    else if (step.technique === 'blocker') text = S.hintBlocker(unitName(step.units[0]));
    else if (step.technique === 'group2' || step.technique === 'group3') {
      const usesRows = step.units.some((u) => u.type === 'row');
      text = S.hintGroup(step.technique === 'group2' ? 2 : 3, usesRows ? S.linesRows : S.linesCols);
    } else if (step.technique === 'chain') text = S.hintChain;
    message.textContent = text;
    message.classList.add('hinting');
    announce(text);
    wallet = { hints: wallet.hints - 1 };
    state.hintsUsed++;
    save('wallet', wallet);
    persist();
    renderStatus();
    renderHintBtn();
  });

  /* input */
  let lastTap = { i: -1, at: 0, toggled: false };
  const onTap = (i: number): void => {
    if (state.status !== 'playing') return;
    clearHint();
    const r = Math.floor(i / n);
    const c = i % n;
    const now = performance.now();
    if (lastTap.i === i && now - lastTap.at < DOUBLE_TAP_MS) {
      if (lastTap.toggled) toggleMark(state, r, c); // undo the first tap's mark
      lastTap = { i: -1, at: 0, toggled: false };
      place(r, c);
      return;
    }
    const toggled = toggleMark(state, r, c);
    lastTap = { i, at: now, toggled };
    renderCell(i);
    persist();
  };

  const place = (r: number, c: number): void => {
    const i = r * n + c;
    const result = pick(state, puzzle, r, c);
    renderBoard();
    persist();
    if (result === 'wrong' || result === 'lost') {
      cells[i].classList.add('error');
      window.setTimeout(() => cells[i].classList.remove('error'), 600);
      navigator.vibrate?.(60);
    }
    if (result === 'wrong') {
      message.textContent = S.wrong(state.lives);
      announce(S.wrong(state.lives));
    } else if (result === 'found') {
      message.textContent = S.howTo;
      announce(S.placed);
    } else if (result === 'lost') {
      message.textContent = '';
      finishLost();
    } else if (result === 'won') {
      finishWon();
    }
    renderHintBtn();
  };

  const onKey = (e: KeyboardEvent, i: number): void => {
    const r = Math.floor(i / n);
    const c = i % n;
    const move = (rr: number, cc: number): void => {
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) return;
      cells[i].tabIndex = -1;
      const target = cells[rr * n + cc];
      target.tabIndex = 0;
      target.focus();
    };
    if (e.key === 'ArrowUp') move(r - 1, c);
    else if (e.key === 'ArrowDown') move(r + 1, c);
    else if (e.key === 'ArrowLeft') move(r, c - 1);
    else if (e.key === 'ArrowRight') move(r, c + 1);
    else if (e.key === 'Enter') {
      if (state.status === 'playing') {
        clearHint();
        place(r, c);
      }
    } else if (e.key === ' ' || e.key === 'x' || e.key === 'X') {
      if (state.status === 'playing') {
        clearHint();
        toggleMark(state, r, c);
        renderCell(i);
        persist();
      }
    } else return;
    e.preventDefault();
  };

  /* endings */
  const finishWon = (): void => {
    board.classList.add('won');
    const score = currentScore(state, puzzle);
    const stars = levelStars(state.mistakes, state.hintsUsed);
    const key = String(level);
    const prev = progress.best[key];
    const improved = !prev || score > prev.score;
    if (improved) progress.best[key] = { score, stars: Math.max(stars, prev?.stars ?? 0) };
    const firstTime = level >= progress.next;
    if (firstTime) progress.next = level + 1;
    save('progress', progress);
    // A hint is earned for a level solved for the first time with no mistakes.
    let earned = false;
    if (firstTime && state.mistakes === 0 && wallet.hints < HINTS_MAX) {
      wallet = { hints: wallet.hints + 1 };
      save('wallet', wallet);
      earned = true;
    }
    session = null;
    save('session', null);
    const actions = [
      h('button', { class: 'btn', type: 'button', onclick: () => (closeDialog?.(), openLevel(level + 1, true)) }, S.next),
      h('button', { class: 'btn secondary', type: 'button', onclick: () => showHome() }, S.home),
    ];
    const body: Node[] = [
      h('p', { class: 'bigstars', role: 'img', 'aria-label': S.starsLabel(stars) }, '\u2605'.repeat(stars) + '\u2606'.repeat(3 - stars)),
      h('p', {}, S.wonBody(score, state.mistakes, state.hintsUsed) + (prev && !improved ? ' ' + S.bestStays(prev.score) : '') + (earned ? ' ' + S.hintEarned : '')),
    ];
    window.setTimeout(() => openDialog(S.wonTitle, body, actions), 700);
  };

  const finishLost = (): void => {
    openDialog(
      S.lostTitle,
      [h('p', {}, S.lostBody)],
      [
        h('button', { class: 'btn', type: 'button', onclick: () => (closeDialog?.(), openLevel(level, true)) }, S.tryAgain),
        h('button', { class: 'btn secondary', type: 'button', onclick: () => showHome() }, S.home),
      ],
    );
  };

  const restart = h(
    'button',
    { class: 'btn secondary grow', type: 'button', onclick: () => openLevel(level, true) },
    S.restart,
  );

  closeDialog?.();
  app.replaceChildren(
    h(
      'main',
      {},
      header,
      h('div', { class: 'row spread' }, tracker, lives),
      rules,
      board,
      message,
      h('div', { class: 'row' }, hintBtn, restart),
    ),
  );
  renderBoard();
  renderHintBtn();
  if (state.status === 'lost') finishLost();
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && session) save('session', session);
});

/* Test hook, only with ?debug in the address: lets an automated run read the board. */
if (new URLSearchParams(location.search).has('debug')) {
  (window as unknown as Record<string, unknown>).__pz = {
    level: getLevel,
    packSize: packLevels.length,
    dropSession: () => {
      session = null;
      save('session', null);
    },
    session: () => session,
    progress: () => progress,
    wallet: () => wallet,
  };
}

if (session && session.state.status !== 'won') openLevel(session.level);
else showHome();
