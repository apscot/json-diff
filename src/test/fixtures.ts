import type { DiffSummary, JsonValue } from '@/lib/json/types'

type JsonObject = { [key: string]: JsonValue }

function makeRecord(i: number): JsonObject {
  return {
    id: i,
    name: `user-${i}`,
    active: i % 2 === 0,
    score: i * 3,
    tags: [`t${i % 7}`, `g${i % 5}`, `k${i % 3}`],
    meta: {
      created: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      owner: { id: i + 1000, email: `user${i}@example.com` },
    },
  }
}

/** A deterministic document with `n` records of 14 nodes each (see `countNodes`). */
export function generateLargeDoc(n: number): JsonValue {
  const records: JsonValue[] = []
  for (let i = 0; i < n; i++) records.push(makeRecord(i))
  return { version: 1, records }
}

/** Counts every value (containers and primitives) in a document. */
export function countNodes(value: JsonValue): number {
  if (value === null || typeof value !== 'object') return 1
  let count = 1
  const children = Array.isArray(value) ? value : Object.values(value)
  for (const child of children) count += countNodes(child)
  return count
}

export interface LargePair {
  original: JsonValue
  modified: JsonValue
  /** The summary the engine must produce, derived while the pair is built. */
  expected: DiffSummary
}

/** Two identical, but separately built, large documents. */
export function generateIdenticalPair(n: number): LargePair {
  return {
    original: generateLargeDoc(n),
    modified: generateLargeDoc(n),
    expected: { total: 0, added: 0, removed: 0, modified: 0, typeChanged: 0 },
  }
}

/**
 * A large pair with a known set of differences, spread over the records by `i % 10`:
 * 0 score modified, 1 `active` boolean to string (type change), 2 extra tag added,
 * 3 `meta.owner` removed (one difference), 4 key `extra` added (one difference).
 * Two extra records are appended to the modified side (two added differences).
 */
export function generateLargePair(n: number): LargePair {
  const original = generateLargeDoc(n) as JsonObject
  const modified = generateLargeDoc(n) as JsonObject
  const records = modified.records as JsonObject[]
  const expected: DiffSummary = { total: 0, added: 0, removed: 0, modified: 0, typeChanged: 0 }

  records.forEach((record, i) => {
    switch (i % 10) {
      case 0:
        record.score = (record.score as number) + 1
        expected.modified++
        break
      case 1:
        record.active = String(record.active)
        expected.typeChanged++
        break
      case 2:
        ;(record.tags as JsonValue[]).push('extra-tag')
        expected.added++
        break
      case 3:
        delete (record.meta as JsonObject).owner
        expected.removed++
        break
      case 4:
        record.extra = { a: 1, b: [1, 2, { c: null }] }
        expected.added++
        break
      default:
        break
    }
  })

  records.push(makeRecord(n), makeRecord(n + 1))
  expected.added += 2
  expected.total = expected.added + expected.removed + expected.modified + expected.typeChanged

  return { original, modified, expected }
}
