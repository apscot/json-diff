import { afterEach, describe, expect, it, vi } from 'vitest'
import { compare } from './diff'
import { buildReport, downloadJson, reportFileName } from './report'

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

describe('buildReport', () => {
  const result = compare(
    { age: 25, gone: null, kind: 'a' },
    { age: 26, fresh: 0, kind: ['a'] },
  )
  const now = new Date('2026-01-02T03:04:05.678Z')
  const report = buildReport(result, now)

  it('has the documented top-level schema', () => {
    expect(Object.keys(report)).toEqual([
      'tool',
      'generatedAt',
      'arrayComparison',
      'summary',
      'differences',
    ])
    expect(report.tool).toBe('JSON Diff')
    expect(report.generatedAt).toBe('2026-01-02T03:04:05.678Z')
    expect(report.arrayComparison).toBe('by-index')
    expect(report.summary).toEqual({ total: 4, added: 1, removed: 1, modified: 1, typeChanged: 1 })
  })

  it('uses the current time when no date is given', () => {
    const before = Date.now()
    const t = Date.parse(buildReport(result).generatedAt)
    expect(t).toBeGreaterThanOrEqual(before)
    expect(t).toBeLessThanOrEqual(Date.now())
  })

  it('omits original for added and modified for removed, keeping a real null', () => {
    const byType = Object.fromEntries(report.differences.map((d) => [d.type, d]))
    expect(byType.added).toEqual({ type: 'added', path: '$.fresh', modified: 0 })
    expect(has(byType.added, 'original')).toBe(false)
    expect(byType.removed).toEqual({ type: 'removed', path: '$.gone', original: null })
    expect(has(byType.removed, 'modified')).toBe(false)
  })

  it('keeps both sides for modified and type-changed', () => {
    const byType = Object.fromEntries(report.differences.map((d) => [d.type, d]))
    expect(byType.modified).toEqual({ type: 'modified', path: '$.age', original: 25, modified: 26 })
    expect(byType['type-changed']).toEqual({
      type: 'type-changed',
      path: '$.kind',
      original: 'a',
      modified: ['a'],
    })
  })

  it('survives a JSON round trip with omitted keys still absent', () => {
    const parsed = JSON.parse(JSON.stringify(report)) as typeof report
    expect(parsed.differences).toEqual(report.differences)
  })

  it('does not alias the summary of the result', () => {
    expect(report.summary).not.toBe(result.summary)
  })

  it('reports an empty comparison', () => {
    const empty = buildReport(compare([], []), now)
    expect(empty.differences).toEqual([])
    expect(empty.summary.total).toBe(0)
  })
})

describe('reportFileName', () => {
  it('formats local time with zero padding', () => {
    expect(reportFileName(new Date(2026, 0, 2, 3, 4, 5))).toBe('json-diff-report-20260102-030405.json')
    expect(reportFileName(new Date(2026, 10, 12, 13, 14, 15))).toBe(
      'json-diff-report-20261112-131415.json',
    )
  })

  it('defaults to now', () => {
    expect(reportFileName()).toMatch(/^json-diff-report-\d{8}-\d{6}\.json$/)
  })
})

describe('downloadJson', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('clicks a download link for a Blob object URL and revokes it', async () => {
    const blobs: Blob[] = []
    const create = vi.fn((b: Blob) => {
      blobs.push(b)
      return 'blob:fake'
    })
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: create, revokeObjectURL: revoke })
    const clicked: { href: string; download: string }[] = []
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      clicked.push({ href: this.href, download: this.download })
      expect(revoke).not.toHaveBeenCalled()
    })

    downloadJson('out.json', { a: [1, 2] })

    expect(create).toHaveBeenCalledTimes(1)
    expect(blobs).toHaveLength(1)
    expect(blobs[0]).toBeInstanceOf(Blob)
    expect(blobs[0].type).toBe('application/json')
    expect(JSON.parse(await blobs[0].text())).toEqual({ a: [1, 2] })
    expect(clicked).toEqual([{ href: 'blob:fake', download: 'out.json' }])
    expect(revoke).toHaveBeenCalledWith('blob:fake')
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('revokes the URL even if the click throws', () => {
    const revoke = vi.fn()
    vi.stubGlobal('URL', { createObjectURL: () => 'blob:x', revokeObjectURL: revoke })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('boom')
    })
    expect(() => downloadJson('x.json', {})).toThrow('boom')
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
