# Constraints: quality bar

## Tests
- Tests are not to be skipped, deleted, or weakened to get a passing build. Do not use `it.skip`, `test.todo` or `xit` as a way around a failure. Do not shrink an assertion, loosen a matcher, or add new lint-suppression comments (`eslint-disable`, `@ts-ignore`, `@ts-expect-error` without a real reason). Fix the code, or fix a wrong test with a justification in the commit or run note.
- Do not bypass the type checker with `any` casts, `as unknown as`, or non-null assertions where a real fix is possible.

## Required test coverage
Vitest tests must cover the diff engine and the other pure modules:
- Identical JSON.
- Added, removed and modified values.
- Nested differences.
- Array changes: added, removed, modified elements, length differences, nested arrays.
- Type changes: string to number, number to boolean, object to array, null to string.
- `1` vs `"1"`, `true` vs `"true"`, null vs missing, `{}` vs null, `[]` vs null.
- Key-order independence and whitespace independence.
- Top-level primitives (root path `$`).
- Special keys (`__proto__`, `constructor`).
- JSONPath formatting for keys with dots, spaces, quotes and leading digits.
- Invalid JSON and empty input, with line and column.
- A large generated document (10k+ nodes): correctness plus a loose time bound, not a strict benchmark.
- Filter and search, the report schema, tree flattening, and the locator, including the fallback to the nearest ancestor.
- UI smoke tests (React Testing Library) for compare flow, invalid input not crashing, filters, and swap.

## Coverage
- `src/lib/json/**`: at least 95% lines and statements, 90% branches. Enforce this with `coverage.thresholds` in the Vitest config.
- Whole project: at least 70% lines. UI glue and shadcn output (`src/components/ui/**`) are excluded.

## Build and lint
- `npm run build` (type check plus Vite build) and `npm run lint` must pass with no errors. TypeScript runs in strict mode.
- No `console.log` left in committed code.

## Privacy and security
- No network requests with user data. No analytics, CDN scripts, or remote fonts. The CSP in `index.html` stays in place, with `connect-src 'none'`.
- No `dangerouslySetInnerHTML`, `eval`, or `new Function`.
- Draft persistence is opt-in only. Never commit secrets.

## Accessibility and UX
- Diff kinds are shown with icon, text label and colour. Never colour alone.
- Interactive elements are keyboard reachable, with visible focus. The tree uses proper ARIA roles.
- Invalid or empty input never crashes the app and always shows a message.
- Large documents: list and tree rendering is virtualised. No unbounded DOM rows.
