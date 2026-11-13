import { describe, expect, it } from 'vitest'
import { compare } from './diff'
import { filterDifferences, MATCH_TEXT_LIMIT } from './filter'
import type { DiffKind } from './types'

const original = {
  user: { Name: 'Alice', age: 25, role: 'admin' },
  legacy: 'old-value',
  list: [1, 2],
  flag: 'true',
}
const modified = {
  user: { Name: 'Alicia', age: 26, role: 'admin' },
  list: [1, 2, 3],
  fresh: { deep: 'Brand New' },
  flag: true,
}
const { differences } = compare(original, modified)
const none = new Set<DiffKind>()

describe('filterDifferences: kinds', () => {
  it('returns everything for an empty kinds set and empty query', () => {
    const out = filterDifferences(differences, { kinds: none, query: '' })
    expect(out).toEqual(differences)
    expect(out).not.toBe(differences)
  })

  it('filters by one kind', () => {
    const out = filterDifferences(differences, { kinds: new Set<DiffKind>(['added']), query: '' })
    expect(out.map((d) => d.path)).toEqual(['$.list[2]', '$.fresh'])
  })

  it('filters by several kinds', () => {
    const out = filterDifferences(differences, {
      kinds: new Set<DiffKind>(['removed', 'type-changed']),
      query: '',
    })
    expect(out.map((d) => d.kind).sort()).toEqual(['removed', 'type-changed'])
  })
})

describe('filterDifferences: query', () => {
  const paths = (query: string, kinds: Set<DiffKind> = none) =>
    filterDifferences(differences, { kinds, query }).map((d) => d.path)

  it('matches the property name case-insensitively', () => {
    expect(paths('NAME')).toEqual(['$.user.Name'])
  })

  it('matches the last segment of an array index', () => {
    expect(paths('[2]')).toEqual(['$.list[2]'])
  })

  it('matches the path', () => {
    expect(paths('$.user.')).toEqual(['$.user.Name', '$.user.age'])
  })

  it('matches the original value (including a removed difference)', () => {
    expect(paths('old-VALUE')).toEqual(['$.legacy'])
  })

  it('matches the modified value (including an added difference)', () => {
    expect(paths('brand new')).toEqual(['$.fresh'])
    expect(paths('alicia')).toEqual(['$.user.Name'])
  })

  it('matches stringified non-string values', () => {
    expect(paths('26')).toEqual(['$.user.age'])
    expect(paths('deep')).toEqual(['$.fresh'])
  })

  it('does not match the absent side of an added or removed difference', () => {
    expect(paths('old-value', new Set<DiffKind>(['added']))).toEqual([])
  })

  it('combines kinds and query', () => {
    expect(paths('user', new Set<DiffKind>(['modified']))).toEqual(['$.user.Name', '$.user.age'])
    expect(paths('legacy', new Set<DiffKind>(['modified']))).toEqual([])
  })

  it('ignores surrounding whitespace in the query and treats blank as no query', () => {
    expect(paths('  legacy  ')).toEqual(['$.legacy'])
    expect(paths('   ')).toHaveLength(differences.length)
  })

  it('matches the root difference, which has no last segment', () => {
    const root = compare(1, 2).differences
    expect(filterDifferences(root, { kinds: none, query: '$' })).toHaveLength(1)
    expect(filterDifferences(root, { kinds: none, query: 'zzz' })).toHaveLength(0)
  })

  it('matches only the first MATCH_TEXT_LIMIT characters of a value', () => {
    const long = `${'a'.repeat(MATCH_TEXT_LIMIT)}needle`
    const diffs = compare({ k: 'x' }, { k: long }).differences
    expect(filterDifferences(diffs, { kinds: none, query: 'needle' })).toHaveLength(0)
    expect(filterDifferences(diffs, { kinds: none, query: 'aaaa' })).toHaveLength(1)
  })
})
