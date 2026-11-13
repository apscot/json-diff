import type { JsonValue } from './types'

export type ParseError =
  | { kind: 'empty' }
  | { kind: 'syntax'; message: string; line: number; column: number }

export type ParseResult = { ok: true; value: JsonValue } | { ok: false; error: ParseError }

export type IndentOption = 2 | 4 | 'tab'

/** Converts a 0-based offset into a 1-based line and column. Only `\n` ends a line. */
function offsetToLineColumn(text: string, offset: number): { line: number; column: number } {
  const end = Math.max(0, Math.min(offset, text.length))
  let line = 1
  let lineStart = 0
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++
      lineStart = i + 1
    }
  }
  return { line, column: end - lineStart + 1 }
}

type Step = { ok: true; end: number } | { ok: false; at: number }

function isDigit(c: string | undefined): boolean {
  return c !== undefined && c >= '0' && c <= '9'
}

function isHex(c: string | undefined): boolean {
  return c !== undefined && /^[0-9a-fA-F]$/.test(c)
}

/** `start` points at the opening quote. */
function scanString(text: string, start: number): Step {
  let i = start + 1
  for (;;) {
    if (i >= text.length) return { ok: false, at: text.length }
    const c = text[i]
    if (c === '"') return { ok: true, end: i + 1 }
    if (c.charCodeAt(0) < 0x20) return { ok: false, at: i }
    if (c === '\\') {
      const e = text[i + 1]
      if (e === undefined) return { ok: false, at: text.length }
      if ('"\\/bfnrt'.includes(e)) {
        i += 2
      } else if (e === 'u') {
        for (let k = 2; k < 6; k++) {
          if (!isHex(text[i + k])) return { ok: false, at: Math.min(i + k, text.length) }
        }
        i += 6
      } else {
        return { ok: false, at: i + 1 }
      }
    } else {
      i++
    }
  }
}

function scanNumber(text: string, start: number): Step {
  let i = start
  if (text[i] === '-') i++
  if (text[i] === '0') {
    i++
  } else if (isDigit(text[i])) {
    while (isDigit(text[i])) i++
  } else {
    return { ok: false, at: i }
  }
  if (text[i] === '.') {
    i++
    if (!isDigit(text[i])) return { ok: false, at: i }
    while (isDigit(text[i])) i++
  }
  if (text[i] === 'e' || text[i] === 'E') {
    i++
    if (text[i] === '+' || text[i] === '-') i++
    if (!isDigit(text[i])) return { ok: false, at: i }
    while (isDigit(text[i])) i++
  }
  return { ok: true, end: i }
}

function scanLiteral(text: string, start: number, word: string): Step {
  for (let k = 0; k < word.length; k++) {
    if (text[start + k] !== word[k]) return { ok: false, at: Math.min(start + k, text.length) }
  }
  return { ok: true, end: start + word.length }
}

type Mode = 'value' | 'arrayFirst' | 'objectFirst' | 'key' | 'colon' | 'after'

/**
 * A small strict-JSON (RFC 8259) scanner. Returns the 0-based offset of the first
 * character that makes the text invalid, or null when the text is valid.
 * Iterative, so deeply nested input cannot overflow the call stack.
 */
export function findSyntaxErrorOffset(text: string): number | null {
  const stack: Array<'{' | '['> = []
  const n = text.length
  let i = 0
  let mode: Mode = 'value'

  const fail = (step: Step): number | null => (step.ok ? null : step.at)

  for (;;) {
    while (i < n && (text[i] === ' ' || text[i] === '\t' || text[i] === '\n' || text[i] === '\r')) i++
    if (i >= n) return mode === 'after' && stack.length === 0 ? null : n
    const c = text[i]

    switch (mode) {
      case 'arrayFirst':
        if (c === ']') {
          stack.pop()
          i++
          mode = 'after'
          break
        }
        mode = 'value'
        continue
      case 'objectFirst':
        if (c === '}') {
          stack.pop()
          i++
          mode = 'after'
          break
        }
        mode = 'key'
        continue
      case 'key': {
        if (c !== '"') return i
        const step = scanString(text, i)
        if (!step.ok) return fail(step)
        i = step.end
        mode = 'colon'
        break
      }
      case 'colon':
        if (c !== ':') return i
        i++
        mode = 'value'
        break
      case 'value': {
        let step: Step
        if (c === '{' || c === '[') {
          stack.push(c)
          i++
          mode = c === '{' ? 'objectFirst' : 'arrayFirst'
          break
        } else if (c === '"') {
          step = scanString(text, i)
        } else if (c === '-' || isDigit(c)) {
          step = scanNumber(text, i)
        } else if (c === 't') {
          step = scanLiteral(text, i, 'true')
        } else if (c === 'f') {
          step = scanLiteral(text, i, 'false')
        } else if (c === 'n') {
          step = scanLiteral(text, i, 'null')
        } else {
          return i
        }
        if (!step.ok) return step.at
        i = step.end
        mode = 'after'
        break
      }
      case 'after': {
        const top = stack[stack.length - 1]
        if (top === undefined) return i // trailing content after the root value
        if (c === ',') {
          i++
          mode = top === '{' ? 'key' : 'value'
        } else if (c === (top === '{' ? '}' : ']')) {
          stack.pop()
          i++
        } else {
          return i
        }
        break
      }
    }
  }
}

function syntaxError(text: string, error: unknown): ParseError {
  const message = error instanceof Error ? error.message : String(error)

  const lineCol = /line (\d+) column (\d+)/.exec(message)
  if (lineCol) {
    return { kind: 'syntax', message, line: Number(lineCol[1]), column: Number(lineCol[2]) }
  }

  const position = /position (\d+)/.exec(message)
  const offset = position ? Number(position[1]) : (findSyntaxErrorOffset(text) ?? 0)
  return { kind: 'syntax', message, ...offsetToLineColumn(text, offset) }
}

/** Parses JSON text. Never throws: invalid and empty input are returned as errors. */
export function parseJson(text: string): ParseResult {
  if (text.trim() === '') return { ok: false, error: { kind: 'empty' } }
  try {
    return { ok: true, value: JSON.parse(text) as JsonValue }
  } catch (error) {
    return { ok: false, error: syntaxError(text, error) }
  }
}

export function formatJson(value: JsonValue, indent: IndentOption): string {
  return JSON.stringify(value, null, indent === 'tab' ? '\t' : indent)
}

export function minifyJson(value: JsonValue): string {
  return JSON.stringify(value)
}
