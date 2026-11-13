import { CircleAlert, CircleCheck, Info } from 'lucide-react'
import type { ParseResult } from '@/lib/json/parse'

interface ValidationMessageProps {
  result: ParseResult
  id?: string
}

/** Shows the validation state of one editor: error with line and column, empty hint, or valid. */
export default function ValidationMessage({ result, id }: ValidationMessageProps) {
  if (!result.ok && result.error.kind === 'syntax') {
    const { line, column, message } = result.error
    return (
      <p id={id} role="alert" className="flex items-start gap-2 text-sm text-destructive">
        <CircleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        <span>
          <strong className="font-medium">
            Invalid JSON at line {line}, column {column}.
          </strong>{' '}
          <span className="break-words">{message}</span>
        </span>
      </p>
    )
  }

  if (!result.ok) {
    return (
      <p id={id} role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Info aria-hidden="true" className="size-4 shrink-0" />
        Paste, type or upload JSON to get started.
      </p>
    )
  }

  return (
    <p
      id={id}
      role="status"
      className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400"
    >
      <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
      Valid JSON
    </p>
  )
}
