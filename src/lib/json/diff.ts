import { getJsonType } from './jsonType'
import { appendIndex, appendKey, formatPath } from './path'
import type { DiffResult, DiffSummary, Difference, JsonValue, PathSegment } from './types'

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key)

function added(segments: PathSegment[], modified: JsonValue): Difference {
  return {
    kind: 'added',
    path: formatPath(segments),
    segments,
    modified,
    modifiedType: getJsonType(modified),
  }
}

function removed(segments: PathSegment[], original: JsonValue): Difference {
  return {
    kind: 'removed',
    path: formatPath(segments),
    segments,
    original,
    originalType: getJsonType(original),
  }
}

function walk(a: JsonValue, b: JsonValue, segments: PathSegment[], out: Difference[]): void {
  const ta = getJsonType(a)
  const tb = getJsonType(b)

  if (ta !== tb) {
    out.push({
      kind: 'type-changed',
      path: formatPath(segments),
      segments,
      original: a,
      modified: b,
      originalType: ta,
      modifiedType: tb,
    })
    return
  }

  if (Array.isArray(a) && Array.isArray(b)) {
    const common = Math.min(a.length, b.length)
    for (let i = 0; i < common; i++) walk(a[i], b[i], appendIndex(segments, i), out)
    for (let i = common; i < b.length; i++) out.push(added(appendIndex(segments, i), b[i]))
    for (let i = common; i < a.length; i++) out.push(removed(appendIndex(segments, i), a[i]))
    return
  }

  if (ta === 'object') {
    const objA = a as { [key: string]: JsonValue }
    const objB = b as { [key: string]: JsonValue }
    for (const key of Object.keys(objA)) {
      const next = appendKey(segments, key)
      if (hasOwn(objB, key)) walk(objA[key], objB[key], next, out)
      else out.push(removed(next, objA[key]))
    }
    for (const key of Object.keys(objB)) {
      if (!hasOwn(objA, key)) out.push(added(appendKey(segments, key), objB[key]))
    }
    return
  }

  // Primitives of the same type. `-0 === 0`, so they compare equal.
  if (a !== b) {
    out.push({
      kind: 'modified',
      path: formatPath(segments),
      segments,
      original: a,
      modified: b,
      originalType: ta,
      modifiedType: tb,
    })
  }
}

function summarize(differences: readonly Difference[]): DiffSummary {
  const summary: DiffSummary = { total: 0, added: 0, removed: 0, modified: 0, typeChanged: 0 }
  for (const d of differences) {
    switch (d.kind) {
      case 'added':
        summary.added++
        break
      case 'removed':
        summary.removed++
        break
      case 'modified':
        summary.modified++
        break
      case 'type-changed':
        summary.typeChanged++
        break
    }
  }
  summary.total = summary.added + summary.removed + summary.modified + summary.typeChanged
  return summary
}

/**
 * Structural comparison of two JSON values. Arrays compare by index, object key order is
 * ignored. Output order is deterministic: document order, with added keys after the original's
 * keys at each level.
 */
export function compare(original: JsonValue, modified: JsonValue): DiffResult {
  const differences: Difference[] = []
  walk(original, modified, [], differences)
  return { differences, summary: summarize(differences) }
}
