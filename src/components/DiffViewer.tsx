import { useEffect, useRef, type KeyboardEvent } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import DiffKindBadge from '@/components/DiffKindBadge'
import JsonPathDisplay from '@/components/JsonPathDisplay'
import { previewValue } from '@/lib/json/display'
import type { Difference, JsonValue, PathSegment } from '@/lib/json/types'
import { cn } from '@/lib/utils'

/** Fixed row height, so the virtualiser never has to measure rows. */
export const ROW_HEIGHT = 40
const OVERSCAN = 8
const PREVIEW_LENGTH = 80
const COLUMNS = 'grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)_9rem]'

interface DiffViewerProps {
  differences: readonly Difference[]
  selectedPath?: string | null
  onSelect?: (path: string, segments: readonly PathSegment[]) => void
}

function ValueCell({ difference, side }: { difference: Difference; side: 'original' | 'modified' }) {
  // The missing side of an added or removed difference has no property at all.
  let value: JsonValue
  if (side === 'original') {
    if (difference.kind === 'added') return <Absent />
    value = difference.original
  } else {
    if (difference.kind === 'removed') return <Absent />
    value = difference.modified
  }
  const text = previewValue(value, PREVIEW_LENGTH)
  return (
    <span className="truncate font-mono text-xs" title={text}>
      {text}
    </span>
  )
}

function Absent() {
  return (
    <span className="text-xs text-muted-foreground">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not present</span>
    </span>
  )
}

/** Virtualised side-by-side list. Only the rows near the viewport are in the DOM. */
export default function DiffViewer({ differences, selectedPath = null, onSelect }: DiffViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const virtualizer = useVirtualizer({
    count: differences.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: OVERSCAN,
  })

  // A selection made elsewhere (the tree) brings its row into view. Rows already visible stay put.
  const scrolledTo = useRef<string | null>(null)
  const { scrollToIndex } = virtualizer
  useEffect(() => {
    if (selectedPath === null) {
      scrolledTo.current = null
      return
    }
    if (scrolledTo.current === selectedPath) return
    const index = differences.findIndex((difference) => difference.path === selectedPath)
    if (index === -1) return
    scrolledTo.current = selectedPath
    scrollToIndex(index)
  }, [selectedPath, differences, scrollToIndex])

  const handleKeyDown = (event: KeyboardEvent<HTMLLIElement>, difference: Difference) => {
    // Enter on the path's copy button must copy, not select.
    if (event.key === 'Enter' && event.target === event.currentTarget) {
      event.preventDefault()
      onSelect?.(difference.path, difference.segments)
    }
  }

  return (
    <div className="rounded-md border">
      <div
        aria-hidden="true"
        className={cn('grid gap-3 border-b bg-muted/50 px-3 py-2 text-xs font-medium', COLUMNS)}
      >
        <span>Path</span>
        <span>Original</span>
        <span>Modified</span>
        <span>Kind</span>
      </div>
      <div ref={scrollRef} className="h-[28rem] overflow-auto">
        <ul
          aria-label="Differences"
          className="relative m-0 list-none p-0"
          style={{ height: virtualizer.getTotalSize() }}
        >
          {virtualizer.getVirtualItems().map((item) => {
            const difference = differences[item.index]
            if (!difference) return null
            const selected = difference.path === selectedPath
            return (
              <li
                key={difference.path}
                data-testid="diff-row"
                data-index={item.index}
                tabIndex={0}
                aria-current={selected ? 'true' : undefined}
                onClick={() => onSelect?.(difference.path, difference.segments)}
                onKeyDown={(event) => handleKeyDown(event, difference)}
                className={cn(
                  'absolute top-0 left-0 grid w-full cursor-pointer items-center gap-3 border-b px-3 text-sm hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:ring-inset',
                  COLUMNS,
                  selected && 'bg-accent ring-2 ring-primary ring-inset',
                )}
                style={{ height: item.size, transform: `translateY(${item.start}px)` }}
              >
                <JsonPathDisplay path={difference.path} />
                <ValueCell difference={difference} side="original" />
                <ValueCell difference={difference} side="modified" />
                <DiffKindBadge kind={difference.kind} />
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
