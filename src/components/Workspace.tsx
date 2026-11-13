import { useId, useMemo } from 'react'
import type { KeyBinding } from '@uiw/react-codemirror'
import EditorToolbar from '@/components/EditorToolbar'
import JsonEditor from '@/components/JsonEditor'
import ValidationMessage from '@/components/ValidationMessage'
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
import type { TextRange } from '@/lib/json/locate'
import { parseJson, type IndentOption, type ParseResult } from '@/lib/json/parse'

export const VALIDATION_DELAY_MS = 300

interface PanelProps {
  title: string
  value: string
  onChange: (value: string) => void
  indent: IndentOption
  onIndentChange: (indent: IndentOption) => void
  keymap?: readonly KeyBinding[]
  highlightRange?: TextRange | null
}

function Panel({ title, value, onChange, indent, onIndentChange, keymap, highlightRange }: PanelProps) {
  const messageId = useId()
  const debounced = useDebouncedValue(value, VALIDATION_DELAY_MS)
  const result = useMemo<ParseResult>(() => parseJson(debounced), [debounced])
  const error = !result.ok && result.error.kind === 'syntax' ? result.error : null

  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <EditorToolbar
        label={title}
        value={value}
        onChange={onChange}
        indent={indent}
        onIndentChange={onIndentChange}
      />
      <JsonEditor
        value={value}
        onChange={onChange}
        error={error}
        highlightRange={highlightRange}
        keymap={keymap}
        label={title}
        describedBy={messageId}
        placeholder="Paste or type JSON here"
      />
      <ValidationMessage id={messageId} result={result} />
    </section>
  )
}

interface WorkspaceProps {
  leftText: string
  rightText: string
  onLeftChange: (value: string) => void
  onRightChange: (value: string) => void
  indent: IndentOption
  onIndentChange: (indent: IndentOption) => void
  /** Extra key bindings for both editors (app shortcuts). */
  keymap?: readonly KeyBinding[]
  leftRange?: TextRange | null
  rightRange?: TextRange | null
}

/** Two labelled editor panels: side by side from `lg`, stacked below. */
export default function Workspace({
  leftText,
  rightText,
  onLeftChange,
  onRightChange,
  indent,
  onIndentChange,
  keymap,
  leftRange,
  rightRange,
}: WorkspaceProps) {
  return (
    <div className="grid grid-cols-1 gap-4 md:gap-6 lg:grid-cols-2">
      <Panel
        title="Original JSON"
        value={leftText}
        onChange={onLeftChange}
        indent={indent}
        onIndentChange={onIndentChange}
        keymap={keymap}
        highlightRange={leftRange}
      />
      <Panel
        title="Modified JSON"
        value={rightText}
        onChange={onRightChange}
        indent={indent}
        onIndentChange={onIndentChange}
        keymap={keymap}
        highlightRange={rightRange}
      />
    </div>
  )
}
