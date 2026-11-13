import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { computeOutcome, TOO_DEEP_MESSAGE, useCompare } from '@/hooks/useCompare'
import * as diff from '@/lib/json/diff'

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('computeOutcome', () => {
  it('returns a result with summary counts for valid JSON', () => {
    const outcome = computeOutcome('{"a":1,"b":2}', '{"a":1,"b":3,"c":4}')
    expect(outcome.status).toBe('result')
    if (outcome.status === 'result') {
      expect(outcome.result.summary.added).toBe(1)
      expect(outcome.result.summary.modified).toBe(1)
    }
  })

  it('reports both syntax errors at once', () => {
    const outcome = computeOutcome('{bad', '[1,')
    expect(outcome.status).toBe('invalid')
    if (outcome.status === 'invalid') {
      expect(outcome.left).not.toBeNull()
      expect(outcome.right).not.toBeNull()
    }
  })

  it('reports a neutral message for empty inputs', () => {
    const outcome = computeOutcome('   ', '{}')
    expect(outcome).toEqual({ status: 'empty', message: expect.stringContaining('Original') })
    expect(computeOutcome('', '')).toMatchObject({ status: 'empty' })
  })

  it('maps a RangeError to the too-deeply-nested message and never throws', () => {
    vi.spyOn(diff, 'compare').mockImplementation(() => {
      throw new RangeError('Maximum call stack size exceeded')
    })
    expect(computeOutcome('{}', '{}')).toEqual({ status: 'failed', message: TOO_DEEP_MESSAGE })
    vi.spyOn(diff, 'compare').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(computeOutcome('{}', '{}').status).toBe('failed')
  })
})

describe('useCompare', () => {
  it('stays idle until run, then produces a result', async () => {
    const { result } = renderHook(() => useCompare('{"a":1}', '{"a":2}'))
    expect(result.current.outcome.status).toBe('idle')
    act(() => result.current.run())
    await waitFor(() => expect(result.current.outcome.status).toBe('result'))
    expect(result.current.loading).toBe(false)
  })

  it('yields a frame before computing', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCompare('{"a":1}', '{"a":2}'))
    act(() => result.current.run())
    expect(result.current.outcome.status).toBe('idle')
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.outcome.status).toBe('result')
  })

  it('does not crash on invalid input', async () => {
    const { result } = renderHook(() => useCompare('{bad', '{"a":1}'))
    act(() => result.current.run())
    await waitFor(() => expect(result.current.outcome.status).toBe('invalid'))
  })

  it('shows loading only when the work exceeds about 150 ms', () => {
    vi.useFakeTimers()
    const { result } = renderHook(() => useCompare('{}', '{}'))
    act(() => result.current.run())
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.loading).toBe(false)

    // Slow work: the clock jumps past the delay while computing.
    vi.spyOn(diff, 'compare').mockImplementation(() => {
      vi.advanceTimersByTime(200)
      return { entries: [], summary: { total: 0, added: 0, removed: 0, modified: 0, typeChanged: 0 } } as never
    })
    act(() => result.current.run())
    act(() => {
      vi.advanceTimersByTime(0)
    })
    expect(result.current.outcome.status).toBe('result')
    expect(result.current.loading).toBe(false)
  })

  it('auto-compares after a 500 ms debounce only when enabled', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(
      ({ text, auto }) => useCompare(text, '{"a":2}', { auto }),
      { initialProps: { text: '{"a":1}', auto: false } },
    )
    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current.outcome.status).toBe('idle')

    rerender({ text: '{"a":1}', auto: true })
    act(() => {
      vi.advanceTimersByTime(499)
    })
    expect(result.current.outcome.status).toBe('idle')
    act(() => {
      vi.advanceTimersByTime(10)
    })
    expect(result.current.outcome.status).toBe('result')
  })

  it('reset returns to idle', async () => {
    const { result } = renderHook(() => useCompare('{}', '{}'))
    act(() => result.current.run())
    await waitFor(() => expect(result.current.outcome.status).toBe('result'))
    act(() => result.current.reset())
    expect(result.current.outcome.status).toBe('idle')
  })
})
