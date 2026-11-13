import { GitCompareArrows, LoaderCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from 'cn'

function isMac(): boolean {
  return typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
}

function modLabel(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

interface CompareButtonProps {
  onCompare: () => void
  loading?: boolean
  /** Smaller variant for the header. */
  compact?: boolean
  className?: string
}

export default function CompareButton({
  onCompare,
  loading = false,
  compact = false,
  className,
}: CompareButtonProps) {
  const shortcut = `${modLabel()}+Enter`
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            size={compact ? 'sm' : 'lg'}
            onClick={onCompare}
            aria-busy={loading}
            aria-keyshortcuts="Control+Enter Meta+Enter"
            className={cn(!compact && 'min-w-32 font-semibold shadow-md', className)}
          >
            {loading ? (
              <LoaderCircle aria-hidden="true" className="animate-spin" />
            ) : (
              <GitCompareArrows aria-hidden="true" />
            )}
            Compare
          </Button>
        </TooltipTrigger>
        <TooltipContent>Compare ({shortcut})</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
