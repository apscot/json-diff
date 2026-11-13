import { useEffect, useMemo, useRef } from 'react'

export interface ShortcutHandlers {
  /** Mod+Enter */
  onCompare: () => void
  /** Mod+Shift+F */
  onFormat: () => void
  /** Mod+Shift+X */
  onSwap: () => void
}

/** Structurally compatible with CodeMirror's `KeyBinding`. */
export interface ShortcutKeyBinding {
  key: string
  preventDefault: true
  run: () => boolean
}

function matchShortcut(event: KeyboardEvent): keyof ShortcutHandlers | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return null
  const key = event.key.toLowerCase()
  if (key === 'enter' && !event.shiftKey) return 'onCompare'
  if (key === 'f' && event.shiftKey) return 'onFormat'
  if (key === 'x' && event.shiftKey) return 'onSwap'
  return null
}

/**
 * Registers Mod+Enter, Mod+Shift+F and Mod+Shift+X on window (with
 * preventDefault). `keymap` exposes the same handlers as CodeMirror key
 * bindings, since CodeMirror would otherwise swallow these keys.
 */
export function useShortcuts(handlers: ShortcutHandlers): {
  keymap: ShortcutKeyBinding[]
} {
  const ref = useRef(handlers)
  useEffect(() => {
    ref.current = handlers
  })

  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      const name = matchShortcut(event)
      if (name === null) return
      event.preventDefault()
      if (!event.repeat) ref.current[name]()
    }
    window.addEventListener('keydown', listener)
    return () => window.removeEventListener('keydown', listener)
  }, [])

  const keymap = useMemo<ShortcutKeyBinding[]>(() => {
    const bind = (key: string, name: keyof ShortcutHandlers): ShortcutKeyBinding => ({
      key,
      preventDefault: true,
      run: () => {
        ref.current[name]()
        return true
      },
    })
    return [
      bind('Mod-Enter', 'onCompare'),
      bind('Mod-Shift-f', 'onFormat'),
      bind('Mod-Shift-x', 'onSwap'),
    ]
  }, [])

  return { keymap }
}
