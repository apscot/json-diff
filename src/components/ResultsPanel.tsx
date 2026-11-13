import { useDeferredValue, useMemo, useState } from 'react'
import DiffFilters, { type KindFilter } from '@/components/DiffFilters'
import DiffSummary from '@/components/DiffSummary'
import DiffTree, { type TreeDocuments } from '@/components/DiffTree'
import DiffViewer from '@/components/DiffViewer'
import ErrorBoundary from '@/components/ErrorBoundary'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { CompareOutcome } from '@/hooks/useCompare'
import { filterDifferences } from '@/lib/json/filter'
import type { DiffKind, DiffResult } from '@/lib/json/types'

const NO_KINDS: ReadonlySet<DiffKind> = new Set()

// Gives each result object a stable id, so filters reset for a new comparison only.
const resultIds = new WeakMap<DiffResult, number>()
let nextResultId = 0
function resultId(result: DiffResult): number {
  let id = resultIds.get(result)
  if (id === undefined) {
    id = nextResultId++
    resultIds.set(result, id)
  }
  return id
}

interface ResultsPanelProps {
  outcome: CompareOutcome
  loading?: boolean
  /** Called with the JSONPath of the row that was clicked or activated with Enter. */
  onSelect?: (path: string) => void
}

function Message({ text, problem, loading }: { text: string; problem: boolean; loading: boolean }) {
  return (
    <p
      role={problem ? 'alert' : 'status'}
      aria-busy={loading}
      className={problem ? 'text-sm text-destructive' : 'text-sm text-muted-foreground'}
    >
      {text}
    </p>
  )
}

function Differences({
  result,
  documents,
  onSelect,
}: {
  result: DiffResult
  documents?: TreeDocuments
  onSelect?: (path: string) => void
}) {
  const [kind, setKind] = useState<KindFilter>('all')
  const [query, setQuery] = useState('')
  const [selectedPath, setSelectedPath] = useState<string | null>(null)
  // The input stays responsive while a huge list is re-filtered at lower priority.
  const deferredQuery = useDeferredValue(query)
  const { summary } = result

  const kinds = useMemo<ReadonlySet<DiffKind>>(
    () => (kind === 'all' ? NO_KINDS : new Set<DiffKind>([kind])),
    [kind],
  )
  const visible = useMemo(
    () => filterDifferences(result.differences, { kinds, query: deferredQuery }),
    [result.differences, kinds, deferredQuery],
  )

  const select = (path: string) => {
    setSelectedPath(path)
    onSelect?.(path)
  }

  return (
    <div className="flex flex-col gap-4">
      <p role="status" className="sr-only">
        {`${summary.total} ${summary.total === 1 ? 'difference' : 'differences'}: ${summary.added} added, ${summary.removed} removed, ${summary.modified} modified, ${summary.typeChanged} type changed`}
      </p>
      <DiffSummary summary={summary} />
      {summary.total === 0 ? (
        <Message text="No differences: both documents are equal." problem={false} loading={false} />
      ) : (
        <>
          <DiffFilters kind={kind} onKindChange={setKind} query={query} onQueryChange={setQuery} />
          <Tabs defaultValue="list">
            <TabsList>
              <TabsTrigger value="list">List</TabsTrigger>
              <TabsTrigger value="tree">Tree</TabsTrigger>
            </TabsList>
            <TabsContent value="list" className="flex flex-col gap-2">
              <p role="status" className="text-xs text-muted-foreground">
                Showing {visible.length} of {summary.total}
              </p>
              {visible.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">
                  No differences match the current filters.
                </p>
              ) : (
                <DiffViewer differences={visible} selectedPath={selectedPath} onSelect={select} />
              )}
            </TabsContent>
            <TabsContent value="tree">
              {visible.length === 0 ? (
                <p className="rounded-md border p-4 text-sm text-muted-foreground">
                  No differences match the current filters.
                </p>
              ) : (
                <DiffTree
                  differences={result.differences}
                  visibleDifferences={visible}
                  documents={documents}
                  selectedPath={selectedPath}
                  onSelect={select}
                />
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function Body({ outcome, loading, onSelect }: Required<Pick<ResultsPanelProps, 'loading'>> & ResultsPanelProps) {
  switch (outcome.status) {
    case 'idle':
      return (
        <Message
          text={loading ? 'Comparing…' : 'Press Compare to see the differences.'}
          problem={false}
          loading={loading}
        />
      )
    case 'empty':
      return <Message text={outcome.message} problem={false} loading={loading} />
    case 'failed':
      return <Message text={outcome.message} problem loading={loading} />
    case 'invalid': {
      const parts: string[] = []
      if (outcome.left) {
        parts.push(`Original JSON: line ${outcome.left.line}, column ${outcome.left.column}: ${outcome.left.message}`)
      }
      if (outcome.right) {
        parts.push(`Modified JSON: line ${outcome.right.line}, column ${outcome.right.column}: ${outcome.right.message}`)
      }
      return <Message text={parts.join(' | ')} problem loading={loading} />
    }
    case 'result':
      // Keyed by the result so filters and selection reset for each new comparison.
      return <Differences
          key={resultId(outcome.result)}
          result={outcome.result}
          documents={outcome.documents}
          onSelect={onSelect}
        />
  }
}

export default function ResultsPanel({ outcome, loading = false, onSelect }: ResultsPanelProps) {
  return (
    <section aria-label="Comparison results" className="flex flex-col gap-3 rounded-md border p-4">
      <h2 className="text-base font-semibold">Results</h2>
      <p className="text-xs text-muted-foreground">Arrays are compared by index.</p>
      <ErrorBoundary resetKey={outcome}>
        <Body outcome={outcome} loading={loading} onSelect={onSelect} />
      </ErrorBoundary>
    </section>
  )
}
