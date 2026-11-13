# AGENTS.md — JSON Diff

Browser-only JSON diff tool. No backend, no network calls, no accounts. Full design: `atlas/architecture.md`. Quality bar: `atlas/CONSTRAINTS.md`. Product intent: `atlas/vision.md`.

## Stack
- Node >= 22.12, npm
- React ^19.3, TypeScript (strict, as scaffolded by create-vite), Vite ^8.3, `@vitejs/plugin-react` ^6.3
- Tailwind CSS v4 (`@tailwindcss/vite`, no tailwind.config), shadcn/ui (generated in `src/components/ui`), `lucide-react`
- CodeMirror 6 (`@uiw/react-codemirror`, `@codemirror/lang-json`), `@tanstack/react-virtual`
- Vitest ^5.1 + `@vitest/coverage-v8`, jsdom, `@testing-library/react`
- Own diff engine (no diff library)

## Commands
```
npm install
npm run dev            # Vite dev server
npm run build          # tsc -b && vite build
npm run preview        # serve the production build
npm run lint           # ESLint
npm test               # vitest run
npm run test:coverage  # vitest run --coverage
```
Run `npm install` first in a fresh checkout. `node_modules/` is git-ignored, so "Cannot find package '@tailwindcss/vite' / '@vitejs/plugin-react' / 'vitest'" from `vite.config.ts` means dependencies are not installed (all three are in `package.json` devDependencies). If it persists, check `node -v` (>= 22.12), then `rm -rf node_modules && npm ci`.

`dev`, `build`, `preview` and `lint` come from the create-vite template. Add `test` (`vitest run`) and `test:coverage` (`vitest run --coverage`) if missing. Do not invent other scripts.

## Where things live
- `src/lib/json/` — pure logic, no React or DOM: `diff.ts`, `path.ts`, `parse.ts`, `locate.ts`, `tree.ts`, `filter.ts`, `report.ts`, `display.ts`, `sample.ts`, `types.ts`. Tests sit next to the code as `*.test.ts`.
- `src/hooks/` — `useCompare`, `useTheme`, `useLocalStorage`, `useDebouncedValue`, `useShortcuts`.
- `src/components/` — presentational components. `src/components/ui/` is shadcn output.
- `src/App.tsx` — the only owner of app state.
- `src/test/` — test setup and fixture generators.
- `public/theme-init.js` — sets the theme before first paint (external, so the CSP stays strict).

## Conventions
- **Diff semantics.**
  - Kinds: `added | removed | modified | type-changed`.
  - Counts are disjoint: total = added + removed + modified + typeChanged.
  - A container type change is one difference at its path, with no children.
  - An added or removed subtree is one difference at its root.
  - Null vs a missing key is added or removed.
  - Arrays compare by index.
  - Object key order is ignored.
- **Absent values.** For `added`/`removed`, the missing side's property is omitted. It is never `undefined`-assigned and never `null`.
- **Single homes.**
  - `JSON.parse` is only called in `parse.ts`.
  - Path strings are only built in `path.ts`.
  - Kind to colour, icon and label mapping lives only in `DiffKindBadge`.
  - The report schema lives only in `report.ts`.
- Kinds are always shown as icon + text + colour, never colour alone.
- Pure modules in `lib/json` must not import React, DOM, or `localStorage`.
- Use `Object.prototype.hasOwnProperty.call` or `Object.keys` for JSON objects. Never write arbitrary JSON keys onto plain objects.
- Never use `dangerouslySetInnerHTML`, `eval`, `fetch`, or XHR. Never send user JSON anywhere. No third-party scripts, fonts or analytics.
- Draft saving to `localStorage` is opt-in and size-capped. Preferences must not contain JSON.
- Use the `@/` import alias for `src/`.
- Prefer small components with props. Do not add state libraries, routers, or abstractions for array-matching strategies. Those are explicitly rejected in the architecture.
- Mermaid labels with special characters must be in double quotes.

## Testing
Vitest, colocated `*.test.ts(x)`. The diff engine, path, parse, locate, tree, filter and report modules must be tested thoroughly. Large-document tests use generated fixtures (`src/test/fixtures.ts`) and assert correctness with only a loose time bound.
