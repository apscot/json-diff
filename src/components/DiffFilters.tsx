import { Search } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'

export type KindFilter = 'all' | 'added' | 'removed' | 'modified' | 'type-changed'

const KIND_FILTERS: { value: KindFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'added', label: 'Added' },
  { value: 'removed', label: 'Removed' },
  { value: 'modified', label: 'Modified' },
  { value: 'type-changed', label: 'Type changes' },
]

function isKindFilter(value: string): value is KindFilter {
  return KIND_FILTERS.some((f) => f.value === value)
}

interface DiffFiltersProps {
  kind: KindFilter
  onKindChange: (kind: KindFilter) => void
  /** The text as typed. The parent defers it (`useDeferredValue`) before filtering. */
  query: string
  onQueryChange: (query: string) => void
}

export default function DiffFilters({ kind, onKindChange, query, onQueryChange }: DiffFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        aria-label="Filter by kind"
        value={kind}
        onValueChange={(next) => {
          // Clicking the pressed item reports ''. A kind always stays selected.
          if (isKindFilter(next)) onKindChange(next)
        }}
      >
        {KIND_FILTERS.map((f) => (
          <ToggleGroupItem key={f.value} value={f.value}>
            {f.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <div className="relative min-w-48 flex-1 sm:max-w-xs">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          type="search"
          aria-label="Search differences"
          placeholder="Search path or value"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          className="pl-8"
        />
      </div>
    </div>
  )
}
