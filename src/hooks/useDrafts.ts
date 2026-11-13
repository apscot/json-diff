import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocalStorage } from '@/hooks/useLocalStorage'

/** The opt-in flag. A preference only: it never holds JSON. */
export const DRAFTS_FLAG_KEY = 'saveDrafts'
export const DRAFT_LEFT_KEY = 'draft:left'
export const DRAFT_RIGHT_KEY = 'draft:right'
/** A side larger than this is not saved. */
export const MAX_DRAFT_BYTES = 1024 * 1024
/** Wait for a pause in typing before writing, so large drafts are not rewritten per keystroke. */
export const DRAFT_SAVE_DELAY_MS = 400

export interface Drafts {
  left: string | null
  right: string | null
}

function readItem(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    // Storage unavailable (blocked or disabled).
    return null
  }
}

/** Whether the text is within the size cap (measured in UTF-8 bytes). */
export function isDraftSizeOk(text: string): boolean {
  // A character takes at least one byte, so a longer string is certainly too large.
  if (text.length > MAX_DRAFT_BYTES) return false
  return new TextEncoder().encode(text).length <= MAX_DRAFT_BYTES
}

/** The stored drafts, or nothing when the user has not opted in. Never throws. */
export function readDrafts(): Drafts | null {
  if (readItem(DRAFTS_FLAG_KEY) !== 'true') return null
  return { left: readItem(DRAFT_LEFT_KEY), right: readItem(DRAFT_RIGHT_KEY) }
}

export function clearDrafts(): void {
  try {
    window.localStorage.removeItem(DRAFT_LEFT_KEY)
    window.localStorage.removeItem(DRAFT_RIGHT_KEY)
  } catch {
    // Nothing more can be done if storage is unavailable.
  }
}

export type DraftProblem = 'too-large' | 'storage'

function saveSide(key: string, text: string): DraftProblem | null {
  try {
    if (!isDraftSizeOk(text)) {
      // Do not leave an older, different draft behind.
      window.localStorage.removeItem(key)
      return 'too-large'
    }
    window.localStorage.setItem(key, text)
    return null
  } catch {
    // Quota exceeded or storage disabled.
    return 'storage'
  }
}

function saveDrafts(left: string, right: string): DraftProblem | null {
  const a = saveSide(DRAFT_LEFT_KEY, left)
  const b = saveSide(DRAFT_RIGHT_KEY, right)
  return a === 'storage' || b === 'storage' ? 'storage' : (a ?? b)
}

export interface UseDrafts {
  enabled: boolean
  setEnabled: (value: boolean) => void
  /** Why the last save skipped a side, or null. */
  problem: DraftProblem | null
}

/**
 * Opt-in draft saving. Off by default. While on, each side is stored in localStorage unless it is
 * over 1 MB, and storage errors are caught. Turning it off deletes the stored drafts.
 */
export function useDrafts(leftText: string, rightText: string): UseDrafts {
  const [flag, setFlag] = useLocalStorage<boolean>(DRAFTS_FLAG_KEY, false)
  const enabled = flag === true
  const [problem, setProblem] = useState<DraftProblem | null>(null)
  const latest = useRef({ leftText, rightText })

  useEffect(() => {
    latest.current = { leftText, rightText }
  })

  useEffect(() => {
    if (!enabled) return
    const id = setTimeout(() => setProblem(saveDrafts(leftText, rightText)), DRAFT_SAVE_DELAY_MS)
    return () => clearTimeout(id)
  }, [enabled, leftText, rightText])

  const setEnabled = useCallback(
    (value: boolean) => {
      setFlag(value)
      if (value) {
        setProblem(saveDrafts(latest.current.leftText, latest.current.rightText))
      } else {
        clearDrafts()
        setProblem(null)
      }
    },
    [setFlag],
  )

  return { enabled, setEnabled, problem: enabled ? problem : null }
}
