import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import ResultsPanel from '@/components/ResultsPanel'
import { computeOutcome } from '@/hooks/useCompare'
import type { CompareOutcome } from '@/hooks/useCompare'

// jsdom has no layout: give every element a viewport size so the virtualiser renders rows.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  const size = { width: 800, height: 448 }
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: size.width })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: size.height })
})

const LEFT = JSON.stringify({
  name: 'Ann',
  age: 30,
  admin: true,
  nick: 'a',
  tags: ['x'],
})
const RIGHT = JSON.stringify({
  name: 'Bob',
  age: '30',
  admin: true,
  email: 'bob@example.com',
  tags: ['x', 'y'],
})

function outcomeFor(left: string, right: string): CompareOutcome {
  return computeOutcome(left, right)
}

const summaryCount = (name: string) =>
  within(screen.getByRole('group', { name })).getByText(/^\d+$/).textContent

const rows = () => screen.queryAllByTestId('diff-row')

describe('ResultsPanel', () => {
  it('shows summary counts that match the comparison', () => {
    render(<ResultsPanel outcome={outcomeFor(LEFT, RIGHT)} />)
    // name modified, age type-changed, nick removed, email added, tags[1] added
    expect(summaryCount('Total')).toBe('5')
    expect(summaryCount('Added')).toBe('2')
    expect(summaryCount('Removed')).toBe('1')
    expect(summaryCount('Modified')).toBe('1')
    expect(summaryCount('Type changes')).toBe('1')
    expect(rows()).toHaveLength(5)
    expect(screen.getByText('Arrays are compared by index.')).toBeInTheDocument()
  })

  it('hides the Type changes card when there are none', () => {
    render(<ResultsPanel outcome={outcomeFor('{"a":1}', '{"a":2}')} />)
    expect(screen.queryByRole('group', { name: 'Type changes' })).not.toBeInTheDocument()
    expect(summaryCount('Modified')).toBe('1')
  })

  it('narrows rows instantly by kind filter and by search', async () => {
    const user = userEvent.setup()
    render(<ResultsPanel outcome={outcomeFor(LEFT, RIGHT)} />)

    await user.click(screen.getByRole('radio', { name: 'Added' }))
    expect(rows()).toHaveLength(2)

    await user.click(screen.getByRole('radio', { name: 'Type changes' }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('$.age')

    await user.click(screen.getByRole('radio', { name: 'All' }))
    expect(rows()).toHaveLength(5)

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search differences' }), {
      target: { value: 'email' },
    })
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveTextContent('$.email')

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search differences' }), {
      target: { value: 'zzz-nothing' },
    })
    expect(rows()).toHaveLength(0)
    expect(screen.getByText('No differences match the current filters.')).toBeInTheDocument()
  })

  it('selects a row on click and on Enter and highlights it', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<ResultsPanel outcome={outcomeFor(LEFT, RIGHT)} onSelect={onSelect} />)

    await user.click(rows()[0])
    expect(onSelect).toHaveBeenCalledTimes(1)
    const firstPath = onSelect.mock.calls[0][0] as string
    expect(rows()[0]).toHaveAttribute('aria-current', 'true')

    rows()[2].focus()
    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledTimes(2)
    expect(onSelect.mock.calls[1][0]).not.toBe(firstPath)
    expect(rows()[2]).toHaveAttribute('aria-current', 'true')
    expect(rows()[0]).not.toHaveAttribute('aria-current')
  })

  it('renders the tree view for the Tree tab', async () => {
    const user = userEvent.setup()
    render(<ResultsPanel outcome={outcomeFor(LEFT, RIGHT)} />)
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    expect(screen.getByRole('tree')).toBeInTheDocument()
  })

  it('shows the no-differences state for identical documents', () => {
    render(<ResultsPanel outcome={outcomeFor(LEFT, LEFT)} />)
    expect(screen.getByText('No differences: both documents are equal.')).toBeInTheDocument()
    expect(summaryCount('Total')).toBe('0')
    expect(rows()).toHaveLength(0)
    expect(screen.queryByRole('radio', { name: 'All' })).not.toBeInTheDocument()
  })

  it('keeps the DOM bounded when rendering 5,000 differences', () => {
    const count = 5000
    const left = JSON.stringify(Array.from({ length: count }, (_, i) => i))
    const right = JSON.stringify(Array.from({ length: count }, (_, i) => i + 1))
    render(<ResultsPanel outcome={outcomeFor(left, right)} />)
    expect(summaryCount('Total')).toBe(String(count))
    const rendered = rows().length
    expect(rendered).toBeGreaterThan(0)
    expect(rendered).toBeLessThan(100)
  })
})
