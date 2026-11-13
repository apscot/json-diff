import { describe, expect, it } from 'vitest'
import { compare } from './diff'
import { SAMPLE_MODIFIED, SAMPLE_ORIGINAL } from './sample'
import { buildMergedTree, flattenTree, type TreeNode } from './tree'
import type { JsonValue } from './types'

function build(a: JsonValue, b: JsonValue): TreeNode {
  return buildMergedTree(a, b, compare(a, b).differences)
}

function find(node: TreeNode, id: string): TreeNode {
  if (node.id === id) return node
  for (const child of node.children ?? []) {
    if (id === child.id || id.startsWith(child.id)) {
      const found = find(child, id)
      if (found.id === id) return found
    }
  }
  return node
}

const has = (o: object, k: string) => Object.prototype.hasOwnProperty.call(o, k)

describe('buildMergedTree: structure', () => {
  it('builds a single leaf for identical primitives', () => {
    const root = build(1, 1)
    expect(root).toMatchObject({ id: '$', key: '$', type: 'number', hasChanges: false, original: 1, modified: 1 })
    expect(root.kind).toBeUndefined()
    expect(root.children).toBeUndefined()
  })

  it('marks a root-level difference with its kind', () => {
    expect(build(1, 'x')).toMatchObject({ kind: 'type-changed', type: 'string' })
    expect(build(1, 2).kind).toBe('modified')
  })

  it('uses the union of keys: original order first, then added keys', () => {
    const root = build({ b: 1, a: 2 }, { c: 3, a: 2 })
    expect(root.children?.map((c) => c.key)).toEqual(['b', 'a', 'c'])
    expect(root.children?.map((c) => c.id)).toEqual(['$.b', '$.a', '$.c'])
  })

  it('uses the maximum array length', () => {
    const root = build([1, 2, 3], [1])
    expect(root.children?.map((c) => c.id)).toEqual(['$[0]', '$[1]', '$[2]'])
    expect(root.children?.map((c) => c.kind)).toEqual([undefined, 'removed', 'removed'])
    const longer = build([1], [1, 2])
    expect(longer.children?.[1].kind).toBe('added')
  })

  it('omits the absent side on added and removed nodes', () => {
    const root = build({ gone: 1, fresh: 2 }, { fresh: 2, extra: null })
    const gone = find(root, '$.gone')
    expect(gone.original).toBe(1)
    expect(has(gone, 'modified')).toBe(false)
    const extra = find(root, '$.extra')
    expect(extra.modified).toBeNull()
    expect(has(extra, 'original')).toBe(false)
    expect(extra.type).toBe('null')
  })

  it('sets hasChanges on every ancestor but not on unchanged siblings', () => {
    const root = build(
      { a: { b: { c: 1 } }, d: { e: 1 }, f: [1] },
      { a: { b: { c: 2 } }, d: { e: 1 }, f: [1] },
    )
    expect(root.hasChanges).toBe(true)
    expect(find(root, '$.a').hasChanges).toBe(true)
    expect(find(root, '$.a.b').hasChanges).toBe(true)
    expect(find(root, '$.a.b').kind).toBeUndefined()
    expect(find(root, '$.a.b.c')).toMatchObject({ kind: 'modified', hasChanges: false })
    expect(find(root, '$.d').hasChanges).toBe(false)
    expect(find(root, '$.f').hasChanges).toBe(false)
  })

  it('keeps empty containers as nodes with an empty children list', () => {
    const root = build({ o: {}, a: [] }, { o: {}, a: [] })
    expect(find(root, '$.o').children).toEqual([])
    expect(find(root, '$.a').children).toEqual([])
    expect(root.hasChanges).toBe(false)
  })

  it('escapes unusual keys through the shared path formatter', () => {
    const root = build({ 'a.b': 1, "it's": 1 }, { 'a.b': 2, "it's": 1 })
    expect(root.children?.map((c) => c.id)).toEqual(["$['a.b']", "$['it\\'s']"])
    expect(root.children?.[0].kind).toBe('modified')
  })

  it('handles __proto__ as a plain key', () => {
    const a = JSON.parse('{"__proto__": {"x": 1}}') as JsonValue
    const b = JSON.parse('{"__proto__": {"x": 2}}') as JsonValue
    const root = build(a, b)
    expect(root.children?.[0].key).toBe('__proto__')
    expect(find(root, '$.__proto__.x').kind).toBe('modified')
  })
})

describe('buildMergedTree: whole-subtree differences', () => {
  it('draws the children of an added subtree from the modified side', () => {
    const root = build({}, { n: { x: 1, y: [true] } })
    const n = find(root, '$.n')
    expect(n.kind).toBe('added')
    expect(n.hasChanges).toBe(false)
    expect(n.children?.map((c) => c.id)).toEqual(['$.n.x', '$.n.y'])
    expect(n.children?.every((c) => c.kind === undefined)).toBe(true)
    expect(find(root, '$.n.y[0]').modified).toBe(true)
    expect(root.hasChanges).toBe(true)
  })

  it('draws the children of a removed subtree from the original side', () => {
    const root = build({ n: [1, 2] }, {})
    const n = find(root, '$.n')
    expect(n.kind).toBe('removed')
    expect(n.type).toBe('array')
    expect(n.children?.map((c) => c.id)).toEqual(['$.n[0]', '$.n[1]'])
  })

  it('draws a container type change from the existing container side', () => {
    const toScalar = find(build({ n: { x: 1 } }, { n: 5 }), '$.n')
    expect(toScalar).toMatchObject({ kind: 'type-changed', type: 'number' })
    expect(toScalar.children?.map((c) => c.id)).toEqual(['$.n.x'])

    const toContainer = find(build({ n: 5 }, { n: ['a'] }), '$.n')
    expect(toContainer.kind).toBe('type-changed')
    expect(toContainer.children?.map((c) => c.id)).toEqual(['$.n[0]'])
  })

  it('does not merge an object with an array', () => {
    const n = find(build({ n: { x: 1 } }, { n: [1, 2] }), '$.n')
    expect(n.kind).toBe('type-changed')
    expect(n.type).toBe('array')
    expect(n.children?.map((c) => c.id)).toEqual(['$.n[0]', '$.n[1]'])
  })

  it('builds the sample documents with every kind present', () => {
    const a = JSON.parse(SAMPLE_ORIGINAL) as JsonValue
    const b = JSON.parse(SAMPLE_MODIFIED) as JsonValue
    const root = build(a, b)
    const kinds = new Set<string | undefined>()
    const visit = (n: TreeNode) => {
      kinds.add(n.kind)
      n.children?.forEach(visit)
    }
    visit(root)
    expect(kinds).toEqual(new Set(['added', 'removed', 'modified', 'type-changed', undefined]))
  })
})

describe('flattenTree', () => {
  const a = { a: { x: 1, y: 2 }, b: { z: 1 }, list: [1, 2] }
  const b = { a: { x: 1, y: 3 }, b: { z: 1 }, list: [1, 2], n: { k: 1 } }
  const root = build(a, b)
  const ids = (expanded: string[], changedOnly = false) =>
    flattenTree(root, new Set(expanded), { changedOnly }).map((r) => r.id)

  it('shows only the root when nothing is expanded', () => {
    const rows = flattenTree(root, new Set(), { changedOnly: false })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({ id: '$', depth: 0, node: root })
  })

  it('lists direct children of an expanded root, collapsed below', () => {
    expect(ids(['$'])).toEqual(['$', '$.a', '$.b', '$.list', '$.n'])
  })

  it('assigns depth and keeps document order when expanded deeper', () => {
    const rows = flattenTree(root, new Set(['$', '$.a', '$.list']), { changedOnly: false })
    expect(rows.map((r) => [r.id, r.depth])).toEqual([
      ['$', 0],
      ['$.a', 1],
      ['$.a.x', 2],
      ['$.a.y', 2],
      ['$.b', 1],
      ['$.list', 1],
      ['$.list[0]', 2],
      ['$.list[1]', 2],
      ['$.n', 1],
    ])
  })

  it('ignores expanded ids of nodes whose parent is collapsed, and of leaves', () => {
    expect(ids(['$.a', '$.a.x'])).toEqual(['$'])
    expect(ids(['$', '$.a.x'])).toEqual(['$', '$.a', '$.b', '$.list', '$.n'])
  })

  it('hides unchanged branches with changedOnly', () => {
    expect(ids(['$', '$.a', '$.b', '$.list'], true)).toEqual(['$', '$.a', '$.a.y', '$.n'])
  })

  it('shows the contents of a whole-subtree difference with changedOnly once expanded', () => {
    expect(ids(['$', '$.n'], true)).toEqual(['$', '$.a', '$.n', '$.n.k'])
  })

  it('keeps the root row even when nothing changed', () => {
    const same = build({ a: 1 }, { a: 1 })
    const rows = flattenTree(same, new Set(['$']), { changedOnly: true })
    expect(rows.map((r) => r.id)).toEqual(['$'])
  })

  it('handles a very deep document without recursion in flatten', () => {
    let doc: JsonValue = 1
    const other: JsonValue = 2
    const expanded = new Set<string>()
    let path = '$'
    for (let i = 0; i < 200; i++) {
      doc = { k: doc }
      expanded.add(path)
      path += '.k'
    }
    const rows = flattenTree(buildMergedTree(doc, { k: other }, compare(doc, { k: other }).differences), expanded, {
      changedOnly: false,
    })
    expect(rows.length).toBeGreaterThan(1)
  })
})
