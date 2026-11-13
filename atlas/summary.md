# Summary: JSON Diff

## What was built
A browser-only JSON diff and API response comparator (React 19 + TypeScript strict + Vite 8 + Tailwind v4 + shadcn/ui + Lucide, CodeMirror 6 editors). No backend, no network calls, no account. The CSP blocks `connect-src`.

- **Two editors** (Original / Modified): line numbers, syntax highlighting, copy, clear, format (configurable indent), minify, validate (line/column errors), `.json` upload, sample data on first load.
- **Own diff engine** (`src/lib/json/diff.ts`): pure and recursive. Kinds are added, removed, modified and type-changed, with disjoint counts. Arrays compare by index. Key order is ignored. Null vs missing is added/removed. A container type change is one difference with no children.
- **Results:** summary cards (total, added, removed, modified, type changes), virtualised side-by-side diff list with JSONPath, kind filters, search (name, path, value), and a collapsible tree (expand all, collapse all, changed-only, keyboard navigation).
- **Click navigation:** selecting a difference highlights it in the tree and in both editors. Added and removed paths fall back to the nearest ancestor.
- **Utilities:** swap, format both, clear one or both, download JSON diff report, light/dark theme (dark default), opt-in draft recovery in localStorage, shortcuts popover, limitations popover.
- **Shortcuts:** Cmd/Ctrl+Enter compare, Cmd/Ctrl+Shift+F format both, Cmd/Ctrl+Shift+X swap.

All 13 backlog tasks are complete. None are marked failed.

## Commands
```
npm install
npm run build          # tsc -b && vite build
npm run dev            # http://localhost:5173 (strictPort)
npm run preview        # http://localhost:4173 (strictPort), after build
npm run lint
npm test
npm run test:coverage
```
Requires Node >= 22.12.

## Verified in the finalization stage
- `npm run build`: exit 0. It warns that the main chunk is about 896 kB.
- `npm run lint`: 0 errors, 2 warnings. Both are React Compiler "incompatible library" notices for TanStack Virtual.
- `npm test`: 18 files, 275 tests passed.
- `npm run test:coverage`: exit 0, so the configured coverage thresholds pass.
- I did not start the app or check the UI in a browser in this stage.

## Known limitations
- Numbers are 64-bit floats. Integers above 2^53−1 lose precision, and `1.0` equals `1`.
- Duplicate keys: the last one wins, with no warning.
- Arrays compare by index only. There is no id matching or move detection, so an insertion near the start shifts everything after it.
- Parsing and diffing run on the main thread. Uploads over 20 MB are refused, and very deep nesting is rejected with an error.
- The JS bundle is a single chunk of about 896 kB, with no code splitting.
- `JsonPathDisplay.tsx` has low test coverage (about 44%).
- The final commit includes `vite.config.ts` changes that fix the dev port at 5173 and the preview port at 4173, bound to all interfaces with `strictPort`.
