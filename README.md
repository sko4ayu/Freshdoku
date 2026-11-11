# Freshdoku

A logic puzzle. Each colour is a kind of fruit or vegetable; one of each kind is good and the rest are wormy. Find the good ones: one in every row, one in every column, one of every kind, and no two touching.

```
packages/engine/   rules, logic solver, generator, hints, game state (TypeScript, no UI)
levels/            bundled level pack (a cache of generateLevel(1..1000))
web/               the game (web/dist/index.html is one self-contained file, built)
tools/             generate-levels, build-tokens, build-web, check-web
docs/              plan, project status, design tokens, build log, screenshots
```

Commands (need Bun; `check-web` also needs Chrome):

```
bun test packages/engine           # unit tests
bun tools/generate-levels.ts 1000  # rebuild levels/pack-001.json
bun tools/build-tokens.ts          # tokens.json -> tokens.css, theme.ts
bun tools/build-web.ts             # -> web/dist/index.html
bun tools/check-web.ts             # plays the game in headless Chrome, saves screenshots
```

Open `web/dist/index.html` in a browser to play. Add `?debug` to expose a test hook.

Project plan and status: `docs/PLAN.md`, `PROJECT_STATUS.md`.
