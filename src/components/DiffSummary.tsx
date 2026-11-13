import DiffKindBadge from '@/components/DiffKindBadge'
import type { DiffSummary as DiffSummaryCounts } from '@/lib/json/types'

interface CardProps {
  name: string
  count: number
  label: React.ReactNode
}

function Card({ name, count, label }: CardProps) {
  return (
    <div role="group" aria-label={name} className="flex flex-col gap-1 rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-semibold tabular-nums">{count}</div>
    </div>
  )
}

/** Count cards. The Type changes card only appears when there is at least one. */
export default function DiffSummary({ summary }: { summary: DiffSummaryCounts }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      <Card name="Total" count={summary.total} label="Total differences" />
      <Card name="Added" count={summary.added} label={<DiffKindBadge kind="added" />} />
      <Card name="Removed" count={summary.removed} label={<DiffKindBadge kind="removed" />} />
      <Card name="Modified" count={summary.modified} label={<DiffKindBadge kind="modified" />} />
      {summary.typeChanged > 0 ? (
        <Card
          name="Type changes"
          count={summary.typeChanged}
          label={<DiffKindBadge kind="type-changed" />}
        />
      ) : null}
    </div>
  )
}
