import { useCallback, useEffect, useRef, useState } from 'react'
import { compare } from '@/lib/json/diff'
import { parseJson, type ParseError, type ParseResult } from '@/lib/json/parse'
import type { DiffResult, JsonValue } from '@/lib/json/types'

/** The loading flag is raised only when the work takes longer than this. */
export const LOADING_DELAY_MS = 150
/** Auto-compare waits this long after the last edit. */
export const AUTO_COMPARE_DEBOUNCE_MS = 500
export const TOO_DEEP_MESSAGE = 'Document is too deeply nested to compare'

type SyntaxError = Extract<ParseError, { kind: 'syntax' }>

export type CompareOutcome =
  | { status: 'idle' }
  /** One or both inputs are blank. `message` is neutral, not an error. */
  | { status: 'empty'; message: string }
  /** One or both inputs are not valid JSON; both errors are reported at once. */
  | { status: 'invalid'; left: SyntaxError | null; right: SyntaxError | null }
  /** The comparison itself failed (e.g. nesting too deep). */
  | { status: 'failed'; message: string }
  | { status: 'result'; result: DiffResult; documents: { original: JsonValue; modified: JsonValue } }

export const IDLE_OUTCOME: CompareOutcome = { status: 'idle' }

function emptyMessage(leftEmpty: boolean, rightEmpty: boolean): string {
  if (leftEmpty && rightEmpty) return 'Paste JSON into both panels, then compare.'
  return leftEmpty
    ? 'The Original panel is empty. Add JSON to compare.'
    : 'The Modified panel is empty. Add JSON to compare.'
}

function isEmpty(result: ParseResult): boolean {
  return !result.ok && result.error.kind === 'empty'
}

function syntaxOf(result: ParseResult): SyntaxError | null {
  return !result.ok && result.error.kind === 'syntax' ? result.error : null
}

/** Pure, synchronous core. Never throws. */
export function computeOutcome(leftText: string, rightText: string): CompareOutcome {
  try {
    const left = parseJson(leftText)
    const right = parseJson(rightText)
    const leftError = syntaxOf(left)
    const rightError = syntaxOf(right)
    if (leftError || rightError) return { status: 'invalid', left: leftError, right: rightError }
    if (!left.ok || !right.ok) {
      return { status: 'empty', message: emptyMessage(isEmpty(left), isEmpty(right)) }
    }
    return {
      status: 'result',
      result: compare(left.value, right.value),
      documents: { original: left.value, modified: right.value },
    }
  } catch (error) {
    if (error instanceof RangeError) return { status: 'failed', message: TOO_DEEP_MESSAGE }
    return { status: 'failed', message: 'Could not compare these documents.' }
  }
}

interface UseCompareOptions {
  /** Compare automatically 500 ms after the last edit. Default off. */
  auto?: boolean
}

export interface UseCompareResult {
  outcome: CompareOutcome
  /** True only when the work has been running for more than ~150 ms. */
  loading: boolean
  run: () => void
  reset: () => void
}

export function useCompare(
  leftText: string,
  rightText: string,
  { auto = false }: UseCompareOptions = {},
): UseCompareResult {
  const [outcome, setOutcome] = useState<CompareOutcome>(IDLE_OUTCOME)
  const [loading, setLoading] = useState(false)
  const texts = useRef({ leftText, rightText })
  const runId = useRef(0)
  const timers = useRef<{
    yield?: ReturnType<typeof setTimeout>
    loading?: ReturnType<typeof setTimeout>
  }>({})

  useEffect(() => {
    texts.current = { leftText, rightText }
  })

  const cancel = useCallback(() => {
    runId.current++
    clearTimeout(timers.current.yield)
    clearTimeout(timers.current.loading)
    setLoading(false)
  }, [])

  const run = useCallback(() => {
    cancel()
    const id = runId.current
    timers.current.loading = setTimeout(() => {
      if (runId.current === id) setLoading(true)
    }, LOADING_DELAY_MS)
    // Yield one frame so the click / key press can paint before the work starts.
    timers.current.yield = setTimeout(() => {
      const next = computeOutcome(texts.current.leftText, texts.current.rightText)
      clearTimeout(timers.current.loading)
      if (runId.current !== id) return
      setOutcome(next)
      setLoading(false)
    }, 0)
  }, [cancel])

  const reset = useCallback(() => {
    cancel()
    setOutcome(IDLE_OUTCOME)
  }, [cancel])

  useEffect(() => {
    if (!auto) return
    const timer = setTimeout(run, AUTO_COMPARE_DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [auto, leftText, rightText, run])

  useEffect(() => {
    const active = timers.current
    const id = runId
    return () => {
      id.current++
      clearTimeout(active.yield)
      clearTimeout(active.loading)
    }
  }, [])

  return { outcome, loading, run, reset }
}
