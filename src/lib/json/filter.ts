import type { DiffKind, Difference, JsonValue } from './types'

export interface DiffFilter {
  /** An empty set means "all kinds". */
  kinds: ReadonlySet<DiffKind>
  query: string
}

/** Values are cut to this many characters before matching. */
export const MATCH_TEXT_LIMIT = 500

function matchText(value: JsonValue): string {
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  return text.length > MATCH_TEXT_LIMIT ? text.slice(0, MATCH_TEXT_LIMIT) : text
}

function lastSegmentName(difference: Difference): string {
  const last = difference.segments[difference.segments.length - 1]
  return last === undefined ? '' : String(last)
}

function matchesQuery(difference: Difference, needle: string): boolean {
  if (lastSegmentName(difference).toLowerCase().includes(needle)) return true
  if (difference.path.toLowerCase().includes(needle)) return true
  if (difference.kind !== 'added' && matchText(difference.original).toLowerCase().includes(needle)) {
    return true
  }
  return (
    difference.kind !== 'removed' && matchText(difference.modified).toLowerCase().includes(needle)
  )
}

/**
 * Filters differences by kind and by a case-insensitive substring query. The query is matched
 * against the property name (last segment), the path and the stringified values.
 */
export function filterDifferences(
  differences: readonly Difference[],
  { kinds, query }: DiffFilter,
): Difference[] {
  const needle = query.trim().toLowerCase()
  if (kinds.size === 0 && needle === '') return [...differences]
  return differences.filter(
    (d) => (kinds.size === 0 || kinds.has(d.kind)) && (needle === '' || matchesQuery(d, needle)),
  )
}
