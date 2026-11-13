import { describe, expect, it } from 'vitest'
import { appendIndex, appendKey, formatPath } from './path'

describe('formatPath', () => {
  it('formats the root as $', () => {
    expect(formatPath([])).toBe('$')
  })

  it('uses dot notation for identifier keys', () => {
    expect(formatPath(['user'])).toBe('$.user')
    expect(formatPath(['user', 'first_name', '$id', '_x1'])).toBe('$.user.first_name.$id._x1')
  })

  it('uses bracket notation for keys with dots', () => {
    expect(formatPath(['a.b'])).toBe("$['a.b']")
  })

  it('uses bracket notation for keys with spaces', () => {
    expect(formatPath(['first name'])).toBe("$['first name']")
  })

  it('escapes single quotes and backslashes', () => {
    expect(formatPath(["it's"])).toBe("$['it\\'s']")
    expect(formatPath(['a\\b'])).toBe("$['a\\\\b']")
    expect(formatPath(["\\'"])).toBe("$['\\\\\\'']")
  })

  it('leaves double quotes unescaped inside brackets', () => {
    expect(formatPath(['say "hi"'])).toBe(`$['say "hi"']`)
  })

  it('uses bracket notation for keys with a leading digit', () => {
    expect(formatPath(['1abc'])).toBe("$['1abc']")
    expect(formatPath(['123'])).toBe("$['123']")
  })

  it('uses bracket notation for the empty key and other symbols', () => {
    expect(formatPath([''])).toBe("$['']")
    expect(formatPath(['a-b'])).toBe("$['a-b']")
  })

  it('formats numeric segments as indexes', () => {
    expect(formatPath([0])).toBe('$[0]')
    expect(formatPath(['items', 2, 'name'])).toBe('$.items[2].name')
    expect(formatPath([1, 2])).toBe('$[1][2]')
  })

  it('distinguishes a numeric string key from an index', () => {
    expect(formatPath(['0'])).toBe("$['0']")
    expect(formatPath([0])).toBe('$[0]')
  })

  it('handles special keys safely', () => {
    expect(formatPath(['__proto__'])).toBe('$.__proto__')
    expect(formatPath(['constructor'])).toBe('$.constructor')
  })

  it('combines a mix of segments', () => {
    expect(formatPath(['user', 'items', 2, 'a.b'])).toBe("$.user.items[2]['a.b']")
  })
})

describe('appendKey / appendIndex', () => {
  it('return new arrays and do not mutate the input', () => {
    const base = ['a']
    const withKey = appendKey(base, 'b')
    const withIndex = appendIndex(withKey, 3)
    expect(base).toEqual(['a'])
    expect(withKey).toEqual(['a', 'b'])
    expect(withIndex).toEqual(['a', 'b', 3])
    expect(formatPath(withIndex)).toBe('$.a.b[3]')
  })
})
