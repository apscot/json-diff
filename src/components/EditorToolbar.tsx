import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { Check, Copy, Minimize2, AlignLeft, Trash2, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatJson, minifyJson, parseJson, type IndentOption } from '@/lib/json/parse'

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024

interface EditorToolbarProps {
  /** Panel name, used to label the controls ("Original JSON"). */
  label: string
  value: string
  onChange: (value: string) => void
  indent: IndentOption
  onIndentChange: (indent: IndentOption) => void
}

function parseIndent(raw: string): IndentOption {
  return raw === 'tab' ? 'tab' : raw === '4' ? 4 : 2
}

export default function EditorToolbar({
  label,
  value,
  onChange,
  indent,
  onIndentChange,
}: EditorToolbarProps) {
  const [copied, setCopied] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(copyTimer.current), [])

  const copy = async () => {
    setNotice(null)
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
      setNotice('Could not copy to the clipboard.')
    }
  }

  const clear = () => {
    setNotice(null)
    onChange('')
  }

  const transform = (build: (parsed: Parameters<typeof minifyJson>[0]) => string) => {
    const result = parseJson(value)
    if (!result.ok) {
      // Leave the text untouched; the validation message next to the editor explains why.
      setNotice(
        result.error.kind === 'empty'
          ? 'There is no JSON to format.'
          : `Fix the JSON first: line ${result.error.line}, column ${result.error.column}.`,
      )
      return
    }
    setNotice(null)
    onChange(build(result.value))
  }

  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target
    const file = input.files?.[0]
    input.value = '' // allow choosing the same file again
    if (!file) return
    if (file.size > MAX_UPLOAD_BYTES) {
      setNotice(`"${file.name}" is larger than 20 MB. Choose a smaller file.`)
      return
    }
    const looksJson = /\.json$/i.test(file.name) || /json/i.test(file.type)
    if (!looksJson) {
      setNotice(`"${file.name}" is not a JSON file. Choose a .json file.`)
      return
    }
    try {
      const text = await file.text()
      if (text.includes('\u0000')) {
        setNotice(`"${file.name}" is not a text JSON file.`)
        return
      }
      onChange(text)
      setNotice(null)
    } catch {
      setNotice(`Could not read "${file.name}".`)
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label={`${label} tools`}>
        <Button type="button" variant="outline" size="sm" onClick={copy}>
          {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy'}
          <span className="sr-only"> {label}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={clear}>
          <Trash2 aria-hidden="true" />
          Clear
          <span className="sr-only"> {label}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => transform((v) => formatJson(v, indent))}>
          <AlignLeft aria-hidden="true" />
          Format
          <span className="sr-only"> {label}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => transform(minifyJson)}>
          <Minimize2 aria-hidden="true" />
          Minify
          <span className="sr-only"> {label}</span>
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Upload aria-hidden="true" />
          Upload
          <span className="sr-only"> {label}</span>
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label={`Upload ${label} file`}
          data-testid={`upload-${label}`}
          tabIndex={-1}
          onChange={upload}
        />
        <label className="ml-auto flex items-center gap-1.5 text-sm text-muted-foreground">
          Indent
          <select
            aria-label={`${label} indent`}
            value={String(indent)}
            onChange={(e) => onIndentChange(parseIndent(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground dark:bg-input/30"
          >
            <option value="2">2 spaces</option>
            <option value="4">4 spaces</option>
            <option value="tab">Tab</option>
          </select>
        </label>
      </div>
      {notice && (
        <p role="alert" className="text-sm text-destructive">
          {notice}
        </p>
      )}
    </div>
  )
}
