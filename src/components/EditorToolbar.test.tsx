import { useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from '@/App'
import EditorToolbar from '@/components/EditorToolbar'
import ValidationMessage from '@/components/ValidationMessage'
import type { IndentOption } from '@/lib/json/parse'

function Harness({ initial }: { initial: string }) {
  const [text, setText] = useState(initial)
  const [indent, setIndent] = useState<IndentOption>(2)
  return (
    <>
      <EditorToolbar
        label="Test JSON"
        value={text}
        onChange={setText}
        indent={indent}
        onIndentChange={setIndent}
      />
      <pre data-testid="text">{text}</pre>
    </>
  )
}

const text = () => screen.getByTestId('text').textContent

// jsdom has no layout; CodeMirror measures text through Range rects.
const emptyRects = () => ({ length: 0, item: () => null, [Symbol.iterator]: [][Symbol.iterator] })
Range.prototype.getClientRects = emptyRects as unknown as Range['getClientRects']
Range.prototype.getBoundingClientRect = () => new DOMRect()

beforeEach(() => {
  window.localStorage.clear()
})

describe('EditorToolbar', () => {
  it('formats with the chosen indent and minifies', async () => {
    const user = userEvent.setup()
    render(<Harness initial={'{"a":[1,2],"b":{"c":null}}'} />)

    await user.click(screen.getByRole('button', { name: /^Format/ }))
    expect(text()).toBe('{\n  "a": [\n    1,\n    2\n  ],\n  "b": {\n    "c": null\n  }\n}')

    await user.selectOptions(screen.getByLabelText('Test JSON indent'), 'tab')
    await user.click(screen.getByRole('button', { name: /^Format/ }))
    expect(text()).toContain('\n\t"a": [')

    await user.click(screen.getByRole('button', { name: /^Minify/ }))
    expect(text()).toBe('{"a":[1,2],"b":{"c":null}}')
  })

  it('leaves invalid text untouched when formatting or minifying', async () => {
    const user = userEvent.setup()
    render(<Harness initial={'{"a": 1,}'} />)

    await user.click(screen.getByRole('button', { name: /^Format/ }))
    expect(text()).toBe('{"a": 1,}')
    expect(screen.getByRole('alert')).toHaveTextContent(/line 1, column 9/)

    await user.click(screen.getByRole('button', { name: /^Minify/ }))
    expect(text()).toBe('{"a": 1,}')
  })

  it('clears the text', async () => {
    const user = userEvent.setup()
    render(<Harness initial={'{"a":1}'} />)
    await user.click(screen.getByRole('button', { name: /^Clear/ }))
    expect(text()).toBe('')
  })

  it('uploads a JSON file and rejects one over 20 MB', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<Harness initial="" />)
    const input = screen.getByLabelText('Upload Test JSON file')

    await user.upload(input, new File(['{"up":1}'], 'a.json', { type: 'application/json' }))
    await waitFor(() => expect(text()).toBe('{"up":1}'))

    const big = new File(['x'], 'big.json', { type: 'application/json' })
    Object.defineProperty(big, 'size', { value: 20 * 1024 * 1024 + 1 })
    await user.upload(input, big)
    expect(await screen.findByRole('alert')).toHaveTextContent(/larger than 20 MB/)
    expect(text()).toBe('{"up":1}')
  })

  it('shows a confirmation after copying', async () => {
    const written: string[] = []
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: (t: string) => (written.push(t), Promise.resolve()) },
    })
    render(<Harness initial={'{"a":1}'} />)
    // fireEvent-free: click through the DOM so the async state update is awaited.
    await act(async () => {
      screen.getByRole('button', { name: /^Copy/ }).click()
    })
    expect(written).toEqual(['{"a":1}'])
    expect(screen.getByRole('button', { name: /^Copied/ })).toBeInTheDocument()
  })
})

describe('ValidationMessage', () => {
  it('renders the three states', () => {
    const { rerender } = render(
      <ValidationMessage
        result={{ ok: false, error: { kind: 'syntax', message: 'bad', line: 3, column: 7 } }}
      />,
    )
    expect(screen.getByRole('alert')).toHaveTextContent('line 3, column 7')
    rerender(<ValidationMessage result={{ ok: false, error: { kind: 'empty' } }} />)
    expect(screen.getByText(/to get started/)).toBeInTheDocument()
    rerender(<ValidationMessage result={{ ok: true, value: {} }} />)
    expect(screen.getByText('Valid JSON')).toBeInTheDocument()
  })
})

describe('App workspace', () => {
  it('shows both panels with sample data, valid', async () => {
    render(<App />)
    const original = screen.getByRole('region', { name: 'Original JSON' })
    const modified = screen.getByRole('region', { name: 'Modified JSON' })
    expect(within(original).getByText(/Ada Lovelace/)).toBeInTheDocument()
    expect(within(modified).getByText(/Augusta Ada King/)).toBeInTheDocument()
    await waitFor(() => expect(screen.getAllByText('Valid JSON')).toHaveLength(2))
  })

  it('shows line and column for invalid uploaded JSON without crashing, then clears', async () => {
    const user = userEvent.setup({ applyAccept: false })
    render(<App />)
    const original = screen.getByRole('region', { name: 'Original JSON' })

    await user.upload(
      within(original).getByLabelText('Upload Original JSON file'),
      new File(['{\n  "a": 1,\n}'], 'bad.json', { type: 'application/json' }),
    )
    await waitFor(() =>
      expect(within(original).getByRole('alert')).toHaveTextContent(/line 3, column 1/),
    )
    expect(screen.getByRole('region', { name: 'Modified JSON' })).toHaveTextContent('Valid JSON')

    await user.click(within(original).getByRole('button', { name: /^Clear/ }))
    await waitFor(() => expect(within(original).getByText(/to get started/)).toBeInTheDocument())
  })

  it('stores the indent preference', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.selectOptions(screen.getByLabelText('Original JSON indent'), '4')
    expect(window.localStorage.getItem('indent')).toBe('4')
    expect(screen.getByLabelText('Modified JSON indent')).toHaveValue('4')
  })
})
