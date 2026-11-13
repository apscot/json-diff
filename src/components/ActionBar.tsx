import { useId, type ReactNode } from 'react'
import { ArrowLeftRight, AlignLeft, Eraser } from 'lucide-react'
import CompareButton from '@/components/CompareButton'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function modLabel(): string {
  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
  return mac ? '⌘' : 'Ctrl'
}

interface ToolButtonProps {
  /** Accessible name and tooltip text. */
  label: string
  /** Shortcut hint, shown in the tooltip and announced through aria-keyshortcuts. */
  hint?: string
  keyShortcuts?: string
  onClick: () => void
  icon: ReactNode
  /** The visible text. Below `sm` only the icon shows and the name is still available. */
  children: ReactNode
}

/** A compact toolbar button: icon on small screens, icon and text from `sm`, always a tooltip. */
function ToolButton({ label, hint, keyShortcuts, onClick, icon, children }: ToolButtonProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onClick}
          aria-label={hint ? `${label} (${hint})` : label}
          aria-keyshortcuts={keyShortcuts}
          className="max-sm:size-9 max-sm:px-0"
        >
          {icon}
          <span className="max-sm:sr-only">{children}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent>{hint ? `${label} (${hint})` : label}</TooltipContent>
    </Tooltip>
  )
}

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
  /** The drafts opt-in. The switch is shown only when a change handler is given. */
  saveDrafts?: boolean
  onSaveDraftsChange?: (value: boolean) => void
  /** Why a draft was not saved, shown next to the switch. */
  draftsProblem?: string | null
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
  saveDrafts = false,
  onSaveDraftsChange,
  draftsProblem = null,
}: ActionBarProps) {
  const switchId = useId()
  const draftsId = useId()
  const mod = modLabel()
  return (
    <TooltipProvider>
      <div
        role="toolbar"
        aria-label="Compare actions"
        className="flex flex-wrap items-center gap-2"
      >
        <CompareButton onCompare={onCompare} loading={loading} />
        <ToolButton
          label="Swap sides"
          hint={`${mod}+Shift+X`}
          keyShortcuts="Control+Shift+X Meta+Shift+X"
          onClick={onSwap}
          icon={<ArrowLeftRight aria-hidden="true" />}
        >
          Swap
        </ToolButton>
        <ToolButton
          label="Format both"
          hint={`${mod}+Shift+F`}
          keyShortcuts="Control+Shift+F Meta+Shift+F"
          onClick={onFormatBoth}
          icon={<AlignLeft aria-hidden="true" />}
        >
          Format both
        </ToolButton>
        <ToolButton
          label="Clear original"
          onClick={onClearLeft}
          icon={<Eraser aria-hidden="true" />}
        >
          Clear original
        </ToolButton>
        <ToolButton
          label="Clear modified"
          onClick={onClearRight}
          icon={<Eraser aria-hidden="true" />}
        >
          Clear modified
        </ToolButton>
        <ToolButton label="Clear both" onClick={onClearBoth} icon={<Eraser aria-hidden="true" />}>
          Clear both
        </ToolButton>
        <div className="flex items-center gap-2 sm:ml-auto">
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
        {onSaveDraftsChange ? (
          <div className="flex basis-full flex-wrap items-center gap-x-2 gap-y-1">
            <Switch
              id={draftsId}
              size="sm"
              checked={saveDrafts}
              onCheckedChange={onSaveDraftsChange}
            />
            <label htmlFor={draftsId} className="text-sm">
              Save drafts in this browser (stored unencrypted)
            </label>
            <p role="status" className="text-sm text-destructive empty:hidden">
              {draftsProblem}
            </p>
          </div>
        ) : null}
        <p role="status" className="basis-full text-sm text-muted-foreground empty:hidden">
          {notice}
        </p>
      </div>
    </TooltipProvider>
  )
}
