# Tasks: JSON Diff

Complexity is medium and the architecture suggests 12–18 tasks. This plan has 13. The pure core (types, parse, diff, result-side modules) is built and tested first. The UI is layered on top in the order a user meets it. Each task leaves the app building and working.

## Ordered backlog

1. **Scaffold project** (Vite, React, strict TS, Tailwind v4, shadcn, Vitest, CSP, theme tokens). Files: config files, `index.html`, `public/theme-init.js`, `src/index.css`, `src/components/ui/`. Done when build, lint and test pass and the dev server shows a dark page.
2. **Core types, JSONPath formatting, parse/format/minify.** Files: `src/lib/json/{types,jsonType,path,parse}.ts` plus tests. Done when tests cover path escaping, line/column errors, empty input and primitives.
3. **Diff engine with full tests.** Files: `diff.ts`, `diff.test.ts`, `src/test/fixtures.ts`. Done when every case in `CONSTRAINTS.md` for the engine passes, including a 10k+ node document. Depends on 2.
4. **Result-side pure modules.** Files: `filter`, `display`, `report`, `tree`, `locate`, `sample` and their tests, plus coverage thresholds in `vite.config.ts`. Done when tests and `npm run coverage` pass. Depends on 3.
5. **Hooks and Header.** Files: `useLocalStorage`, `useTheme`, `useDebouncedValue`, `useShortcuts`, `Header.tsx`. Done when the theme toggle persists across reload. Depends on 1.
6. **JsonEditor, EditorToolbar, ValidationMessage, Workspace.** Done when both editors show sample data and copy, clear, format, minify, upload and the indent select work, and invalid JSON shows line and column. Depends on 2, 4 and 5.
7. **Compare flow.** Files: `useCompare`, `CompareButton`, `ActionBar`, plus shortcut wiring. Done when Compare or Ctrl/Cmd+Enter gives a result for the samples, and swap, format both and clear both work. Depends on 6.
8. **Results dashboard.** Files: `DiffKindBadge`, `JsonPathDisplay`, `DiffSummary`, `DiffFilters`, `DiffViewer`, `ResultsPanel`, `ErrorBoundary`. Done when summary counts match and filters and search update instantly with a bounded DOM. Depends on 4 and 7.
9. **Tree view.** File: `DiffTree.tsx`. Done when the Tree tab supports expand all, collapse all, changed-only and keyboard navigation. Depends on 8.
10. **Click navigation.** Done when clicking a difference highlights it in the tree and in both editors, with the ancestor fallback for added and removed paths. Depends on 9.
11. **Download report and utility completion.** Done when a report with the documented schema downloads after Compare. Depends on 10.
12. **Responsive layout, accessibility, popovers, opt-in drafts.** Done when build, lint, test and coverage pass at the thresholds. Depends on 11.
13. **README (docs).** Usage, how comparison works, shortcuts, privacy, limitations. Depends on 12.

## Plan

### What ships first and why
Tasks 1–4 ship no visible product but carry almost all of the correctness risk. The diff engine, path formatting, parser and locator have no React in them. Fixing them first means every UI task builds on a tested foundation. Task 5 (hooks and Header) only needs the scaffold, so it can be built beside tasks 2–4 where files do not overlap. The first user-visible milestone is task 7, where pasting JSON and pressing Compare produces a result. Task 8 turns that into the dashboard the Definition of Done describes.

### Dependencies the developer must respect
- Only `parse.ts` calls `JSON.parse`. Only `path.ts` builds path strings. Only `DiffKindBadge` maps a kind to colour, icon and label. Only `report.ts` defines the report schema.
- Counts are disjoint, and total equals added plus removed plus modified plus type-changed.
- A whole added or removed subtree is reported once, at its root. A container type change is reported once, at its own path. Null against a missing key is added or removed.
- Absent values are omitted properties, never `undefined` or `null`, in diffs and in the report.
- Keep the CSP with `connect-src 'none'`. Add no `fetch`, `eval`, `dangerouslySetInnerHTML` or console logging.
- Do not skip or weaken tests. Do not use `any` casts.
- Several tasks edit `App.tsx` (5, 6, 7, 8, 10, 12). They are ordered, not parallel, for that reason.

### Main risk for each early task
- **1 Scaffold:** version drift between Vite 8, Vitest 5, Tailwind 4 and shadcn. Node must be 22.12 or newer. Pin to what installs cleanly and trust the lockfile. The shadcn CLI may need network access, so fall back to hand-copying the components if it fails.
- **2 Parse:** line and column for syntax errors differ between engines. Use the message position where present, and a small own scanner as the consistent fallback.
- **3 Diff:** subtle classification errors (null against missing, `{}` against null, `-0`, `__proto__` keys, ordering, no children under a container type change). Mitigate with table-driven tests that assert exact path, kind and omitted fields.
- **4 Result modules:** the locator is a hand-written scanner and can drift from `path.ts`. Test it against strings produced by `formatPath`, including quoted keys and nested arrays, and test the ancestor fallback. The coverage thresholds will fail the build, so write the tests alongside the code.
- **5 Hooks and Header:** theme flash or a mismatch between `theme-init.js` and `useTheme`. Both must read the same storage key and class name.
- **6 Editor:** CodeMirror swallows the shortcut keys, and its theme must follow the app theme. Use keymap entries with `preventDefault`, and reconfigure through a compartment. jsdom has no layout, so keep the editor tests shallow.
- **7 Compare flow:** the loading indicator flickering on fast comparisons, and stale results when text changes. Delay the flag by about 150 ms, and mark results as stale after an edit.
- **8 Results dashboard:** virtualisation in jsdom measures zero heights. Provide a fixed estimate size, and in tests mock the element size.
- **9 Tree:** expanded-state bookkeeping and keyboard focus inside a virtualised list. Keep expansion in a `Set` of ids and drive focus from the row index.
- **10 Navigation:** the selection must stay in sync across three places (list, tree, editors). Keep a single `selectedPath` in `App`, and run the locator only on click.
