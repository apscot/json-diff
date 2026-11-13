import type { PathSegment } from './types'

export interface TextRange {
  /** Offset of the first character of the value. */
  from: number
  /** Offset just past the last character of the value. */
  to: number
}

class ScanError extends Error {}

const NUMBER = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/y
const LITERALS = ['true', 'false', 'null']
const SIMPLE_ESCAPES = new Map([
  ['"', '"'],
  ['\\', '\\'],
  ['/', '/'],
  ['b', '\b'],
  ['f', '\f'],
  ['n', '\n'],
  ['r', '\r'],
  ['t', '\t'],
])
const HEX4 = /^[0-9a-fA-F]{4}$/

/** Result of scanning one value: its own range and, unless skipping, the range that was asked for. */
interface Scanned {
  range: TextRange
  hit: TextRange | undefined
}

/** `segIndex` value meaning "skip this value, nothing inside it is being looked for". */
const SKIP = -1

/**
 * Finds the text range of the value at `segments` (object keys as strings, array indexes as
 * numbers) with a single pass over `text`.
 *
 * If the target does not exist (a key or index missing from this document, or a segment that
 * does not fit the value's type), the range of the nearest existing ancestor is returned.
 * Duplicate keys resolve like `JSON.parse`: the last one wins. Returns `null` only when `text`
 * is not valid JSON.
 */
export function locatePath(text: string, segments: readonly PathSegment[]): TextRange | null {
  let pos = 0

  const fail = (): never => {
    throw new ScanError()
  }

  const skipWhitespace = (): void => {
    for (;;) {
      const ch = text[pos]
      if (ch !== ' ' && ch !== '\n' && ch !== '\r' && ch !== '\t') return
      pos++
    }
  }

  const expect = (ch: string): void => {
    if (text[pos] !== ch) fail()
    pos++
  }

  /** Reads a string starting at the opening quote and returns its decoded content. */
  const readString = (): string => {
    pos++ // opening quote
    let out = ''
    let chunkStart = pos
    for (;;) {
      if (pos >= text.length) fail()
      const code = text.charCodeAt(pos)
      if (code === 0x22) break
      if (code < 0x20) fail()
      if (code !== 0x5c) {
        pos++
        continue
      }
      out += text.slice(chunkStart, pos)
      const esc = text[pos + 1]
      if (esc === 'u') {
        const hex = text.slice(pos + 2, pos + 6)
        if (!HEX4.test(hex)) fail()
        out += String.fromCharCode(parseInt(hex, 16))
        pos += 6
      } else {
        const simple = esc === undefined ? undefined : SIMPLE_ESCAPES.get(esc)
        if (simple === undefined) fail()
        else out += simple
        pos += 2
      }
      chunkStart = pos
    }
    out += text.slice(chunkStart, pos)
    pos++ // closing quote
    return out
  }

  const readScalar = (): void => {
    if (text[pos] === '"') {
      readString()
      return
    }
    for (const literal of LITERALS) {
      if (text.startsWith(literal, pos)) {
        pos += literal.length
        return
      }
    }
    NUMBER.lastIndex = pos
    const match = NUMBER.exec(text)
    if (!match) fail()
    else pos += match[0].length
  }

  /** Scans the members of a container whose opening bracket is already consumed. */
  const readMembers = (
    close: string,
    segIndex: number,
    isTarget: (memberKey: string | number) => boolean,
    hasKeys: boolean,
  ): TextRange | undefined => {
    let matched: TextRange | undefined
    skipWhitespace()
    if (text[pos] === close) {
      pos++
      return undefined
    }
    for (let index = 0; ; index++) {
      skipWhitespace()
      let memberKey: string | number = index
      if (hasKeys) {
        if (text[pos] !== '"') fail()
        memberKey = readString()
        skipWhitespace()
        expect(':')
      }
      if (segIndex !== SKIP && isTarget(memberKey)) {
        // A later duplicate key replaces an earlier match, as in JSON.parse.
        matched = readValue(segIndex + 1).hit
      } else {
        readValue(SKIP)
      }
      skipWhitespace()
      if (text[pos] === ',') {
        pos++
        continue
      }
      expect(close)
      return matched
    }
  }

  const readValue = (segIndex: number): Scanned => {
    skipWhitespace()
    const from = pos
    const segment = segIndex !== SKIP && segIndex < segments.length ? segments[segIndex] : undefined
    let matched: TextRange | undefined

    if (text[pos] === '{') {
      pos++
      matched = readMembers('}', segIndex, (key) => typeof segment === 'string' && key === segment, true)
    } else if (text[pos] === '[') {
      pos++
      matched = readMembers(']', segIndex, (key) => typeof segment === 'number' && key === segment, false)
    } else {
      readScalar()
    }

    const range = { from, to: pos }
    // The target itself, or (when it is missing) the nearest ancestor that exists.
    return { range, hit: segIndex === SKIP ? undefined : (matched ?? range) }
  }

  try {
    const { hit } = readValue(0)
    skipWhitespace()
    if (pos < text.length) fail()
    return hit ?? null
  } catch (error) {
    // RangeError: nesting so deep that the scanner's own recursion overflowed.
    if (error instanceof ScanError || error instanceof RangeError) return null
    throw error
  }
}
