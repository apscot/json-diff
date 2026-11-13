import { getJsonType } from './jsonType'
import { appendIndex, appendKey, formatPath } from './path'
import type { DiffKind, Difference, JsonType, JsonValue, PathSegment } from './types'

export interface TreeNode {
  /** The JSONPath string of the node. Unique within a tree. */
  id: string
  /** Display label: the object key, the array index, or `$` for the root. */
  key: string
  segments: PathSegment[]
  /** Type of the modified side if it exists, otherwise of the original side. */
  type: JsonType
  /** Set only on nodes that are the location of a difference. */
  kind?: DiffKind
  /** True when a descendant carries a difference. */
  hasChanges: boolean
  /** Omitted when the node does not exist on the original side. */
  original?: JsonValue
  /** Omitted when the node does not exist on the modified side. */
  modified?: JsonValue
  /** Present only on containers (possibly empty). */
  children?: TreeNode[]
}

export interface TreeRow {
  id: string
  depth: number
  node: TreeNode
}

type JsonObject = { [key: string]: JsonValue }
type Container = JsonValue[] | JsonObject

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key)

function asContainer(value: JsonValue | undefined): Container | undefined {
  return typeof value === 'object' && value !== null ? value : undefined
}

function mergeChildren(
  segments: PathSegment[],
  a: Container | undefined,
  b: Container | undefined,
  byPath: ReadonlyMap<string, Difference>,
): TreeNode[] {
  const children: TreeNode[] = []
  if (Array.isArray(a) || Array.isArray(b)) {
    const left = Array.isArray(a) ? a : []
    const right = Array.isArray(b) ? b : []
    const length = Math.max(left.length, right.length)
    for (let i = 0; i < length; i++) {
      const o = i < left.length ? left[i] : undefined
      const m = i < right.length ? right[i] : undefined
      children.push(buildNode(appendIndex(segments, i), String(i), o, m, byPath))
    }
    return children
  }
  const left = (a ?? {}) as JsonObject
  const right = (b ?? {}) as JsonObject
  const keys = Object.keys(left)
  for (const k of Object.keys(right)) if (!hasOwn(left, k)) keys.push(k)
  for (const k of keys) {
    children.push(
      buildNode(
        appendKey(segments, k),
        k,
        hasOwn(left, k) ? left[k] : undefined,
        hasOwn(right, k) ? right[k] : undefined,
        byPath,
      ),
    )
  }
  return children
}

/** `undefined` means "this side has no such node". JSON values are never `undefined`. */
function buildNode(
  segments: PathSegment[],
  key: string,
  original: JsonValue | undefined,
  modified: JsonValue | undefined,
  byPath: ReadonlyMap<string, Difference>,
): TreeNode {
  const id = formatPath(segments)
  const shown = modified !== undefined ? modified : (original as JsonValue)
  const node: TreeNode = { id, key, segments, type: getJsonType(shown), hasChanges: false }
  const diff = byPath.get(id)
  if (diff) node.kind = diff.kind
  if (original !== undefined) node.original = original
  if (modified !== undefined) node.modified = modified

  // Containers of the same type are merged. Otherwise (added, removed, container type change)
  // the children are drawn from the side that is a container, preferring the modified side.
  const originalContainer = asContainer(original)
  const m = asContainer(modified)
  const o = originalContainer && m && Array.isArray(originalContainer) !== Array.isArray(m) ? undefined : originalContainer
  if (!o && !m) return node

  node.children = mergeChildren(segments, o, m, byPath)
  node.hasChanges = node.children.some((c) => c.kind !== undefined || c.hasChanges)
  return node
}

/**
 * Merges both documents into one tree: the union of object keys and, for arrays, the longer
 * length. Nodes at a difference carry its `kind`; their ancestors carry `hasChanges`. For a
 * whole-subtree difference (added, removed, container type change) only the node itself is
 * marked and its children are drawn from the side that exists.
 */
export function buildMergedTree(
  original: JsonValue,
  modified: JsonValue,
  differences: readonly Difference[],
): TreeNode {
  const byPath = new Map<string, Difference>()
  for (const d of differences) byPath.set(d.path, d)
  return buildNode([], '$', original, modified, byPath)
}

interface Frame {
  node: TreeNode
  depth: number
  /** True inside a whole-subtree difference, where every descendant is shown. */
  insideChange: boolean
}

/**
 * Flattens the tree into the rows that are currently visible. Children are listed only for
 * expanded nodes. With `changedOnly`, unchanged branches are hidden, except that the contents
 * of a whole-subtree difference are always shown. The root row is always present.
 */
export function flattenTree(
  root: TreeNode,
  expandedIds: ReadonlySet<string>,
  { changedOnly }: { changedOnly: boolean },
): TreeRow[] {
  const rows: TreeRow[] = []
  // Explicit stack: documents can be deeper than the call stack allows for recursion.
  const stack: Frame[] = [{ node: root, depth: 0, insideChange: false }]
  for (let frame = stack.pop(); frame !== undefined; frame = stack.pop()) {
    const { node, depth } = frame
    rows.push({ id: node.id, depth, node })
    if (!node.children || !expandedIds.has(node.id)) continue
    const insideChange = frame.insideChange || node.kind !== undefined
    for (let i = node.children.length - 1; i >= 0; i--) {
      const child = node.children[i]
      if (changedOnly && !insideChange && child.kind === undefined && !child.hasChanges) continue
      stack.push({ node: child, depth: depth + 1, insideChange })
    }
  }
  return rows
}
