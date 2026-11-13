import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import ResultsPanel from '@/components/ResultsPanel'
import { computeOutcome } from '@/hooks/useCompare'
import type { Report } from '@/lib/json/report'
import { downloadJson } from '@/lib/json/report'

vi.mock('@/lib/json/report', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/json/report')>()),
  downloadJson: vi.fn(),
}))

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

beforeEach(() => {
  vi.mocked(downloadJson).mockClear()
})

const LEFT = JSON.stringify({ name: 'Ann', age: 30, nick: 'a' })
const RIGHT = JSON.stringify({ name: 'Bob', age: '30', email: 'e@x.io' })

describe('Download report', () => {
  it('is disabled when there is no result', () => {
    render(<ResultsPanel outcome={{ status: 'idle' }} />)
    expect(screen.getByRole('button', { name: /Download report/ })).toBeDisabled()
  })

  it('downloads the full report even while a filter narrows the view', async () => {
    const user = userEvent.setup()
    const outcome = computeOutcome(LEFT, RIGHT)
    if (outcome.status !== 'result') throw new Error('expected a result')
    render(<ResultsPanel outcome={outcome} />)

    await user.click(screen.getByRole('radio', { name: 'Added' }))
    await user.click(screen.getByRole('button', { name: /Download report/ }))

    expect(downloadJson).toHaveBeenCalledTimes(1)
    const [fileName, data] = vi.mocked(downloadJson).mock.calls[0]
    expect(fileName).toMatch(/^json-diff-report-\d{8}-\d{6}\.json$/)
    const report = data as Report
    expect(report.tool).toBe('JSON Diff')
    expect(report.summary).toEqual(outcome.result.summary)
    expect(report.summary.total).toBe(4)
    expect(report.differences).toHaveLength(outcome.result.differences.length)
    expect(report.differences.map((d) => [d.type, d.path])).toEqual(
      outcome.result.differences.map((d) => [d.kind, d.path]),
    )
    for (const d of report.differences) {
      const source = outcome.result.differences.find((x) => x.path === d.path)!
      if (source.kind === 'added') {
        expect(Object.prototype.hasOwnProperty.call(d, 'original')).toBe(false)
        expect(d.modified).toEqual(source.modified)
      } else if (source.kind === 'removed') {
        expect(Object.prototype.hasOwnProperty.call(d, 'modified')).toBe(false)
        expect(d.original).toEqual(source.original)
      } else {
        expect(d.original).toEqual(source.original)
        expect(d.modified).toEqual(source.modified)
      }
    }
    expect(report.differences.some((d) => d.type === 'added')).toBe(true)
    expect(report.differences.some((d) => d.type === 'removed')).toBe(true)
  })
})
