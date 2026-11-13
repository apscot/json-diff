import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

const COPIED_MS = 1500

interface JsonPathDisplayProps {
  path: string
  className?: string
}

/** A JSONPath in monospace. Clicking it copies the path to the clipboard. */
export default function JsonPathDisplay({ path, className }: JsonPathDisplayProps) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(timer.current), [])

  const copy = (event: MouseEvent<HTMLButtonElement>) => {
    // Copying must not also select the surrounding row.
    event.stopPropagation()
    const clipboard = typeof navigator === 'undefined' ? undefined : navigator.clipboard
    if (!clipboard) return
    clipboard.writeText(path).then(
      () => {
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = setTimeout(() => setCopied(false), COPIED_MS)
      },
      () => setCopied(false),
    )
  }

  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied' : `Copy path ${path}`}
      aria-label={`Copy path ${path}`}
      className={cn(
        'inline-flex max-w-full items-center gap-1 rounded px-1 font-mono text-xs hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none',
        className,
      )}
    >
      <span className="truncate">{path}</span>
      {copied ? (
        <>
          <Check aria-hidden="true" className="size-3 shrink-0 text-green-600" />
          <span role="status" className="sr-only">
            Copied
          </span>
        </>
      ) : null}
    </button>
  )
}
