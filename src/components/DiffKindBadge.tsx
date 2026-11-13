import { Pencil, Plus, Minus, Replace, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DiffKind } from '@/lib/json/types'

interface KindStyle {
  icon: LucideIcon
  label: string
  className: string
}

/** The only place that maps a diff kind to its icon, label and colour. */
const KIND_STYLES: Record<DiffKind, KindStyle> = {
  added: {
    icon: Plus,
    label: 'Added',
    className: 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300',
  },
  removed: {
    icon: Minus,
    label: 'Removed',
    className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
  },
  modified: {
    icon: Pencil,
    label: 'Modified',
    className: 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300',
  },
  'type-changed': {
    icon: Replace,
    label: 'Type changed',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300',
  },
}

interface DiffKindBadgeProps {
  kind: DiffKind
  className?: string
}

/** Icon + text label + colour. Never colour alone. */
export default function DiffKindBadge({ kind, className }: DiffKindBadgeProps) {
  const { icon: Icon, label, className: colours } = KIND_STYLES[kind]
  return (
    <span
      data-kind={kind}
      className={cn(
        'inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap',
        colours,
        className,
      )}
    >
      <Icon aria-hidden="true" className="size-3" />
      {label}
    </span>
  )
}
