import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { defaultRangeExtractor, useVirtualizer, type Range } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, CircleDot } from 'lucide-react'
import DiffKindBadge from '@/components/DiffKindBadge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { previewValue, typeLabel } from '@/lib/json/display'
import { getJsonType } from '@/lib/json/jsonType'
import { formatPath } from '@/lib/json/path'
import { buildMergedTree, flattenTree, type TreeNode, type TreeRow } from '@/lib/json/tree'
import type { Difference, JsonValue, PathSegment } from '@/lib/json/types'
import { cn } from '@/lib/utils'

/** Fixed row height, so the virtualiser never has to measure rows. */
export const TREE_ROW_HEIGHT = 36
const OVERSCAN = 8
const INDENT_PX = 16
const PREVIEW_LENGTH = 40
const COLUMNS = 'grid-cols-[minmax(0,2fr)_minmax(0,2fr)_9rem_10rem]'

export interface TreeDocuments {
  original: JsonValue
  modified: JsonValue
}

interface DiffTreeProps {
  /** Every difference of the comparison. The merged tree is built from these. */
  differences: readonly Difference[]
  /**
   * The differences that pass the active kind filter and search. When this is a subset, the tree
   * shows only those paths and their ancestors. Defaults to all differences.
   */
  visibleDifferences?: readonly Difference[]
  /**
   * The two compared documents. When omitted, the tree is rebuilt from the differences alone,
   * so unchanged values that are not an ancestor of a difference are not shown.
   */
  documents?: TreeDocuments
  selectedPath?: string | null
  /** Called with the JSONPath of the row that was clicked or activated with Enter. */
  onSelect?: (path: string) => void
  /** Like `onSelect`, but also receives the node's path segments. */
  onSelectNode?: (path: string, segments: readonly PathSegment[]) => void
}

type Container = JsonValue[] | { [key: string]: JsonValue }

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key)

function isContainer(value: JsonValue | undefined): value is Container {
  return typeof value === 'object' && value !== null
}

function emptyFor(segment: string | number): Container {
  return typeof segment === 'number' ? [] : {}
}

/** Reads a child. Objects are read by own property only. */
function childOf(container: Container, segment: string | number): JsonValue | undefined {
  if (Array.isArray(container)) return typeof segment === 'number' ? container[segment] : undefined
  return typeof segment === 'string' && hasOwn(container, segment) ? container[segment] : undefined
}

/** Writes a child. Returns false when the segment does not fit the container. */
function setChild(container: Container, segment: string | number, value: JsonValue): boolean {
  if (Array.isArray(container)) {
    if (typeof segment !== 'number') return false
    // Indices that no difference touches are unknown: fill them with null.
    while (container.length < segment) container.push(null)
    container[segment] = value
    return true
  }
  if (typeof segment !== 'string') return false
  // defineProperty, so a key such as `__proto__` becomes an own property.
  Object.defineProperty(container, segment, {
    value,
    enumerable: true,
    writable: true,
    configurable: true,
  })
  return true
}

function insertAt(root: Container, segments: readonly (string | number)[], value: JsonValue): void {
  let cursor = root
  for (let i = 0; i < segments.length - 1; i++) {
    let next = childOf(cursor, segments[i])
    if (!isContainer(next)) {
      next = emptyFor(segments[i + 1])
      if (!setChild(cursor, segments[i], next)) return
    }
    cursor = next
  }
  setChild(cursor, segments[segments.length - 1], value)
}

/** The part of one side's document that the differences reveal. */
function sketch(differences: readonly Difference[], side: 'original' | 'modified'): JsonValue | undefined {
  let root: JsonValue | undefined
  for (const d of differences) {
    const value = side === 'original' ? (d.kind === 'added' ? undefined : d.original) : d.kind === 'removed' ? undefined : d.modified
    if (value === undefined) continue
    if (d.segments.length === 0) {
      root = value
      continue
    }
    if (!isContainer(root)) root = emptyFor(d.segments[0])
    insertAt(root, d.segments, value)
  }
  return root
}

function documentsFromDifferences(differences: readonly Difference[]): TreeDocuments {
  const original = sketch(differences, 'original')
  const modified = sketch(differences, 'modified')
  const fallback = (other: JsonValue | undefined): JsonValue =>
    Array.isArray(other) ? [] : isContainer(other) ? {} : null
  return { original: original ?? fallback(modified), modified: modified ?? fallback(original) }
}

/**
 * Keeps only the matching differences, their ancestors and everything inside a matching
 * whole-subtree difference. Ancestors are marked as having changes.
 */
function pruneTree(root: TreeNode, matching: readonly Difference[]): TreeNode {
  const matched = new Set<string>()
  const ancestors = new Set<string>()
  for (const d of matching) {
    matched.add(d.path)
    for (let i = d.segments.length - 1; i >= 0; i--) {
      const id = formatPath(d.segments.slice(0, i))
      if (ancestors.has(id)) break
      ancestors.add(id)
    }
  }
  const prune = (node: TreeNode): TreeNode | null => {
    if (matched.has(node.id)) return node
    if (!ancestors.has(node.id) || !node.children) return null
    const children: TreeNode[] = []
    for (const child of node.children) {
      const kept = prune(child)
      if (kept) children.push(kept)
    }
    return { ...node, children, hasChanges: true }
  }
  return prune(root) ?? { ...root, children: root.children ? [] : undefined, hasChanges: false }
}

/** Ids of every container that has children. */
function expandableIds(root: TreeNode): Set<string> {
  const ids = new Set<string>()
  const stack = [root]
  for (let node = stack.pop(); node !== undefined; node = stack.pop()) {
    if (!node.children || node.children.length === 0) continue
    ids.add(node.id)
    for (const child of node.children) stack.push(child)
  }
  return ids
}

function isExpandable(node: TreeNode): boolean {
  return node.children !== undefined && node.children.length > 0
}

function valuePreview(node: TreeNode): string {
  const text = (value: JsonValue) => previewValue(value, PREVIEW_LENGTH)
  if (node.kind === 'modified' || node.kind === 'type-changed') {
    return `${text(node.original as JsonValue)} → ${text(node.modified as JsonValue)}`
  }
  const value = node.modified !== undefined ? node.modified : node.original
  return value === undefined ? '' : text(value)
}

function typeText(node: TreeNode): string {
  if (node.kind === 'type-changed') {
    return `${typeLabel(getJsonType(node.original as JsonValue))} → ${typeLabel(getJsonType(node.modified as JsonValue))}`
  }
  return typeLabel(node.type)
}

interface TreeRowViewProps {
  row: TreeRow
  expanded: boolean
  selected: boolean
  tabbable: boolean
  top: number
  height: number
  index: number
  setRef: (id: string, element: HTMLDivElement | null) => void
  onToggle: (id: string) => void
  onActivate: (index: number) => void
  onKeyDown: (event: KeyboardEvent<HTMLDivElement>, index: number) => void
}

function TreeRowView({
  row,
  expanded,
  selected,
  tabbable,
  top,
  height,
  index,
  setRef,
  onToggle,
  onActivate,
  onKeyDown,
}: TreeRowViewProps) {
  const { node, depth } = row
  const expandable = isExpandable(node)
  const preview = valuePreview(node)
  const Chevron = expanded ? ChevronDown : ChevronRight
  return (
    <div
      ref={(element) => setRef(node.id, element)}
      role="treeitem"
      data-testid="tree-row"
      data-index={index}
      aria-level={depth + 1}
      aria-expanded={expandable ? expanded : undefined}
      aria-selected={selected}
      tabIndex={tabbable ? 0 : -1}
      onClick={() => onActivate(index)}
      onKeyDown={(event) => onKeyDown(event, index)}
      className={cn(
        'absolute top-0 left-0 grid w-full cursor-pointer items-center gap-3 border-b px-3 text-sm hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
        COLUMNS,
        selected && 'bg-accent ring-2 ring-primary ring-inset',
      )}
      style={{ height, transform: `translateY(${top}px)` }}
    >
      <span className="flex min-w-0 items-center gap-1" style={{ paddingLeft: depth * INDENT_PX }}>
        {expandable ? (
          <span
            aria-hidden="true"
            data-testid="tree-toggle"
            className="inline-flex size-5 shrink-0 items-center justify-center rounded hover:bg-accent"
            onClick={(event) => {
              event.stopPropagation()
              onToggle(node.id)
            }}
          >
            <Chevron className="size-4" />
          </span>
        ) : (
          <span aria-hidden="true" className="inline-block size-5 shrink-0" />
        )}
        <span className="truncate font-mono text-xs font-medium" title={node.id}>
          {node.key}
        </span>
      </span>
      <span className="truncate font-mono text-xs" title={preview}>
        {preview}
      </span>
      <span className="truncate text-xs text-muted-foreground">{typeText(node)}</span>
      {node.kind ? (
        <DiffKindBadge kind={node.kind} />
      ) : node.hasChanges ? (
        <span className="inline-flex w-fit items-center gap-1 text-xs whitespace-nowrap text-muted-foreground">
          <CircleDot aria-hidden="true" className="size-3" />
          Contains changes
        </span>
      ) : null}
    </div>
  )
}

/** Virtualised ARIA tree of the merged documents. Only the rows near the viewport are in the DOM. */
export default function DiffTree({
  differences,
  visibleDifferences,
  documents,
  selectedPath,
  onSelect,
  onSelectNode,
}: DiffTreeProps) {
  const switchId = useId()
  const scrollRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef(new Map<string, HTMLDivElement>())
  const pendingFocus = useRef<string | null>(null)
  const [changedOnly, setChangedOnly] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [chosenId, setChosenId] = useState<string | null>(null)
  // Without a controlled `selectedPath` the tree remembers its own last click.
  const selectedId = selectedPath === undefined ? chosenId : selectedPath

  // Built when the Tree tab first mounts this component, never for the List tab alone.
  const fullTree = useMemo(() => {
    const docs = documents ?? documentsFromDifferences(differences)
    return buildMergedTree(docs.original, docs.modified, differences)
  }, [documents, differences])

  const tree = useMemo(() => {
    const filtered = visibleDifferences !== undefined && visibleDifferences.length !== differences.length
    // Without the documents the tree was sketched from the differences, so placeholder
    // siblings are dropped by pruning to the differences themselves.
    if (!filtered && documents) return fullTree
    return pruneTree(fullTree, filtered ? visibleDifferences : differences)
  }, [fullTree, visibleDifferences, differences, documents])

  // Default expansion is depth 1: the root is open, so its children are visible.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set([fullTree.id]))

  // A selection that arrives from outside (the list) opens its ancestors. This runs while
  // rendering, so the row exists in the very first frame. Later manual collapsing is respected.
  const [revealed, setRevealed] = useState<string | null>(null)
  if (selectedPath != null && selectedPath !== revealed) {
    setRevealed(selectedPath)
    const target = differences.find((d) => d.path === selectedPath)
    if (target) {
      const missing: string[] = []
      for (let i = 0; i < target.segments.length; i++) {
        const id = formatPath(target.segments.slice(0, i))
        if (!expanded.has(id)) missing.push(id)
      }
      if (missing.length > 0) setExpanded(new Set([...expanded, ...missing]))
    }
  } else if (selectedPath == null && revealed !== null) {
    setRevealed(null)
  }

  const rows = useMemo(() => flattenTree(tree, expanded, { changedOnly }), [tree, expanded, changedOnly])

  const foundIndex = activeId === null ? -1 : rows.findIndex((row) => row.id === activeId)
  const activeIndex = foundIndex === -1 ? 0 : foundIndex

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => TREE_ROW_HEIGHT,
    overscan: OVERSCAN,
    // The tabbable row stays in the DOM even when scrolled out of view, so Tab can reach the tree.
    rangeExtractor: (range: Range) => {
      const indexes = defaultRangeExtractor(range)
      if (activeIndex >= rows.length || indexes.includes(activeIndex)) return indexes
      return [...indexes, activeIndex].sort((a, b) => a - b)
    },
  })

  // Scrolls the selected row into view once it is rendered. Rows already visible stay put.
  const scrolledTo = useRef<string | null>(null)
  const { scrollToIndex } = virtualizer
  useEffect(() => {
    if (selectedPath == null) {
      scrolledTo.current = null
      return
    }
    if (scrolledTo.current === selectedPath) return
    const index = rows.findIndex((row) => row.id === selectedPath)
    if (index === -1) return
    scrolledTo.current = selectedPath
    scrollToIndex(index)
  }, [selectedPath, rows, scrollToIndex])

  // Moves DOM focus once the requested row has been rendered.
  useEffect(() => {
    const id = pendingFocus.current
    if (id === null) return
    const element = itemRefs.current.get(id)
    if (!element) return
    pendingFocus.current = null
    element.focus()
  })

  const setRef = (id: string, element: HTMLDivElement | null) => {
    if (element) itemRefs.current.set(id, element)
    else itemRefs.current.delete(id)
  }

  const toggle = (id: string) => {
    setExpanded((current) => {
      const next = new Set(current)
      if (!next.delete(id)) next.add(id)
      return next
    })
  }

  const setOpen = (id: string, open: boolean) => {
    setExpanded((current) => {
      if (current.has(id) === open) return current
      const next = new Set(current)
      if (open) next.add(id)
      else next.delete(id)
      return next
    })
  }

  const moveTo = (index: number) => {
    const target = rows[Math.min(Math.max(index, 0), rows.length - 1)]
    if (!target) return
    setActiveId(target.id)
    pendingFocus.current = target.id
    virtualizer.scrollToIndex(rows.indexOf(target))
  }

  const parentIndex = (index: number): number => {
    const depth = rows[index].depth
    for (let i = index - 1; i >= 0; i--) if (rows[i].depth < depth) return i
    return -1
  }

  const activate = (index: number) => {
    const row = rows[index]
    if (!row) return
    setActiveId(row.id)
    setChosenId(row.id)
    onSelect?.(row.id)
    onSelectNode?.(row.id, row.node.segments)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, index: number) => {
    if (event.target !== event.currentTarget) return
    if (event.altKey || event.ctrlKey || event.metaKey) return
    const row = rows[index]
    const expandable = isExpandable(row.node)
    const open = expanded.has(row.id)
    switch (event.key) {
      case 'ArrowDown':
        moveTo(index + 1)
        break
      case 'ArrowUp':
        moveTo(index - 1)
        break
      case 'Home':
        moveTo(0)
        break
      case 'End':
        moveTo(rows.length - 1)
        break
      case 'ArrowRight':
        if (expandable && !open) setOpen(row.id, true)
        else if (expandable && open) moveTo(index + 1)
        break
      case 'ArrowLeft':
        if (expandable && open) setOpen(row.id, false)
        else if (parentIndex(index) >= 0) moveTo(parentIndex(index))
        break
      case 'Enter':
        activate(index)
        break
      default:
        return
    }
    event.preventDefault()
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(expandableIds(tree))}>
          Expand all
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => setExpanded(new Set())}>
          Collapse all
        </Button>
        <div className="ml-auto flex items-center gap-2">
          <Switch id={switchId} size="sm" checked={changedOnly} onCheckedChange={setChangedOnly} />
          <label htmlFor={switchId} className="text-sm">
            Changed only
          </label>
        </div>
      </div>
      <div className="rounded-md border">
        <div
          aria-hidden="true"
          className={cn('grid gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium', COLUMNS)}
        >
          <span>Property</span>
          <span>Value</span>
          <span>Type</span>
          <span>Difference</span>
        </div>
        <div ref={scrollRef} className="h-[28rem] overflow-auto">
          <div
            role="tree"
            aria-label="Differences tree"
            className="relative"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((item) => {
              const row = rows[item.index]
              if (!row) return null
              return (
                <TreeRowView
                  key={row.id}
                  row={row}
                  index={item.index}
                  expanded={expanded.has(row.id)}
                  selected={row.id === selectedId}
                  tabbable={item.index === activeIndex}
                  top={item.start}
                  height={item.size}
                  setRef={setRef}
                  onToggle={toggle}
                  onActivate={activate}
                  onKeyDown={handleKeyDown}
                />
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
