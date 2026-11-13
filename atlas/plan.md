# Plan: fix `npm run dev` failing with unresolved imports

## Diagnosis
`vite.config.ts` imports `@tailwindcss/vite`, `@vitejs/plugin-react` and `vitest/config`. All three are already declared in `package.json` devDependencies and are in `package-lock.json`. The error is `ERR_MODULE_NOT_FOUND` for all of them, so the packages are not in `node_modules/`. `node_modules/` is git-ignored, so the checkout on the user's machine never had `npm install` run, or the install failed or was partial. The config and the dependency list are correct, so no application code needs to change.

## Assumptions
- The user's Node may be older than the required 22.12 (the `engines` field only warns by default). That would make the install fail or end up partial.
- No code or dependency changes are wanted. The fix is the install step, made easier to find.

## Fix for the user
1. Check `node -v` is >= 22.12.
2. From the project root run `npm install`. If that still fails, run `rm -rf node_modules && npm ci`.
3. Run `npm run dev`.

## Change in the repo
- `AGENTS.md` now says to run `npm install` first and describes this error.
- One small docs task adds a Troubleshooting section to `README.md` with the same steps. It does not touch `vite.config.ts`, `package.json` or any source.
