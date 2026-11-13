import { describe, expect, it } from 'vitest'
import { compare } from './diff'
import { parseJson } from './parse'
import type { JsonValue } from './types'
import {
  countNodes,
  generateIdenticalPair,
  generateLargeDoc,
  generateLargePair,
} from '@/test/fixtures'

function parse(text: string): JsonValue {
  const result = parseJson(text)
  if (!result.ok) throw new Error(`fixture is not valid JSON: ${text}`)
  return result.value
}

describe('compare: identical and primitives', () => {
  it('reports nothing for identical documents', () => {
    const doc = { a: 1, b: [1, 'x', { c: null }], d: { e: true } }
    const result = compare(doc, structuredClone(doc))
    expect(result.differences).toEqual([])
    expect(result.summary).toEqual({ total: 0, added: 0, removed: 0, modified: 0, typeChanged: 0 })
  })

  it('treats -0 and 0 as equal', () => {
    expect(compare(-0, 0).differences).toEqual([])
    expect(compare({ n: [-0] }, { n: [0] }).differences).toEqual([])
  })

  it('reports modified primitives at the root path $', () => {
    const { differences } = compare(1, 2)
    expect(differences).toEqual([
      {
        kind: 'modified',
        path: '$',
        segments: [],
        original: 1,
        modified: 2,
        originalType: 'number',
        modifiedType: 'number',
      },
    ])
  })

  it('handles every top-level primitive', () => {
    expect(compare('a', 'a').differences).toEqual([])
    expect(compare('a', 'b').differences[0]).toMatchObject({ kind: 'modified', path: '$' })
    expect(compare(true, false).differences[0]).toMatchObject({ kind: 'modified', path: '$' })
    expect(compare(null, null).differences).toEqual([])
    expect(compare(1, 'a').differences[0]).toMatchObject({ kind: 'type-changed', path: '$' })
    expect(compare([], {}).differences[0]).toMatchObject({ kind: 'type-changed', path: '$' })
  })
})

describe('compare: objects', () => {
  it('reports an added key without original fields', () => {
    const { differences, summary } = compare({ a: 1 }, { a: 1, b: 'new' })
    expect(differences).toEqual([
      { kind: 'added', path: '$.b', segments: ['b'], modified: 'new', modifiedType: 'string' },
    ])
    expect(Object.prototype.hasOwnProperty.call(differences[0], 'original')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(differences[0], 'originalType')).toBe(false)
    expect(summary).toEqual({ total: 1, added: 1, removed: 0, modified: 0, typeChanged: 0 })
  })

  it('reports a removed key without modified fields', () => {
    const { differences, summary } = compare({ a: 1, b: 2 }, { a: 1 })
    expect(differences).toEqual([
      { kind: 'removed', path: '$.b', segments: ['b'], original: 2, originalType: 'number' },
    ])
    expect(Object.prototype.hasOwnProperty.call(differences[0], 'modified')).toBe(false)
    expect(Object.prototype.hasOwnProperty.call(differences[0], 'modifiedType')).toBe(false)
    expect(summary.removed).toBe(1)
    expect(summary.total).toBe(1)
  })

  it('reports a modified value', () => {
    const { differences, summary } = compare({ age: 25 }, { age: 26 })
    expect(differences).toEqual([
      {
        kind: 'modified',
        path: '$.age',
        segments: ['age'],
        original: 25,
        modified: 26,
        originalType: 'number',
        modifiedType: 'number',
      },
    ])
    expect(summary.modified).toBe(1)
  })

  it('reports nested differences with full paths', () => {
    const a = { user: { name: 'A', address: { city: 'X', zip: '1' }, old: true } }
    const b = { user: { name: 'B', address: { city: 'X', zip: '1', geo: { lat: 1 } } } }
    const { differences } = compare(a, b)
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['modified', '$.user.name'],
      ['added', '$.user.address.geo'],
      ['removed', '$.user.old'],
    ])
  })

  it('reports a whole added subtree once, at its root', () => {
    const { differences, summary } = compare({}, { a: { b: [1, 2, { c: 3 }] } })
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'added', path: '$.a', modifiedType: 'object' })
    expect(summary.total).toBe(1)
  })

  it('reports a whole removed subtree once, at its root', () => {
    const { differences } = compare({ a: { b: [1, 2, { c: 3 }] } }, {})
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'removed', path: '$.a', originalType: 'object' })
  })

  it('escapes unusual keys in paths and keeps segments', () => {
    const { differences } = compare({ 'a.b': 1, 'it\'s': 1, '1x': 1 }, { 'a.b': 2, 'it\'s': 2, '1x': 2 })
    expect(differences.map((d) => d.path)).toEqual(["$['a.b']", "$['it\\'s']", "$['1x']"])
    expect(differences[0].segments).toEqual(['a.b'])
  })
})

describe('compare: arrays', () => {
  it('reports added elements at the tail', () => {
    const { differences } = compare([1], [1, 2, 3])
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['added', '$[1]'],
      ['added', '$[2]'],
    ])
    expect(differences[0].segments).toEqual([1])
  })

  it('reports removed elements at the tail', () => {
    const { differences } = compare([1, 2, 3], [1])
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['removed', '$[1]'],
      ['removed', '$[2]'],
    ])
  })

  it('reports modified elements by index', () => {
    const { differences } = compare([1, 2, 3], [1, 9, 3])
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'modified', path: '$[1]', original: 2, modified: 9 })
  })

  it('compares by index, so a shifted array is modified plus a length difference', () => {
    const { differences, summary } = compare([1, 2, 3], [2, 3])
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['modified', '$[0]'],
      ['modified', '$[1]'],
      ['removed', '$[2]'],
    ])
    expect(summary.total).toBe(3)
  })

  it('handles empty arrays on either side', () => {
    expect(compare([], [1]).summary).toEqual({
      total: 1,
      added: 1,
      removed: 0,
      modified: 0,
      typeChanged: 0,
    })
    expect(compare([1], []).summary.removed).toBe(1)
    expect(compare([], []).differences).toEqual([])
  })

  it('reports a whole added array element once', () => {
    const { differences } = compare([[1]], [[1], [2, 3, [4]]])
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'added', path: '$[1]', modifiedType: 'array' })
  })

  it('compares nested arrays', () => {
    const { differences } = compare(
      [[1, 2], [3, [4, 5]], []],
      [[1, 9], [3, [4, 5, 6]], [7]],
    )
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['modified', '$[0][1]'],
      ['added', '$[1][1][2]'],
      ['added', '$[2][0]'],
    ])
  })

  it('compares objects inside arrays', () => {
    const { differences } = compare([{ id: 1, v: 'a' }], [{ id: 1, v: 'b', w: 1 }])
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['modified', '$[0].v'],
      ['added', '$[0].w'],
    ])
  })
})

describe('compare: type changes', () => {
  it('string to number', () => {
    const { differences, summary } = compare({ a: 'x' }, { a: 1 })
    expect(differences).toEqual([
      {
        kind: 'type-changed',
        path: '$.a',
        segments: ['a'],
        original: 'x',
        modified: 1,
        originalType: 'string',
        modifiedType: 'number',
      },
    ])
    expect(summary).toEqual({ total: 1, added: 0, removed: 0, modified: 0, typeChanged: 1 })
  })

  it('number to boolean', () => {
    expect(compare({ a: 1 }, { a: true }).differences[0]).toMatchObject({
      kind: 'type-changed',
      originalType: 'number',
      modifiedType: 'boolean',
    })
  })

  it('object to array, with no child differences', () => {
    const { differences } = compare({ a: { x: 1, y: 2 } }, { a: [1, 2] })
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({
      kind: 'type-changed',
      path: '$.a',
      originalType: 'object',
      modifiedType: 'array',
    })
  })

  it('array to object, with no child differences', () => {
    const { differences } = compare({ a: [1, 2] }, { a: { 0: 1, 1: 2 } })
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({ kind: 'type-changed', originalType: 'array', modifiedType: 'object' })
  })

  it('null to string', () => {
    expect(compare({ a: null }, { a: 'x' }).differences[0]).toMatchObject({
      kind: 'type-changed',
      originalType: 'null',
      modifiedType: 'string',
    })
  })

  it('1 vs "1"', () => {
    const { differences } = compare({ a: 1 }, { a: '1' })
    expect(differences).toHaveLength(1)
    expect(differences[0].kind).toBe('type-changed')
  })

  it('true vs "true"', () => {
    const { differences } = compare({ a: true }, { a: 'true' })
    expect(differences).toHaveLength(1)
    expect(differences[0].kind).toBe('type-changed')
  })

  it('{} vs null and [] vs null', () => {
    expect(compare({ a: {} }, { a: null }).differences[0]).toMatchObject({
      kind: 'type-changed',
      originalType: 'object',
      modifiedType: 'null',
    })
    expect(compare({ a: [] }, { a: null }).differences[0]).toMatchObject({
      kind: 'type-changed',
      originalType: 'array',
      modifiedType: 'null',
    })
    expect(compare({ a: null }, { a: [] }).differences[0].kind).toBe('type-changed')
  })

  it('null vs a missing key is added or removed, not a type change', () => {
    const removedNull = compare({ a: null }, {})
    expect(removedNull.differences).toEqual([
      { kind: 'removed', path: '$.a', segments: ['a'], original: null, originalType: 'null' },
    ])
    const addedNull = compare({}, { a: null })
    expect(addedNull.differences).toEqual([
      { kind: 'added', path: '$.a', segments: ['a'], modified: null, modifiedType: 'null' },
    ])
  })
})

describe('compare: key order and whitespace independence', () => {
  it('ignores object key order at every level', () => {
    const a = { a: 1, b: { x: 1, y: [{ p: 1, q: 2 }] }, c: 3 }
    const b = { c: 3, b: { y: [{ q: 2, p: 1 }], x: 1 }, a: 1 }
    expect(compare(a, b).differences).toEqual([])
  })

  it('still finds differences when key order differs', () => {
    const { differences } = compare({ a: 1, b: 2 }, { b: 3, a: 1 })
    expect(differences.map((d) => d.path)).toEqual(['$.b'])
  })

  it('ignores whitespace and formatting after parseJson', () => {
    const compact = parse('{"a":1,"b":[1,2,{"c":"x"}],"d":null}')
    const pretty = parse(`
      {
        "a" : 1,
        "b" : [ 1,
                2,   { "c" :   "x" } ],
        "d"   : null
      }
    `)
    expect(compare(compact, pretty).differences).toEqual([])
  })

  it('treats 1.0 and 1 as equal numbers once parsed', () => {
    expect(compare(parse('{"a":1.0}'), parse('{"a":1}')).differences).toEqual([])
  })
})

describe('compare: special keys', () => {
  it('handles __proto__ as an ordinary own key', () => {
    const a = parse('{"__proto__":{"x":1},"k":1}')
    const b = parse('{"__proto__":{"x":2},"k":1}')
    const { differences } = compare(a, b)
    expect(differences).toHaveLength(1)
    expect(differences[0]).toMatchObject({
      kind: 'modified',
      path: '$.__proto__.x',
      segments: ['__proto__', 'x'],
      original: 1,
      modified: 2,
    })
  })

  it('reports an added and a removed __proto__ key', () => {
    const withProto = parse('{"__proto__":{"x":1}}')
    const added = compare({}, withProto)
    expect(added.differences).toHaveLength(1)
    expect(added.differences[0]).toMatchObject({ kind: 'added', path: '$.__proto__' })
    const removed = compare(withProto, {})
    expect(removed.differences[0]).toMatchObject({ kind: 'removed', path: '$.__proto__' })
  })

  it('does not treat inherited properties as present keys', () => {
    // `constructor`, `toString` and `hasOwnProperty` exist on every plain object's prototype.
    const { differences } = compare({}, { constructor: 1, toString: 2, hasOwnProperty: 3 })
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['added', '$.constructor'],
      ['added', '$.toString'],
      ['added', '$.hasOwnProperty'],
    ])
    const reverse = compare({ constructor: 1 }, {})
    expect(reverse.differences[0]).toMatchObject({ kind: 'removed', path: '$.constructor' })
  })

  it('compares constructor keys by value', () => {
    const { differences } = compare({ constructor: { a: 1 } }, { constructor: { a: 2 } })
    expect(differences.map((d) => d.path)).toEqual(['$.constructor.a'])
  })

  it('does not pollute Object.prototype', () => {
    compare(parse('{"__proto__":{"polluted":1}}'), parse('{"__proto__":{"polluted":2}}'))
    expect(({} as Record<string, unknown>).polluted).toBeUndefined()
  })
})

describe('compare: ordering and summary', () => {
  it('is deterministic and does not mutate its inputs', () => {
    const a = { z: 1, a: [1, 2], m: { k: 1 }, gone: 1 }
    const b = { a: [1, 3, 4], m: { k: 'x' }, z: 2, fresh: 1, newer: 2 }
    const snapshotA = structuredClone(a)
    const snapshotB = structuredClone(b)
    const first = compare(a, b)
    const second = compare(a, b)
    expect(second).toEqual(first)
    expect(a).toEqual(snapshotA)
    expect(b).toEqual(snapshotB)
  })

  it('orders removed/modified in original key order, then added in modified key order', () => {
    const a = { z: 1, a: 1, m: 1, gone: 1 }
    const b = { fresh: 1, m: 2, a: 2, z: 2, another: 1 }
    const { differences } = compare(a, b)
    expect(differences.map((d) => [d.kind, d.path])).toEqual([
      ['modified', '$.z'],
      ['modified', '$.a'],
      ['modified', '$.m'],
      ['removed', '$.gone'],
      ['added', '$.fresh'],
      ['added', '$.another'],
    ])
  })

  it('counts each kind separately and total equals the sum', () => {
    const a = { keep: 1, mod: 1, rm: 1, tc: 'x', arr: [1, 2, 3] }
    const b = { keep: 1, mod: 2, add: 1, tc: 5, arr: [1, 2] }
    const { differences, summary } = compare(a, b)
    expect(summary).toEqual({ total: 5, added: 1, removed: 2, modified: 1, typeChanged: 1 })
    expect(summary.total).toBe(
      summary.added + summary.removed + summary.modified + summary.typeChanged,
    )
    expect(summary.total).toBe(differences.length)
  })

  it('keeps every difference path equal to its formatted segments', () => {
    const { differences } = compare({ a: [{ 'b c': 1 }] }, { a: [{ 'b c': 2 }] })
    expect(differences[0].path).toBe("$.a[0]['b c']")
    expect(differences[0].segments).toEqual(['a', 0, 'b c'])
  })
})

describe('compare: large documents', () => {
  const RECORDS = 1000

  it('generates a document with more than 10k nodes', () => {
    expect(countNodes(generateLargeDoc(RECORDS))).toBeGreaterThan(10_000)
  })

  it('finds no differences between identical large documents, within a loose time bound', () => {
    const { original, modified } = generateIdenticalPair(RECORDS)
    const start = performance.now()
    const result = compare(original, modified)
    const elapsed = performance.now() - start
    expect(result.differences).toEqual([])
    expect(result.summary.total).toBe(0)
    expect(elapsed).toBeLessThan(5000)
  })

  it('finds exactly the expected differences in a large pair, within a loose time bound', () => {
    const { original, modified, expected } = generateLargePair(RECORDS)
    expect(countNodes(original)).toBeGreaterThan(10_000)
    const start = performance.now()
    const result = compare(original, modified)
    const elapsed = performance.now() - start
    expect(elapsed).toBeLessThan(5000)
    expect(result.summary).toEqual(expected)
    expect(result.summary.total).toBe(result.differences.length)
    expect(result.summary.total).toBeGreaterThan(0)
  })

  it('reports spot-checked paths in a large pair', () => {
    const { original, modified } = generateLargePair(RECORDS)
    const byPath = new Map(compare(original, modified).differences.map((d) => [d.path, d]))
    expect(byPath.get('$.records[0].score')?.kind).toBe('modified')
    expect(byPath.get('$.records[1].active')?.kind).toBe('type-changed')
    expect(byPath.get('$.records[2].tags[3]')?.kind).toBe('added')
    expect(byPath.get('$.records[3].meta.owner')?.kind).toBe('removed')
    expect(byPath.get('$.records[4].extra')?.kind).toBe('added')
    expect(byPath.get(`$.records[${RECORDS}]`)?.kind).toBe('added')
    expect(byPath.get('$.records[5].score')).toBeUndefined()
  })

  it('compares large documents that went through serialisation and parseJson', () => {
    const { original, modified, expected } = generateLargePair(RECORDS)
    const left = parse(JSON.stringify(original, null, 2))
    const right = parse(JSON.stringify(modified))
    expect(compare(left, right).summary).toEqual(expected)
  })

  it('handles a deeply nested document without throwing', () => {
    let a: JsonValue = 1
    let b: JsonValue = 2
    for (let i = 0; i < 500; i++) {
      a = { n: a }
      b = { n: b }
    }
    const { differences } = compare(a, b)
    expect(differences).toHaveLength(1)
    expect(differences[0].segments).toHaveLength(500)
  })
})
