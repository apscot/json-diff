import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import DiffTree from '@/components/DiffTree'
import ResultsPanel from '@/components/ResultsPanel'
import { computeOutcome } from '@/hooks/useCompare'
import { compare } from '@/lib/json/diff'
import type { JsonValue } from '@/lib/json/types'

// jsdom has no layout: give every element a viewport size so the virtualiser renders rows.
beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal('ResizeObserver', ResizeObserverStub)
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, value: 800 })
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, value: 448 })
})

const ORIGINAL: JsonValue = {
  user: { name: 'Ann', age: 30, address: { city: 'Oslo', zip: '0150' } },
  tags: ['x', 'y'],
  active: true,
}
const MODIFIED: JsonValue = {
  user: { name: 'Bob', age: 30, address: { city: 'Oslo', zip: '0151' } },
  tags: ['x', 'y', 'z'],
  active: true,
}

function renderTree(onSelect = vi.fn()) {
  const { differences } = compare(ORIGINAL, MODIFIED)
  render(
    <DiffTree
      differences={differences}
      documents={{ original: ORIGINAL, modified: MODIFIED }}
      onSelect={onSelect}
    />,
  )
  return onSelect
}

const rows = () => screen.queryAllByRole('treeitem')
const names = () => rows().map((row) => row.querySelector('span.truncate')?.textContent)

describe('DiffTree', () => {
  it('expands the root only by default and exposes ARIA tree semantics', () => {
    renderTree()
    expect(screen.getByRole('tree')).toBeInTheDocument()
    expect(names()).toEqual(['$', 'user', 'tags', 'active'])
    expect(rows()[0]).toHaveAttribute('aria-level', '1')
    expect(rows()[0]).toHaveAttribute('aria-expanded', 'true')
    expect(rows()[1]).toHaveAttribute('aria-level', '2')
    expect(rows()[1]).toHaveAttribute('aria-expanded', 'false')
    // Leaves have no aria-expanded.
    expect(rows()[3]).not.toHaveAttribute('aria-expanded')
    // Exactly one row is in the tab order.
    expect(rows().filter((row) => row.tabIndex === 0)).toHaveLength(1)
  })

  it('marks ancestors of changes and shows a badge on changed rows', async () => {
    const user = userEvent.setup()
    renderTree()
    expect(within(rows()[1]).getByText('Contains changes')).toBeInTheDocument()
    expect(within(rows()[3]).queryByText('Contains changes')).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    const name = rows().find((row) => row.textContent?.startsWith('name'))
    expect(name).toBeDefined()
    expect(within(name as HTMLElement).getByText('Modified')).toBeInTheDocument()
    expect(name).toHaveTextContent('"Ann" → "Bob"')
    expect(name).toHaveTextContent('string')
  })

  it('changes the row count with Expand all and Collapse all', async () => {
    const user = userEvent.setup()
    renderTree()
    const initial = rows().length
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    const expanded = rows().length
    expect(expanded).toBeGreaterThan(initial)
    // $, user, name, age, address, city, zip, tags, 0, 1, 2, active
    expect(expanded).toBe(12)
    await user.click(screen.getByRole('button', { name: 'Collapse all' }))
    expect(rows()).toHaveLength(1)
    expect(rows()[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('hides unchanged rows with the Changed only switch', async () => {
    const user = userEvent.setup()
    renderTree()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    const all = rows().length
    await user.click(screen.getByRole('switch', { name: 'Changed only' }))
    const changed = names()
    expect(changed.length).toBeLessThan(all)
    expect(changed).not.toContain('age')
    expect(changed).not.toContain('active')
    expect(changed).not.toContain('city')
    expect(changed).toEqual(expect.arrayContaining(['name', 'zip', '2']))
    await user.click(screen.getByRole('switch', { name: 'Changed only' }))
    expect(rows()).toHaveLength(all)
  })

  it('supports arrow-key navigation, expand/collapse and Enter to select', async () => {
    const user = userEvent.setup()
    const onSelect = renderTree()
    rows()[0].focus()

    await user.keyboard('{ArrowDown}')
    expect(rows()[1]).toHaveFocus()
    expect(rows()[1].tabIndex).toBe(0)
    expect(rows()[0].tabIndex).toBe(-1)

    await user.keyboard('{ArrowRight}')
    expect(rows()[1]).toHaveAttribute('aria-expanded', 'true')
    expect(names()).toEqual(['$', 'user', 'name', 'age', 'address', 'tags', 'active'])

    await user.keyboard('{ArrowRight}')
    expect(rows()[2]).toHaveFocus()

    await user.keyboard('{ArrowLeft}')
    expect(rows()[1]).toHaveFocus() // a leaf moves focus to its parent

    await user.keyboard('{ArrowLeft}')
    expect(rows()[1]).toHaveAttribute('aria-expanded', 'false')

    await user.keyboard('{ArrowDown}{ArrowUp}')
    expect(rows()[1]).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith("$.user")
    expect(rows()[1]).toHaveAttribute('aria-selected', 'true')
  })

  it('selects a row on click', async () => {
    const user = userEvent.setup()
    const onSelect = renderTree()
    await user.click(rows()[2])
    expect(onSelect).toHaveBeenCalledWith('$.tags')
  })

  it('restricts the tree to the visible differences and their ancestors', async () => {
    const user = userEvent.setup()
    const { differences } = compare(ORIGINAL, MODIFIED)
    const zip = differences.filter((d) => d.path.endsWith('zip'))
    expect(zip).toHaveLength(1)
    render(
      <DiffTree
        differences={differences}
        visibleDifferences={zip}
        documents={{ original: ORIGINAL, modified: MODIFIED }}
      />,
    )
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(names()).toEqual(['$', 'user', 'address', 'zip'])
  })

  it('builds a tree from the differences alone when no documents are given', async () => {
    const user = userEvent.setup()
    const { differences } = compare(ORIGINAL, MODIFIED)
    render(<DiffTree differences={differences} />)
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(names()).toEqual(['$', 'user', 'name', 'address', 'zip', 'tags', '2'])
  })

  it('keeps the DOM bounded for a large tree', async () => {
    const user = userEvent.setup()
    const count = 20000
    const original = Array.from({ length: count }, (_, i) => ({ id: i }))
    const modified = Array.from({ length: count }, (_, i) => ({ id: i + 1 }))
    const { differences } = compare(original, modified)
    render(<DiffTree differences={differences} documents={{ original, modified }} />)
    expect(rows().length).toBeGreaterThan(0)
    expect(rows().length).toBeLessThan(100)
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(rows().length).toBeGreaterThan(0)
    expect(rows().length).toBeLessThan(100)
    expect(screen.getByRole('tree')).toHaveStyle({ height: `${2 * count * 36 + 36}px` })
  })
})

describe('Tree tab in ResultsPanel', () => {
  const LEFT = JSON.stringify({ name: 'Ann', age: 30, nick: 'a', tags: ['x'] })
  const RIGHT = JSON.stringify({ name: 'Bob', age: '30', email: 'e@x.io', tags: ['x', 'y'] })

  it('renders the sample comparison lazily when the Tree tab opens', async () => {
    const user = userEvent.setup()
    render(<ResultsPanel outcome={computeOutcome(LEFT, RIGHT)} />)
    expect(screen.queryByRole('tree')).not.toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    expect(screen.getByRole('tree')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    expect(names()).toEqual(['$', 'name', 'age', 'nick', 'tags', '0', '1', 'email'])
    const age = rows().find((row) => row.textContent?.startsWith('age'))
    expect(age).toHaveTextContent('Type changed')
    expect(age).toHaveTextContent('number → string')
  })

  it('respects the kind filter', async () => {
    const user = userEvent.setup()
    render(<ResultsPanel outcome={computeOutcome(LEFT, RIGHT)} />)
    await user.click(screen.getByRole('radio', { name: 'Removed' }))
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    expect(names()).toEqual(['$', 'nick'])
  })
})
