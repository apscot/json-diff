import { Keyboard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

function modLabel(): string {
  const mac = typeof navigator !== 'undefined' && /mac|iphone|ipad/i.test(navigator.platform)
  return mac ? '⌘' : 'Ctrl'
}

/** The popover trigger and its tooltip are separate roles on one button. */
export default function ShortcutsPopover() {
  const mod = modLabel()
  const shortcuts: ReadonlyArray<{ action: string; keys: string }> = [
    { action: 'Compare', keys: `${mod}+Enter` },
    { action: 'Format both', keys: `${mod}+Shift+F` },
    { action: 'Swap sides', keys: `${mod}+Shift+X` },
  ]
  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Keyboard shortcuts">
                <Keyboard aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Keyboard shortcuts</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
        <h2 className="mb-2 text-sm font-semibold">Keyboard shortcuts</h2>
        <dl className="flex flex-col gap-2 text-sm">
          {shortcuts.map(({ action, keys }) => (
            <div key={action} className="flex items-center justify-between gap-3">
              <dt>{action}</dt>
              <dd>
                <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs text-foreground">
                  {keys}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          They also work while an editor has focus.
        </p>
      </PopoverContent>
    </Popover>
  )
}
