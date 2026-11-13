import { Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

const LIMITATIONS: ReadonlyArray<{ title: string; text: string }> = [
  {
    title: 'Number precision',
    text: 'Numbers are read as 64-bit floats. Integers beyond 9007199254740991 lose precision, so two different large integers can look equal.',
  },
  {
    title: '1.0 vs 1',
    text: 'The values 1.0 and 1 are the same number, so they are not reported as a difference.',
  },
  {
    title: 'Duplicate keys',
    text: 'If an object repeats a key, the last one wins and the earlier values are ignored.',
  },
  {
    title: 'Arrays by index',
    text: 'Arrays are compared position by position. Inserting an item near the start shifts every later index.',
  },
]

export default function LimitationsPopover() {
  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Limitations">
                <Info aria-hidden="true" />
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent>Limitations</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align="end" className="max-h-[70vh] w-80 max-w-[calc(100vw-2rem)] overflow-auto">
        <h2 className="mb-2 text-sm font-semibold">Limitations</h2>
        <dl className="flex flex-col gap-3 text-sm">
          {LIMITATIONS.map(({ title, text }) => (
            <div key={title}>
              <dt className="font-medium">{title}</dt>
              <dd className="text-muted-foreground">{text}</dd>
            </div>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}
