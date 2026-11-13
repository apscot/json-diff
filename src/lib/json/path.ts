import type { PathSegment } from './types'

const IDENTIFIER = /^[A-Za-z_$][A-Za-z0-9_$]*$/

export function appendKey(segments: readonly PathSegment[], key: string): PathSegment[] {
  return [...segments, key]
}

export function appendIndex(segments: readonly PathSegment[], index: number): PathSegment[] {
  return [...segments, index]
}

function formatSegment(segment: PathSegment): string {
  if (typeof segment === 'number') return `[${segment}]`
  if (IDENTIFIER.test(segment)) return `.${segment}`
  return `['${segment.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}']`
}

/** The only place JSONPath strings are built. The root is `$`. */
export function formatPath(segments: readonly PathSegment[]): string {
  let out = '$'
  for (const segment of segments) out += formatSegment(segment)
  return out
}
