import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '@/components/ActionBar'
import {
  DRAFT_LEFT_KEY,
  DRAFT_RIGHT_KEY,
  DRAFT_SAVE_DELAY_MS,
  DRAFTS_FLAG_KEY,
  MAX_DRAFT_BYTES,
  readDrafts,
  useDrafts,
} from '@/hooks/useDrafts'

const noop = () => undefined

/** A tiny host: two texts, the opt-in switch from the real action bar. */
function Host({ left, right }: { left: string; right: string }) {
  const drafts = useDrafts(left, right)
  return (
    <ActionBar
      onCompare={noop}
      onSwap={noop}
      onFormatBoth={noop}
      onClearLeft={noop}
      onClearRight={noop}
      onClearBoth={noop}
      autoCompare={false}
      onAutoCompareChange={noop}
      saveDrafts={drafts.enabled}
      onSaveDraftsChange={drafts.setEnabled}
      draftsProblem={drafts.problem}
    />
  )
}

const LABEL = 'Save drafts in this browser (stored unencrypted)'

function flush() {
  act(() => {
    vi.advanceTimersByTime(DRAFT_SAVE_DELAY_MS + 10)
  })
}

beforeEach(() => {
  window.localStorage.clear()
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('drafts opt-in', () => {
  it('is off by default and stores nothing', () => {
    vi.useFakeTimers()
    render(<Host left='{"a":1}' right='{"a":2}' />)
    flush()
    expect(screen.getByRole('switch', { name: LABEL })).not.toBeChecked()
    expect(window.localStorage.length).toBe(0)
    expect(readDrafts()).toBeNull()
  })

  it('stores both sides once switched on, and follows later edits', async () => {
    const user = userEvent.setup()
    const { rerender } = render(<Host left='{"a":1}' right='{"a":2}' />)
    await user.click(screen.getByRole('switch', { name: LABEL }))
    expect(window.localStorage.getItem(DRAFT_LEFT_KEY)).toBe('{"a":1}')
    expect(window.localStorage.getItem(DRAFT_RIGHT_KEY)).toBe('{"a":2}')
    expect(readDrafts()).toEqual({ left: '{"a":1}', right: '{"a":2}' })

    vi.useFakeTimers()
    rerender(<Host left='{"a":3}' right='{"a":2}' />)
    flush()
    expect(window.localStorage.getItem(DRAFT_LEFT_KEY)).toBe('{"a":3}')
  })

  it('deletes the stored drafts when switched off', async () => {
    const user = userEvent.setup()
    render(<Host left="[1]" right="[2]" />)
    const toggle = screen.getByRole('switch', { name: LABEL })
    await user.click(toggle)
    expect(window.localStorage.getItem(DRAFT_LEFT_KEY)).toBe('[1]')
    await user.click(toggle)
    expect(window.localStorage.getItem(DRAFT_LEFT_KEY)).toBeNull()
    expect(window.localStorage.getItem(DRAFT_RIGHT_KEY)).toBeNull()
    expect(readDrafts()).toBeNull()
  })

  it('restores drafts only when the opt-in is on', () => {
    window.localStorage.setItem(DRAFT_LEFT_KEY, '[1]')
    window.localStorage.setItem(DRAFT_RIGHT_KEY, '[2]')
    expect(readDrafts()).toBeNull()
    window.localStorage.setItem(DRAFTS_FLAG_KEY, 'true')
    expect(readDrafts()).toEqual({ left: '[1]', right: '[2]' })
  })

  it('does not save a side over 1 MB and says so', async () => {
    const user = userEvent.setup()
    render(<Host left={'x'.repeat(MAX_DRAFT_BYTES + 1)} right="[2]" />)
    await user.click(screen.getByRole('switch', { name: LABEL }))
    expect(window.localStorage.getItem(DRAFT_LEFT_KEY)).toBeNull()
    expect(window.localStorage.getItem(DRAFT_RIGHT_KEY)).toBe('[2]')
    expect(screen.getByText('too-large')).toBeInTheDocument()
  })

  it('catches storage errors instead of throwing', async () => {
    const user = userEvent.setup()
    render(<Host left="[1]" right="[2]" />)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    await user.click(screen.getByRole('switch', { name: LABEL }))
    expect(screen.getByText('storage')).toBeInTheDocument()
  })
})
