import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import App from '@/App'

// The real editor needs layout. This stand-in exposes the props navigation controls.
vi.mock('@/components/JsonEditor', () => ({
  default: ({
    label,
    value,
    onChange,
    highlightRange,
  }: {
    label: string
    value: string
    onChange: (value: string) => void
    highlightRange?: { from: number; to: number } | null
  }) => (
    <div>
      <textarea aria-label={label} value={value} onChange={(event) => onChange(event.target.value)} />
      <output data-testid={`range-${label}`}>
        {highlightRange ? `${highlightRange.from}-${highlightRange.to}` : 'none'}
      </output>
    </div>
  ),
}))

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

const LEFT = '{"user":{"name":"Ann","age":30},"old":1}'
const RIGHT = '{"user":{"name":"Bob","age":30},"extra":{"deep":true}}'

async function setup() {
  const user = userEvent.setup()
  render(<App />)
  fireEvent.change(screen.getByRole('textbox', { name: 'Original JSON' }), { target: { value: LEFT } })
  fireEvent.change(screen.getByRole('textbox', { name: 'Modified JSON' }), { target: { value: RIGHT } })
  await user.click(
    within(screen.getByRole('toolbar', { name: 'Compare actions' })).getByRole('button', { name: /^compare/i }),
  )
  await screen.findAllByTestId('diff-row')
  return user
}

const range = (label: string) => screen.getByTestId(`range-${label}`).textContent

describe('click navigation', () => {
  it('highlights the value in both editors when a list row is clicked', async () => {
    const user = await setup()
    expect(range('Original JSON')).toBe('none')
    const row = screen.getAllByTestId('diff-row').find((r) => r.textContent?.includes('user.name'))
    expect(row).toBeDefined()
    await user.click(row as HTMLElement)

    const nameAt = (text: string, value: string) => {
      const from = text.indexOf(value)
      return `${from}-${from + value.length}`
    }
    expect(range('Original JSON')).toBe(nameAt(LEFT, '"Ann"'))
    expect(range('Modified JSON')).toBe(nameAt(RIGHT, '"Bob"'))
    expect(row).toHaveAttribute('aria-current', 'true')
  })

  it('falls back to the nearest ancestor on the side where the node is missing', async () => {
    const user = await setup()
    const row = screen.getAllByTestId('diff-row').find((r) => r.textContent?.includes('extra'))
    await user.click(row as HTMLElement)
    // Added on the right: the right side has the value, the left falls back to the root object.
    const from = RIGHT.indexOf('{"deep"')
    expect(range('Modified JSON')).toBe(`${from}-${from + '{"deep":true}'.length}`)
    expect(range('Original JSON')).toBe(`0-${LEFT.length}`)
  })

  it('expands the tree to the node selected in the list and selects it', async () => {
    const user = await setup()
    const row = screen.getAllByTestId('diff-row').find((r) => r.textContent?.includes('user.name'))
    await user.click(row as HTMLElement)
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    const items = await screen.findAllByRole('treeitem')
    const selected = items.find((item) => item.getAttribute('aria-selected') === 'true')
    expect(selected).toBeDefined()
    expect(selected?.textContent).toContain('name')
    expect(items.map((item) => item.getAttribute('aria-level'))).toContain('3')
  })

  it('expands ancestors when the selection changes while the tree is open', async () => {
    const user = await setup()
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    await screen.findAllByRole('treeitem')
    expect(screen.getAllByRole('treeitem').some((i) => i.getAttribute('aria-level') === '3')).toBe(false)
    // Select in the tree: the matching list row is highlighted and both editors are marked.
    const userRow = screen.getAllByRole('treeitem').find((i) => i.textContent?.startsWith('user'))
    await user.click(userRow as HTMLElement)
    expect(range('Original JSON')).toBe(`${LEFT.indexOf('{"name"')}-${LEFT.indexOf(',"old"')}`)
    await user.click(screen.getByRole('tab', { name: 'List' }))
    // `$.user` is not itself a difference, so no list row is current; select a real one in the tree.
    await user.click(screen.getByRole('tab', { name: 'Tree' }))
    await user.click(screen.getByRole('button', { name: 'Expand all' }))
    const nameRow = screen.getAllByRole('treeitem').find((i) => i.textContent?.startsWith('name'))
    await user.click(nameRow as HTMLElement)
    await user.click(screen.getByRole('tab', { name: 'List' }))
    const current = screen.getAllByTestId('diff-row').find((r) => r.getAttribute('aria-current') === 'true')
    expect(current?.textContent).toContain('user.name')
  })

  it('clears the selection when either text changes', async () => {
    const user = await setup()
    const row = screen.getAllByTestId('diff-row').find((r) => r.textContent?.includes('user.name'))
    await user.click(row as HTMLElement)
    expect(range('Original JSON')).not.toBe('none')
    act(() => {
      fireEvent.change(screen.getByRole('textbox', { name: 'Modified JSON' }), { target: { value: RIGHT + ' ' } })
    })
    await waitFor(() => expect(range('Original JSON')).toBe('none'))
    expect(range('Modified JSON')).toBe('none')
  })
})
