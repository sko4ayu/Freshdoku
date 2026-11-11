# Build log

Scope of this pass: the vertical slice from `architecture.md` (build order step 1) and most of step 2.

What exists is a web build, not the Expo app. Package installs were unavailable in the build session, so an Expo project could not be created or run. The engine and game logic are plain TypeScript with no browser imports and move into the app unchanged; the screens (`web/src`) have to be rebuilt as React Native components.

| ID | date | status | what is missing | notes |
| --- | --- | --- | --- | --- |
| engine | 2026-11-11 | done | nothing known | rules, logic solver with 5 technique tiers, generator, hints, game state. 16 unit tests pass. |
| levels | 2026-11-11 | done | more packs; hand-checking that the difficulty curve feels right | 60 levels, 5x5 to 10x10, generated in about 1.3 s, each re-verified for one solution and logic solvability. |
| S03 home | 2026-11-11 | partial | daily puzzle entry, event banner, hint and reward counters | play or continue button, solved count, level grid with locked levels. |
| S04 game board | 2026-11-11 | done for the slice | score (decision pending: time is shown), "?" note mark, active-rule highlight, undo, zoom for boards of 9 and up | tap, double tap, keyboard, lives, tracker, auto-marks, timer, restart, saved after every move. |
| S05 hint | 2026-11-11 | partial | rewarded ad when hints run out | highlights the cells and the row, column or area involved, with an explanation. One hint is earned per newly solved level, up to 5. |
| S06 out of lives | 2026-11-11 | done | "watch an ad to continue", if wanted | survives a reload. |
| S07 level complete | 2026-11-11 | partial | real celebration art, double-reward ad button | time, mistakes, next level, home. Placeholder bounce. |
| S14 settings | 2026-11-11 | partial | sound, haptics, language, feedback, privacy, restore purchases | auto-marks and rule strip toggles, progress reset with a second tap to confirm. |
| S01, S02, S08 to S13, S15 | | not started | everything | tutorial, ads, daily, leaderboard, events, rewards, paywall, support. |

## Checks run

- `bun test packages/engine`: 16 pass.
- `tsc -p .`: no errors.
- `bun tools/check-web.ts`: 34 of 34. Real mouse and key events in headless Chrome: mark, unmark, wrong placement, correct placement, reload restore, hint, win, next level, loss, loss after reload, try again, keyboard-only win, a 9x9 board, 390px and 1440px widths, no console errors.
- Contrast: 31 pairs, 0 AA failures.
- Parity (`parity.py`): 65.0, must-haves 12 of 14.

Not checked: a real phone or touch screen, screen readers, Safari and Firefox, how the double-tap timing (300 ms) feels in the hand, whether the difficulty grades match how hard levels feel to a person.

## Harder or different than expected

- Random region maps rarely have one solution. The generator repairs them: it finds a second solution and hands one of its cells to a neighbouring region, repeating until only the intended solution is left. This worked on every attempt in testing, including 10x10.
- Tier-1-only puzzles do not exist without pre-placed pieces or single-cell regions, so the first levels use tier 2 ("this cell would block that row").
- The white-on-colour marks of the original could not be reused: they fail contrast. Marks are dark, and the game's own marks are drawn smaller than the player's.
- The two must-haves still open are the tutorial and offline play in a real app.

## Definition of done, S04

- [x] states: fresh, in progress, mistake, hint, won, lost, restored
- [x] 390px and 1440px
- [x] keyboard only can finish a level
- [x] no console errors
- [x] no copy from the original
- [x] features.csv updated
- [x] screenshots in `docs/screens/`
- [ ] empty, loading and error states: not applicable yet, nothing loads from a server

## Changes, 2026-11-11 (owner feedback after playing)

1. **No automatic marks.** The game no longer marks the cells a found piece rules out. It remains as "Easy mode" in settings, off by default. A wrong pick still leaves a small mark on that cell.
2. **No region outlines.** Kinds are told apart by colour only. An "outlines" setting (off by default) brings the lines back for players who cannot tell the colours apart.
3. **Theme: fruit and vegetables.** Each colour is a kind (tomato, lemon, apple, peas, blueberry, eggplant, strawberry, potato, mushroom, pear, grapes, carrot). One cell of each kind is good, the rest are wormy. The tracker shows one icon per kind and each lights up when its good one is found. The player's mark is a worm. Icons are simple SVG shapes drawn for this build (`web/src/icons.ts`); final art replaces them later.
4. **Many levels.** `curve.ts` maps any level number to a board size and technique tier, and `generateLevel(n)` uses the level number as the seed. 1,000 levels are bundled (278 KB, generated and re-verified in about 78 s); past that, levels are generated on the device, so there is no last level and level N is the same board for every player. The home screen pages through levels 60 at a time.

Checks after the changes: 17 unit tests pass, type check clean, browser play-through passes (count in the summary line of `bun tools/check-web.ts`).

Open points: generating a level on the device took up to about 1.2 s on the build machine and will be slower on a phone; only the first 60 levels have a hand-shaped curve, the rest repeat a ten-level cycle; colour-only regions are harder for colour-blind players unless they turn outlines on.
