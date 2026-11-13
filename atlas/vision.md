# Vision: JSON Diff — JSON Diff & API Response Comparator

## Problem
Backend developers often need to know what changed between two JSON documents. Typical cases are the same endpoint in staging and production, a response before and after a deploy, or an expected payload against an actual one. A plain text diff is noisy for this. Key reordering, whitespace and indentation show up as changes, and the output doesn't say whether a value changed or its type did. Many online JSON diff tools ask users to paste data, which may contain tokens or personal data, into a site that may upload it.

## Core value proposition
Paste two JSON documents, press Compare, and see within seconds exactly what changed. Each change shows its JSONPath, the old and new value, and its kind: added, removed, modified or type-changed. The comparison is structural, so key order and formatting are ignored. It runs entirely in the browser, so no JSON leaves the user's machine. No account is needed.

It should feel like a daily-use developer tool (compact, dark by default, monospace) and not like a marketing page.

## Target user
Backend and full-stack developers, QA engineers and API integrators. They debug API responses, check payloads against expectations, compare environments and investigate regressions. They are comfortable with JSON and JSONPath, work with large documents, and care about privacy and speed.

## Capabilities this build needs
1. **Two-sided JSON input with validation.** Original and Modified editors with line numbers, syntax highlighting, and sample data on first load. Each has copy, clear, format, minify and file-upload actions. Invalid or empty input gives a clear message with line and column and never crashes the app.
2. **Correct structural comparison.** A pure comparison step that reports added, removed, modified and type-changed differences, each with a JSONPath. It handles nested objects and arrays and is key-order independent. It distinguishes `1` from `"1"`, `null` from a missing key, and `{}` or `[]` from `null`. Arrays are compared by index, and the UI says so. This is the highest-priority capability, and it needs thorough automated tests, including a large generated document.
3. **Results dashboard.** Summary counts (total, added, removed, modified, type changes) and a side-by-side diff list. Each row shows path, original value, modified value and kind. Kinds are shown with colour, a text label and an icon together. A collapsible tree view has expand all, collapse all and a changed-only option.
4. **Filtering, search and navigation.** Filter by kind and search by property name, path or value, with instant updates. Clicking a difference highlights or navigates to the matching node in the results (in the editors if feasible).
5. **Workflow utilities.** Swap inputs, clear one or both, format both, and download a JSON diff report (summary plus a list of type, path, original and modified). Keyboard shortcuts for Compare (Ctrl/Cmd+Enter), Format both (Ctrl/Cmd+Shift+F) and Swap (Ctrl/Cmd+Shift+X).
6. **Developer-tool experience.** Dark theme by default with a light option, and a responsive layout for desktop, tablet and mobile. The header shows the tagline and a "100% Local Processing" indicator. User preferences persist. Saving drafts is optional and signposted, since pasted JSON may be sensitive. Large documents stay usable (debounced work, a loading indicator only when needed, no UI freeze from rendering thousands of rows).

## Assumptions
- The summary counts are disjoint, and total equals added plus removed plus modified plus type-changed. "Modified" means the same type with a different value.
- A type change at a container level (for example object to array) is reported once at that path, without listing its children.
- Null versus a missing key is reported as added or removed, not as modified.
- Top-level primitives are valid documents, and the root path is `$`.
- Known limitations are documented in the UI or README. Numbers beyond double precision lose precision in native parsing. Duplicate keys resolve to the last value.
- Constraints already set by the user (browser-only, no backend, React/TypeScript/Vite/Tailwind/shadcn/Vitest) are inputs for the Architect. They are not decisions made here.

## Out of scope (first build)
- Authentication, accounts, databases, subscriptions, AI features, any backend or network service, and analytics or third-party scripts.
- Smart array matching (by key or ID, LCS, or set semantics). Arrays are by index only.
- Text-level diffs, semantic number comparison (such as `1.0` against `1`, or big-integer-safe parsing), and JSON Patch (RFC 6902) output.
- Fetching URLs or making API requests as Postman does. Input is paste or file upload only.
- Sharing links, saved comparison history, multi-document comparison, and other formats (YAML, XML).

## Definition of done
A developer can paste two API responses and click Compare. They immediately see what changed, can navigate and filter differences by JSONPath and kind, and can export a report. Everything works without an account, and the comparison engine's tests pass.
