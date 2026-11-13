// Installs dependencies automatically when required packages are missing,
// so `npm run dev` / `npm run build` don't fail with ERR_MODULE_NOT_FOUND.
import { existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const required = ['@tailwindcss/vite', '@vitejs/plugin-react', 'vitest', 'vite']
const missing = required.filter((p) => !existsSync(new URL(`../node_modules/${p}/package.json`, import.meta.url)))

if (missing.length > 0) {
  console.log(`Missing dependencies (${missing.join(', ')}). Running npm install...`)
  const r = spawnSync('npm', ['install'], { stdio: 'inherit', shell: process.platform === 'win32' })
  if (r.status !== 0) process.exit(r.status ?? 1)
}
