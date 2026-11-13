import { describe, expect, it } from 'vitest'
import { locatePath } from './locate'

const DOC = `{
  "name": "Ada",
  "n": -1.5e3,
  "ok": true,
  "none": null,
  "list": [10, {"deep": "x"}, [1, 2]],
  "empty": {},
  "emptyList": []
}`

function slice(text: string, segments: (string | number)[]): string | null {
  const r = locatePath(text, segments)
  return r ? text.slice(r.from, r.to) : null
}

describe('locatePath: exact matches', () => {
  it('returns the whole document for empty segments', () => {
    expect(locatePath(DOC, [])).toEqual({ from: 0, to: DOC.length })
  })

  it('ignores surrounding whitespace for the root', () => {
    const text = '  \n [1] \t'
    expect(slice(text, [])).toBe('[1]')
  })

  it('finds scalars of every type', () => {
    expect(slice(DOC, ['name'])).toBe('"Ada"')
    expect(slice(DOC, ['n'])).toBe('-1.5e3')
    expect(slice(DOC, ['ok'])).toBe('true')
    expect(slice(DOC, ['none'])).toBe('null')
    expect(slice('false', [])).toBe('false')
  })

  it('finds containers including empty ones', () => {
    expect(slice(DOC, ['empty'])).toBe('{}')
    expect(slice(DOC, ['emptyList'])).toBe('[]')
    expect(slice(DOC, ['list', 2])).toBe('[1, 2]')
  })

  it('finds nested values through arrays and objects', () => {
    expect(slice(DOC, ['list', 0])).toBe('10')
    expect(slice(DOC, ['list', 1, 'deep'])).toBe('"x"')
    expect(slice(DOC, ['list', 2, 1])).toBe('2')
  })

  it('does not match key text inside string values', () => {
    const text = '{"a": "\\"b\\": 1", "b": 2}'
    expect(slice(text, ['b'])).toBe('2')
  })

  it('decodes escaped keys', () => {
    expect(slice('{"a\\nb": 1, "\\u0041": 2, "q\\"\\\\\\/\\b\\f\\r\\t": 3}', ['a\nb'])).toBe('1')
    expect(slice('{"\\u0041": 2}', ['A'])).toBe('2')
    expect(slice('{"q\\"\\\\\\/\\b\\f\\r\\t": 3}', ['q"\\/\b\f\r\t'])).toBe('3')
  })

  it('lets the last duplicate key win like JSON.parse', () => {
    expect(slice('{"a": 1, "a": 2}', ['a'])).toBe('2')
  })

  it('treats __proto__ as an ordinary key', () => {
    expect(slice('{"__proto__": {"x": 1}}', ['__proto__', 'x'])).toBe('1')
  })

  it('does not confuse numeric strings with array indexes', () => {
    expect(slice('{"0": "k", "z": 1}', ['0'])).toBe('"k"')
    expect(slice('["a", "b"]', ['1'])).toBe('["a", "b"]')
    expect(slice('{"1": "k"}', [1])).toBe('{"1": "k"}')
  })
})

describe('locatePath: ancestor fallback', () => {
  it('falls back to the object when a key is missing', () => {
    expect(slice(DOC, ['missing'])).toBe(DOC)
  })

  it('falls back to the nearest existing ancestor', () => {
    expect(slice(DOC, ['list', 1, 'nope'])).toBe('{"deep": "x"}')
    expect(slice(DOC, ['list', 1, 'nope', 'deeper'])).toBe('{"deep": "x"}')
  })

  it('falls back to the array when an index is out of range', () => {
    expect(slice(DOC, ['list', 7])).toBe('[10, {"deep": "x"}, [1, 2]]')
    expect(slice(DOC, ['emptyList', 0])).toBe('[]')
    expect(slice(DOC, ['empty', 'k'])).toBe('{}')
  })

  it('falls back to a scalar when segments continue past it', () => {
    expect(slice(DOC, ['name', 'x'])).toBe('"Ada"')
    expect(slice(DOC, ['name', 0])).toBe('"Ada"')
  })

  it('falls back when the segment type does not fit the container', () => {
    expect(slice(DOC, ['list', 'a'])).toBe('[10, {"deep": "x"}, [1, 2]]')
    expect(slice(DOC, [0])).toBe(DOC)
  })

  it('falls back to the root scalar document', () => {
    expect(slice('42', ['a'])).toBe('42')
  })
})

describe('locatePath: invalid text', () => {
  const bad = [
    '',
    '   ',
    '{',
    '[1,',
    '[1 2]',
    '{"a" 1}',
    '{"a": }',
    '{a: 1}',
    '{"a": 1,}',
    '[1,]',
    '{"a": 1} x',
    '"unterminated',
    '"bad \\x escape"',
    '"bad \\u12G4"',
    '"trail\\',
    '"tab\there"',
    '01',
    '-',
    '1.',
    'tru',
    '{"a": 1 "b": 2}',
    '{1: 2}',
  ]
  for (const text of bad) {
    it(`returns null for ${JSON.stringify(text)}`, () => {
      expect(locatePath(text, [])).toBeNull()
      expect(locatePath(text, ['a'])).toBeNull()
    })
  }

  it('returns null when invalid text is after the located value', () => {
    expect(locatePath('{"a": 1, "b": @}', ['a'])).toBeNull()
  })

  it('returns null for absurdly deep nesting instead of throwing', () => {
    const deep = '['.repeat(200000) + ']'.repeat(200000)
    expect(locatePath(deep, [0])).toBeNull()
  })
})
