# JSON Diff

JSON Diff is a browser-only tool for comparing two JSON documents. You paste or upload an *Original* and a *Modified* document, press Compare, and get a structural list of what was added, removed or changed, each with its JSONPath. There is no backend, no account and no network call: your JSON never leaves the browser.

## Built by Atlas Studio

This application was built by **Atlas Studio**. The project was created on 2026-11-13. Its planning and build records are in the `atlas/` folder:

- `atlas/vision.md`: problem, target user, scope and definition of done.
- `atlas/architecture.md`: design of the diff engine, components and state.
- `atlas/CONSTRAINTS.md`: quality bar the code is held to.
- `atlas/plan.md`, `atlas/tasks.md`: the build plan and task backlog.
- `atlas/research.md`: background research.
- `atlas/summary.md`: what was built, verification results and known limitations.
- `atlas/run-reports/`: build run logs.

Features:

- Two CodeMirror editors with JSON highlighting, line numbers, live validation (with line and column), format, minify, copy, clear and `.json` upload (up to 20 MB).
- Structural comparison with four difference kinds, shown as a summary, a virtualised list and a virtualised tree.
- Filter by kind and search by property name, path or value.
- Click a difference to jump to it in both editors.
- Download the full result as a JSON report.
- Dark and light themes. Optional auto-compare.

## Requirements

Node >= 22.12 and npm.

## Getting started

```sh
npm install
npm run dev            # Vite dev server
npm run build          # type-check (tsc -b) and production build
npm run preview        # serve the production build
npm run lint           # ESLint
npm test               # run the tests once (vitest run)
npm run test:coverage  # tests with coverage (vitest run --coverage)
```

`npm run test:coverage` writes an HTML report to `coverage/` and enforces thresholds from `vite.config.ts`: 70% line coverage overall, and 95% lines and statements and 90% branches for `src/lib/json/**`.

## Troubleshooting

**`Cannot find package '@tailwindcss/vite'` (or `@vitejs/plugin-react`, or `vitest/config`) imported from `vite.config.ts`**

`vite.config.ts` imports these packages, and they are listed in `package.json`. This error means the dependencies are not installed in `node_modules`. You don't need to change `vite.config.ts`, `package.json` or any source code. `npm run dev` and `npm run build` now run `scripts/ensure-deps.mjs` first, which installs missing dependencies automatically. If you still see the error, do this:

1. Check your Node version with `node -v`. It must be 22.12 or newer (the `engines` field in `package.json` requires `>=22.12`).
2. Run `npm install` in the project root (the folder that contains `package.json`).
3. If the error persists, do a clean install from the lockfile: `rm -rf node_modules && npm ci`.
4. Start the app again with `npm run dev`.

## Using it

1. Paste JSON into both panels, or use **Upload**. The panels start with a small sample.
2. Press **Compare** (or `Ctrl/⌘+Enter`). Results appear below the editors.
3. Switch between the **List** and **Tree** tabs. Use the kind filter and the search box to narrow the differences.
4. Click a row (or focus it and press Enter) to scroll both editors to that location and highlight it. If one side has no node at that path (an added or removed value), the nearest existing parent is highlighted.
5. **Download report** saves the full difference list as a file named like `json-diff-report-20260102-030405.json`.

Other controls: **Swap** exchanges the two sides, **Format both** pretty-prints both (using the chosen indent: 2 spaces, 4 spaces or tab), **Clear original / modified / both**, and an **Auto-compare** switch that recompares 500 ms after the last edit (off by default). Format and Minify never change invalid input; the error is shown instead. The Tree tab has **Expand all**, **Collapse all** and a **Changed only** switch.

Empty input and invalid JSON are reported instead of compared. When both documents are invalid, both errors are shown at once.

## How comparison works

The comparison is a structural walk over the two parsed values. It does not compare text, so whitespace and formatting never matter.

### Difference kinds

| Kind | Meaning |
|---|---|
| `added` | The path exists only in the Modified document. |
| `removed` | The path exists only in the Original document. |
| `modified` | Both sides have a value of the same JSON type, and the values differ. Only primitives (string, number, boolean, null) can be `modified`. |
| `type-changed` | Both sides have a value, but the JSON types differ (`object`, `array`, `string`, `number`, `boolean`, `null`). |

### Rules

- **Counts are disjoint.** Every difference has exactly one kind, so `total = added + removed + modified + typeChanged`.
- **Arrays compare by index.** Item `i` on the left is compared with item `i` on the right. Extra trailing items are `added` or `removed`. A note in the results says so.
- **Object key order is ignored.** `{"a":1,"b":2}` equals `{"b":2,"a":1}`.
- **A container type change is reported once.** If a value changes between object, array or a primitive (for example `{"a":1}` becomes `[1]`), you get one `type-changed` at that path, with no child differences.
- **An added or removed subtree is reported once**, at its root path, not once per child.
- **`null` is not the same as a missing key.** `{"a":null}` against `{}` is `removed` at `$.a`, and the reverse is `added`. `null` against a string is `type-changed`.
- `-0` and `0` are equal.
- Output order is deterministic: document order, with keys that exist only in the Modified document after the Original's keys at each level.

### Paths

Paths are JSONPath-style strings. The root is `$`. A key that looks like an identifier (`[A-Za-z_$][A-Za-z0-9_$]*`) is written `.key`. Any other key is written `['…']`, with `\` and `'` escaped. Array items are `[n]`. For example: `$.user.items[2]['a.b']`.

## Report schema

**Download report** produces a pretty-printed JSON file. It always contains every difference, not only the filtered view.

```json
{
  "tool": "JSON Diff",
  "generatedAt": "2026-01-02T03:04:05.000Z",
  "arrayComparison": "by-index",
  "summary": { "total": 3, "added": 1, "removed": 0, "modified": 1, "typeChanged": 1 },
  "differences": [
    { "type": "modified", "path": "$.user.age", "original": 25, "modified": 26 }
  ]
}
```

| Field | Notes |
|---|---|
| `tool` | Always `"JSON Diff"`. |
| `generatedAt` | ISO 8601 timestamp (UTC). |
| `arrayComparison` | Always `"by-index"`. |
| `summary` | `total`, `added`, `removed`, `modified`, `typeChanged`. `total` is the sum of the other four. |
| `differences[].type` | `added`, `removed`, `modified` or `type-changed`. |
| `differences[].path` | The JSONPath of the difference. |
| `differences[].original` | The Original value. **Omitted** (the property is absent) for `added`. |
| `differences[].modified` | The Modified value. **Omitted** for `removed`. |

A missing value is an absent property, never `null`, so it cannot be confused with a real JSON `null`. For example, a key whose value is `null` on the Original side and absent on the Modified side is `{ "type": "removed", "path": "$.a", "original": null }`.

## Keyboard shortcuts

`Mod` is `Ctrl` on Windows and Linux and `⌘` on macOS.

| Shortcut | Action |
|---|---|
| `Mod+Enter` | Compare |
| `Mod+Shift+F` | Format both |
| `Mod+Shift+X` | Swap sides |

They also work while an editor has focus. The keyboard icon in the header lists them in the app.

In the results list and tree, rows are focusable and `Enter` selects the row. In the tree, which follows the ARIA tree pattern, you can also use `↑` `↓` to move, `Home` and `End` to jump to the first or last row, `→` to expand (or move to the first child) and `←` to collapse (or move to the parent).

## Privacy

- **No network.** The app makes no requests with your data and uses no analytics, third-party scripts, fonts or CDNs. Parsing, comparison and the report download all run locally. The report is created from a local `Blob`.
- **Content Security Policy.** `index.html` sets a CSP: `default-src 'self'`, `script-src 'self'`, `connect-src 'none'`, `object-src 'none'`, `base-uri 'none'`. `connect-src 'none'` blocks `fetch` and XHR, and scripts can only load from the app's own origin. The pre-paint theme script is an external file (`public/theme-init.js`), so inline scripts stay blocked. Inline styles are allowed (`style-src 'unsafe-inline'`).
- **Drafts are opt-in.** By default nothing you type is stored. If you turn on **Save drafts in this browser**, each side is saved to `localStorage` unencrypted and restored on your next visit. A side larger than 1 MB is not saved. Turning the switch off deletes the stored drafts.
- **Preferences hold no JSON.** Only settings are stored: theme, indent, and the drafts flag.

Treat the CSP and the opt-in as defence in depth: the CSP is a meta tag in the built page. If you host the app yourself, also set equivalent headers on your server.

## Project structure

```
index.html                 CSP meta tag; loads /theme-init.js
public/theme-init.js       sets the theme before first paint (external, keeps the CSP strict)
src/
  main.tsx, App.tsx        App owns all application state
  lib/json/                pure logic: no React, no DOM, no localStorage
    types.ts               JsonValue, Difference, DiffResult, DiffSummary, ...
    jsonType.ts            getJsonType
    path.ts                the only place JSONPath strings are built
    parse.ts               the only place JSON.parse is called; format, minify, error line/column
    diff.ts                compare(original, modified)
    locate.ts              path -> text range in an editor
    tree.ts                merged tree model and flattening for the tree view
    filter.ts              filter by kind and query
    display.ts             value previews for rows
    report.ts              the report schema, file name, download
    sample.ts              the sample documents
  hooks/                   useCompare, useTheme, useLocalStorage, useDebouncedValue,
                           useShortcuts, useDrafts
  components/              presentational components; ui/ is generated shadcn/ui
  test/                    test setup and large-document fixture generators
atlas/                     vision, architecture, constraints and task notes
```

Tests sit next to the code as `*.test.ts` and `*.test.tsx`. Stack: React 19, TypeScript (strict), Vite, Tailwind CSS v4, shadcn/ui, lucide-react, CodeMirror 6, `@tanstack/react-virtual`, and Vitest with Testing Library. The diff engine is written in-house; there is no diff library. See `atlas/architecture.md` for design decisions and `AGENTS.md` for conventions.

## Known limitations

These are also summarised in the **Limitations** popover (ⓘ) in the app header.

- **Number precision.** Numbers are parsed by `JSON.parse` as 64-bit floats. Integers beyond `9007199254740991` (2^53 − 1) lose precision, so two different large integers can look equal, and a very long decimal may compare equal to a shorter one.
- **`1.0` vs `1`.** These are the same number once parsed, so they are not reported as a difference. Likewise `1e2` and `100`. Differences in number formatting are invisible.
- **Duplicate keys.** If an object repeats a key, the last occurrence wins and the earlier values are ignored. No warning is shown.
- **Arrays compare by index.** Inserting or removing an item near the start of an array shifts every later index, so many items may be reported as `modified` (or as a long run of changes) even though only one item moved.
- **No smart array matching.** There is no matching by id or key, no move detection and no choice of strategy. This is deliberate and out of scope for now.
- **Everything runs on the main thread.** Parsing and comparison of very large documents can briefly block the page. Results are virtualised so large result lists stay responsive. Uploads over 20 MB are refused. Extremely deeply nested documents may fail with "Document is too deeply nested to compare".
- **Key order is ignored**, so a pure re-ordering of keys is never reported.
