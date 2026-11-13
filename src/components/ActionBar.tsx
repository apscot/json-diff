import { useId } from 'react'
import { ArrowLeftRight, AlignLeft, Eraser } from 'lucide-react'
import CompareButton from '@/components/CompareButton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'

interface ActionBarProps {
  onCompare: () => void
  onSwap: () => void
  onFormatBoth: () => void
  onClearLeft: () => void
  onClearRight: () => void
  onClearBoth: () => void
  autoCompare: boolean
  onAutoCompareChange: (value: boolean) => void
  loading?: boolean
  /** Short feedback for the last action (e.g. why formatting did nothing). */
  notice?: string | null
}

export default function ActionBar({
  onCompare,
  onSwap,
  onFormatBoth,
  onClearLeft,
  onClearRight,
  onClearBoth,
  autoCompare,
  onAutoCompareChange,
  loading = false,
  notice = null,
}: ActionBarProps) {
  const switchId = useId()
  return (
    <div role="toolbar" aria-label="Compare actions" className="flex flex-wrap items-center gap-2">
      <CompareButton onCompare={onCompare} loading={loading} />
      <Button type="button" variant="outline" onClick={onSwap} title="Swap sides (Ctrl+Shift+X)">
        <ArrowLeftRight aria-hidden="true" />
        Swap
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onFormatBoth}
        title="Format both (Ctrl+Shift+F)"
      >
        <AlignLeft aria-hidden="true" />
        Format both
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearLeft}>
        <Eraser aria-hidden="true" />
        Clear original
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearRight}>
        <Eraser aria-hidden="true" />
        Clear modified
      </Button>
      <Button type="button" variant="ghost" size="sm" onClick={onClearBoth}>
        <Eraser aria-hidden="true" />
        Clear both
      </Button>
      <div className="ml-auto flex items-center gap-2">
        <Switch
          id={switchId}
          size="sm"
          checked={autoCompare}
          onCheckedChange={onAutoCompareChange}
        />
        <label htmlFor={switchId} className="text-sm">
          Auto-compare
        </label>
      </div>
      <p role="status" className="basis-full text-sm text-muted-foreground empty:hidden">
        {notice}
      </p>
    </div>
  )
}
