import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ActionBar from '@/components/ActionBar'
import App from '@/App'

// jsdom has no layout; CodeMirror measures text through Range rects.
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
Range.prototype.getClientRects = emptyRects as unknown as Range['getClientRects']
Range.prototype.getBoundingClientRect = () => new DOMRect()

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal('ResizeObserver', ResizeObserverStub)

beforeEach(() => {
  window.localStorage.clear()
})

const original = () => screen.getByRole('region', { name: 'Original JSON' })
const modified = () => screen.getByRole('region', { name: 'Modified JSON' })
const results = () => screen.getByRole('region', { name: 'Comparison results' })
const clickCompare = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getAllByRole('button', { name: 'Compare' })[0])
}

describe('ActionBar', () => {
  it('calls each handler and toggles auto-compare (default off)', async () => {
    const user = userEvent.setup()
    const handlers = {
      onCompare: vi.fn(),
      onSwap: vi.fn(),
      onFormatBoth: vi.fn(),
      onClearLeft: vi.fn(),
      onClearRight: vi.fn(),
      onClearBoth: vi.fn(),
      onAutoCompareChange: vi.fn(),
    }
    render(<ActionBar {...handlers} autoCompare={false} />)
    await user.click(screen.getByRole('button', { name: 'Compare' }))
    await user.click(screen.getByRole('button', { name: /Swap/ }))
    await user.click(screen.getByRole('button', { name: /Format both/ }))
    await user.click(screen.getByRole('button', { name: /Clear original/ }))
    await user.click(screen.getByRole('button', { name: /Clear modified/ }))
    await user.click(screen.getByRole('button', { name: /Clear both/ }))
    const toggle = screen.getByRole('switch', { name: 'Auto-compare' })
    expect(toggle).not.toBeChecked()
    await user.click(toggle)
    for (const fn of Object.values(handlers)) expect(fn).toHaveBeenCalledTimes(1)
    expect(handlers.onAutoCompareChange).toHaveBeenCalledWith(true)
  })

  it('shows the shortcut in the Compare tooltip', async () => {
    const user = userEvent.setup()
    render(
      <ActionBar
        onCompare={vi.fn()}
        onSwap={vi.fn()}
        onFormatBoth={vi.fn()}
        onClearLeft={vi.fn()}
        onClearRight={vi.fn()}
        onClearBoth={vi.fn()}
        autoCompare={false}
        onAutoCompareChange={vi.fn()}
      />,
    )
    await user.hover(screen.getByRole('button', { name: 'Compare' }))
    expect((await screen.findAllByText(/\+Enter/)).length).toBeGreaterThan(0)
  })
})

describe('Compare flow in App', () => {
  it('Compare button yields a result for the samples', async () => {
    const user = userEvent.setup()
    render(<App />)
    await clickCompare(user)
    await waitFor(() => expect(results()).toHaveTextContent(/\d+ differences:/))
  })

  it('Ctrl+Enter yields a result for the samples', async () => {
    render(<App />)
    fireEvent.keyDown(window, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(results()).toHaveTextContent(/\d+ differences:/))
  })

  it('Ctrl+Enter inside the editor fires compare exactly once', async () => {
    render(<App />)
    const content = within(original()).getByRole('textbox')
    fireEvent.keyDown(content, { key: 'Enter', ctrlKey: true })
    await waitFor(() => expect(results()).toHaveTextContent(/\d+ differences:/))
  })

  it('Ctrl+Shift+X swaps the two texts', async () => {
    render(<App />)
    expect(within(original()).getByText(/Ada Lovelace/)).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'X', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(within(original()).getByText(/Augusta Ada King/)).toBeInTheDocument())
    expect(within(modified()).getByText(/Ada Lovelace/)).toBeInTheDocument()
  })

  it('Swap button exchanges the texts', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Swap/ }))
    expect(within(original()).getByText(/Augusta Ada King/)).toBeInTheDocument()
    expect(within(modified()).getByText(/Ada Lovelace/)).toBeInTheDocument()
  })

  it('Ctrl+Shift+F formats both panels', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)
    await user.upload(
      within(original()).getByLabelText('Upload Original JSON file'),
      new File(['{"a":1}'], 'a.json', { type: 'application/json' }),
    )
    await user.upload(
      within(modified()).getByLabelText('Upload Modified JSON file'),
      new File(['{"b":2}'], 'b.json', { type: 'application/json' }),
    )
    await waitFor(() => expect(original()).toHaveTextContent('{"a":1}'))
    fireEvent.keyDown(window, { key: 'F', ctrlKey: true, shiftKey: true })
    await waitFor(() => expect(original()).toHaveTextContent(/9123\{ "a": 1\}/))
    expect(modified()).toHaveTextContent(/123\{ "b": 2\}/)
  })

  it('Clear both then Compare shows a neutral message', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click(screen.getByRole('button', { name: /Clear both/ }))
    await clickCompare(user)
    const status = await within(results()).findByText(/Paste JSON into both panels/)
    expect(status).not.toHaveAttribute('role', 'alert')
  })

  it('shows both errors at once for invalid input without crashing', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)
    await user.upload(
      within(original()).getByLabelText('Upload Original JSON file'),
      new File(['{bad'], 'a.json', { type: 'application/json' }),
    )
    await user.upload(
      within(modified()).getByLabelText('Upload Modified JSON file'),
      new File(['[1,'], 'b.json', { type: 'application/json' }),
    )
    await clickCompare(user)
    await waitFor(() => expect(results()).toHaveTextContent(/Original JSON: line/))
    expect(results()).toHaveTextContent(/Modified JSON: line/)
  })
})
