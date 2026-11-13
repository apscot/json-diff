import { act, fireEvent, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useShortcuts } from '@/hooks/useShortcuts'
import { useTheme } from '@/hooks/useTheme'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('useLocalStorage', () => {
  it('returns the initial value and persists JSON', () => {
    const { result } = renderHook(() => useLocalStorage('k', { a: 1 }))
    expect(result.current[0]).toEqual({ a: 1 })
    act(() => result.current[1]({ a: 2 }))
    expect(result.current[0]).toEqual({ a: 2 })
    expect(window.localStorage.getItem('k')).toBe('{"a":2}')
  })

  it('falls back on invalid JSON', () => {
    window.localStorage.setItem('k', '{not json')
    const { result } = renderHook(() => useLocalStorage('k', 'init'))
    expect(result.current[0]).toBe('init')
  })

  it('survives storage errors', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    const { result } = renderHook(() => useLocalStorage('k', 1))
    expect(result.current[0]).toBe(1)
    act(() => result.current[1]((n) => n + 1))
    expect(result.current[0]).toBe(2)
  })
})

describe('useTheme', () => {
  it('is dark by default and toggles the class, persisted', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current.theme).toBe('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)
    act(() => result.current.toggle())
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(window.localStorage.getItem('theme')).toBe('"light"')
    const again = renderHook(() => useTheme())
    expect(again.result.current.theme).toBe('light')
  })
})

describe('useDebouncedValue', () => {
  it('updates only after the delay', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 500), {
      initialProps: { v: 'a' },
    })
    rerender({ v: 'b' })
    act(() => void vi.advanceTimersByTime(499))
    expect(result.current).toBe('a')
    act(() => void vi.advanceTimersByTime(1))
    expect(result.current).toBe('b')
  })
})

describe('useShortcuts', () => {
  function setup() {
    const handlers = { onCompare: vi.fn(), onFormat: vi.fn(), onSwap: vi.fn() }
    const hook = renderHook(() => useShortcuts(handlers))
    return { handlers, hook }
  }

  it('fires handlers and prevents default', () => {
    const { handlers } = setup()
    const press = (init: KeyboardEventInit) =>
      fireEvent.keyDown(window, init)
    expect(press({ key: 'Enter', ctrlKey: true })).toBe(false)
    expect(press({ key: 'F', metaKey: true, shiftKey: true })).toBe(false)
    expect(press({ key: 'X', ctrlKey: true, shiftKey: true })).toBe(false)
    expect(handlers.onCompare).toHaveBeenCalledTimes(1)
    expect(handlers.onFormat).toHaveBeenCalledTimes(1)
    expect(handlers.onSwap).toHaveBeenCalledTimes(1)
  })

  it('ignores other keys and removes the listener on unmount', () => {
    const { handlers, hook } = setup()
    expect(fireEvent.keyDown(window, { key: 'Enter' })).toBe(true)
    expect(fireEvent.keyDown(window, { key: 'f', ctrlKey: true })).toBe(true)
    hook.unmount()
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    expect(handlers.onCompare).not.toHaveBeenCalled()
  })

  it('exposes the same handlers as a CodeMirror keymap', () => {
    const { handlers, hook } = setup()
    const map = hook.result.current.keymap
    expect(map.map((b) => b.key)).toEqual(['Mod-Enter', 'Mod-Shift-f', 'Mod-Shift-x'])
    expect(map.every((b) => b.preventDefault)).toBe(true)
    expect(map[0].run()).toBe(true)
    map[1].run()
    map[2].run()
    expect(handlers.onCompare).toHaveBeenCalledTimes(1)
    expect(handlers.onFormat).toHaveBeenCalledTimes(1)
    expect(handlers.onSwap).toHaveBeenCalledTimes(1)
  })
})
