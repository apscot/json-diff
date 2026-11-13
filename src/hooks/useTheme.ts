import { useCallback, useEffect } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

export type Theme = 'dark' | 'light'

// Must match public/theme-init.js: key "theme", class "dark", dark by default.
export const THEME_KEY = 'theme'

export function useTheme() {
  const [stored, setStored] = useLocalStorage<Theme>(THEME_KEY, 'dark')
  const theme: Theme = stored === 'light' ? 'light' : 'dark'

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('dark', theme === 'dark')
    root.style.colorScheme = theme
  }, [theme])

  const toggle = useCallback(() => {
    setStored((prev) => (prev === 'light' ? 'dark' : 'light'))
  }, [setStored])

  return { theme, isDark: theme === 'dark', setTheme: setStored, toggle }
}
