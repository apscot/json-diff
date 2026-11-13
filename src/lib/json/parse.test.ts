import { describe, expect, it } from 'vitest'
import { getJsonType } from './jsonType'
import { findSyntaxErrorOffset, formatJson, minifyJson, parseJson } from './parse'
import type { JsonValue } from './types'

function syntaxError(text: string) {
  const result = parseJson(text)
  if (result.ok || result.error.kind !== 'syntax') throw new Error('expected a syntax error')
  return result.error
}

describe('getJsonType', () => {
  it('checks null and arrays before object', () => {
    expect(getJsonType(null)).toBe('null')
    expect(getJsonType([])).toBe('array')
    expect(getJsonType({})).toBe('object')
    expect(getJsonType('x')).toBe('string')
    expect(getJsonType(1)).toBe('number')
    expect(getJsonType(true)).toBe('boolean')
  })
})

describe('parseJson', () => {
  it('parses valid objects and arrays', () => {
    expect(parseJson('{"a":[1,2,{"b":null}]}')).toEqual({ ok: true, value: { a: [1, 2, { b: null }] } })
  })

  it('parses top-level primitives', () => {
    expect(parseJson('42')).toEqual({ ok: true, value: 42 })
    expect(parseJson('"hi"')).toEqual({ ok: true, value: 'hi' })
    expect(parseJson('true')).toEqual({ ok: true, value: true })
    expect(parseJson('false')).toEqual({ ok: true, value: false })
    expect(parseJson('null')).toEqual({ ok: true, value: null })
    expect(parseJson('  -1.5e3 \n')).toEqual({ ok: true, value: -1500 })
  })

  it('reports empty and whitespace-only input as empty', () => {
    expect(parseJson('')).toEqual({ ok: false, error: { kind: 'empty' } })
    expect(parseJson('  \n\t ')).toEqual({ ok: false, error: { kind: 'empty' } })
  })

  it('reports line and column for a trailing comma', () => {
    const error = syntaxError('{"a":1,}')
    expect(error.line).toBe(1)
    expect(error.column).toBe(8)
    expect(error.message).not.toBe('')
  })

  it('reports line and column on later lines', () => {
    const error = syntaxError('{\n  "a": 1,\n  "b": oops\n}')
    expect(error.line).toBe(3)
    expect(error.column).toBe(8)
  })

  it('reports the end of input for truncated documents', () => {
    expect(syntaxError('[1,2')).toMatchObject({ line: 1, column: 5 })
    expect(syntaxError('{\n  "a": 1')).toMatchObject({ line: 2, column: 9 })
  })

  it('reports an unexpected first character', () => {
    expect(syntaxError('abc')).toMatchObject({ line: 1, column: 1 })
  })

  it('reports trailing content after the root value', () => {
    expect(syntaxError('{} x')).toMatchObject({ line: 1, column: 4 })
  })

  it('reports single-quoted strings', () => {
    expect(syntaxError("{'a': 1}")).toMatchObject({ line: 1, column: 2 })
  })

  it('never throws, even for odd input', () => {
    for (const text of ['\u0000', '{', '}', '"', '"\\', '[[[[', '1e', '-', 'nul', '\u2028']) {
      expect(() => parseJson(text)).not.toThrow()
    }
  })

  it('handles very deeply nested input without throwing', () => {
    const text = '['.repeat(200000)
    expect(() => parseJson(text)).not.toThrow()
    expect(parseJson(text).ok).toBe(false)
  })
})

describe('findSyntaxErrorOffset (fallback scanner)', () => {
  const cases: Array<[string, number | null]> = [
    ['{"a":1}', null],
    ['[]', null],
    ['{}', null],
    ['[1, [2, {"a": "b\\n\\u00e9\\"x"}], -0.5E+2, true, false, null]', null],
    ['{"a":1,}', 7],
    ['[1,]', 3],
    ['[1 2]', 3],
    ['{"a" 1}', 5],
    ['{"a":1 "b":2}', 7],
    ['{1:2}', 1],
    ['{"a":1]', 6],
    ['[1}', 2],
    ['{} {}', 3],
    ['', 0],
    ['[1,2', 4],
    ['"abc', 4],
    ['"a\nb"', 2],
    ['"a\\x"', 3],
    ['"a\\', 3],
    ['"\\u12G4"', 5],
    ['"\\u12', 5],
    ['01', 1],
    ['-', 1],
    ['-x', 1],
    ['1.', 2],
    ['1.x', 2],
    ['1e', 2],
    ['1e+', 3],
    ['tru', 3],
    ['trux', 3],
    ['nul', 3],
    ['fals', 4],
    ['undefined', 0],
    ['[,1]', 1],
  ]

  it.each(cases)('%j -> %s', (text, expected) => {
    expect(findSyntaxErrorOffset(text)).toBe(expected)
  })

  it('agrees with JSON.parse on validity', () => {
    for (const [text, expected] of cases) {
      let valid = true
      try {
        JSON.parse(text)
      } catch {
        valid = false
      }
      expect(findSyntaxErrorOffset(text) === null, text).toBe(valid)
      expect(expected === null, text).toBe(valid)
    }
  })

  it('matches the engine position when the engine reports one', () => {
    for (const text of ['{"a":1,}', '[1 2]', '{"a" 1}', '{} x', '{\n "a": tru\n}']) {
      const error = syntaxError(text)
      const offset = findSyntaxErrorOffset(text) ?? -1
      const before = text.slice(0, offset)
      expect(error.line, text).toBe(before.split('\n').length)
      expect(error.column, text).toBe(offset - (before.lastIndexOf('\n') + 1) + 1)
    }
  })
})

describe('formatJson / minifyJson', () => {
  const value: JsonValue = { a: [1, 2, { b: null }], c: 'x', d: {} }

  it('formats with 2 spaces, 4 spaces and tabs', () => {
    expect(formatJson({ a: [1] }, 2)).toBe('{\n  "a": [\n    1\n  ]\n}')
    expect(formatJson({ a: 1 }, 4)).toBe('{\n    "a": 1\n}')
    expect(formatJson({ a: 1 }, 'tab')).toBe('{\n\t"a": 1\n}')
  })

  it('minifies without whitespace', () => {
    expect(minifyJson(value)).toBe('{"a":[1,2,{"b":null}],"c":"x","d":{}}')
  })

  it('round-trips through format and minify', () => {
    for (const indent of [2, 4, 'tab'] as const) {
      const formatted = parseJson(formatJson(value, indent))
      expect(formatted).toEqual({ ok: true, value })
      const minified = parseJson(minifyJson(value))
      expect(minified).toEqual({ ok: true, value })
      if (formatted.ok) expect(minifyJson(formatted.value)).toBe(minifyJson(value))
    }
  })

  it('round-trips top-level primitives', () => {
    for (const primitive of [0, -1.5, 'a "q"', true, false, null] as const) {
      expect(parseJson(formatJson(primitive, 2))).toEqual({ ok: true, value: primitive })
      expect(parseJson(minifyJson(primitive))).toEqual({ ok: true, value: primitive })
    }
  })

  it('keeps a __proto__ key as own data', () => {
    const parsed = parseJson('{"__proto__": {"x": 1}}')
    expect(parsed.ok).toBe(true)
    if (parsed.ok) expect(minifyJson(parsed.value)).toBe('{"__proto__":{"x":1}}')
  })
})
