import type { DiffKind, DiffResult, DiffSummary, Difference, JsonValue } from './types'

export interface ReportDifference {
  type: DiffKind
  path: string
  /** Omitted for `added`. */
  original?: JsonValue
  /** Omitted for `removed`. */
  modified?: JsonValue
}

export interface Report {
  tool: 'JSON Diff'
  generatedAt: string
  arrayComparison: 'by-index'
  summary: DiffSummary
  differences: ReportDifference[]
}

function toReportDifference(d: Difference): ReportDifference {
  switch (d.kind) {
    case 'added':
      return { type: d.kind, path: d.path, modified: d.modified }
    case 'removed':
      return { type: d.kind, path: d.path, original: d.original }
    default:
      return { type: d.kind, path: d.path, original: d.original, modified: d.modified }
  }
}

/** The only place the report schema is defined. Contains every difference, not a filtered view. */
export function buildReport(result: DiffResult, now: Date = new Date()): Report {
  return {
    tool: 'JSON Diff',
    generatedAt: now.toISOString(),
    arrayComparison: 'by-index',
    summary: { ...result.summary },
    differences: result.differences.map(toReportDifference),
  }
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** e.g. `json-diff-report-20260102-030405.json` (local time). */
export function reportFileName(now: Date = new Date()): string {
  const date = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  return `json-diff-report-${date}-${time}.json`
}

/** Saves `data` as a pretty-printed JSON file, entirely locally, via a Blob object URL. */
export function downloadJson(fileName: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    link.remove()
  } finally {
    URL.revokeObjectURL(url)
  }
}
