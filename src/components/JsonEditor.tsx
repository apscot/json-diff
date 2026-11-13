import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import CodeMirror, {
  Decoration,
  EditorView,
  Prec,
  StateEffect,
  StateField,
  keymap as cmKeymap,
  type DecorationSet,
  type Extension,
  type KeyBinding,
  type Text,
} from '@uiw/react-codemirror'
import { json } from '@codemirror/lang-json'
import type { TextRange } from '@/lib/json/locate'

/** Fixed height shared by every editor so both panels line up. */
export const EDITOR_HEIGHT = '24rem'

export interface EditorError {
  line: number
  column: number
}

interface JsonEditorProps {
  value: string
  onChange: (value: string) => void
  /** Syntax error whose line gets marked, or null/undefined when the text is fine. */
  error?: EditorError | null
  /** Range to scroll to and mark (offsets into `value`). An empty range marks its line. */
  highlightRange?: TextRange | null
  /** Extra key bindings, e.g. the app shortcuts from `useShortcuts().keymap`. */
  keymap?: readonly KeyBinding[]
  placeholder?: string
  /** Accessible name of the text area. */
  label: string
  /** Id of an element describing the editor (the validation message). */
  describedBy?: string
}

interface Marks {
  range: TextRange | null
  errorLine: number | null
}

const setMarks = StateEffect.define<Marks>()

function clamp(n: number, max: number): number {
  return Math.max(0, Math.min(n, max))
}

function buildMarks(doc: Text, { range, errorLine }: Marks): DecorationSet {
  const ranges = []
  if (errorLine !== null && errorLine >= 1 && errorLine <= doc.lines) {
    ranges.push(Decoration.line({ class: 'cm-error-line' }).range(doc.line(errorLine).from))
  }
  if (range) {
    const from = clamp(range.from, doc.length)
    const to = clamp(range.to, doc.length)
    if (to > from) {
      ranges.push(Decoration.mark({ class: 'cm-highlight-range' }).range(from, to))
    } else {
      ranges.push(Decoration.line({ class: 'cm-highlight-line' }).range(doc.lineAt(from).from))
    }
  }
  return Decoration.set(ranges, true)
}

const marksField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(decorations, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setMarks)) return buildMarks(tr.state.doc, effect.value)
    }
    return tr.docChanged ? decorations.map(tr.changes) : decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

const markTheme = EditorView.baseTheme({
  '&light .cm-error-line': { backgroundColor: 'rgba(220, 38, 38, 0.12)' },
  '&dark .cm-error-line': { backgroundColor: 'rgba(248, 113, 113, 0.18)' },
  '&light .cm-highlight-line, &light .cm-highlight-range': {
    backgroundColor: 'rgba(245, 158, 11, 0.3)',
  },
  '&dark .cm-highlight-line, &dark .cm-highlight-range': {
    backgroundColor: 'rgba(245, 158, 11, 0.35)',
  },
})

/** Follows the `dark` class that `useTheme` toggles on <html>. */
function subscribeTheme(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => observer.disconnect()
}

function useIsDark(): boolean {
  return useSyncExternalStore(
    subscribeTheme,
    () => document.documentElement.classList.contains('dark'),
    () => true,
  )
}

const BASIC_SETUP = {
  lineNumbers: true,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  autocompletion: false,
  searchKeymap: false,
} as const

export default function JsonEditor({
  value,
  onChange,
  error,
  highlightRange,
  keymap,
  placeholder,
  label,
  describedBy,
}: JsonEditorProps) {
  const isDark = useIsDark()
  const [view, setView] = useState<EditorView | null>(null)

  const invalid = error != null
  const extensions = useMemo<Extension[]>(
    () => [
      json(),
      marksField,
      markTheme,
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({
        'aria-label': label,
        'aria-invalid': invalid ? 'true' : 'false',
        ...(describedBy ? { 'aria-describedby': describedBy } : {}),
      }),
      ...(keymap && keymap.length > 0 ? [Prec.highest(cmKeymap.of([...keymap]))] : []),
    ],
    [keymap, label, invalid, describedBy],
  )

  const errorLine = error?.line ?? null
  const from = highlightRange?.from ?? null
  const to = highlightRange?.to ?? null

  // Error line and range mark. Changing them never moves the viewport.
  useEffect(() => {
    if (!view) return
    view.dispatch({
      effects: setMarks.of({
        range: from !== null && to !== null ? { from, to } : null,
        errorLine,
      }),
    })
  }, [view, errorLine, from, to])

  // Scroll only when the requested range changes.
  useEffect(() => {
    if (!view || from === null) return
    const pos = clamp(from, view.state.doc.length)
    view.dispatch({ effects: EditorView.scrollIntoView(pos, { y: 'center' }) })
  }, [view, from, to])

  return (
    <div className="overflow-hidden rounded-md border text-sm">
      <CodeMirror
        value={value}
        onChange={onChange}
        height={EDITOR_HEIGHT}
        theme={isDark ? 'dark' : 'light'}
        placeholder={placeholder}
        extensions={extensions}
        basicSetup={BASIC_SETUP}
        onCreateEditor={setView}
      />
    </div>
  )
}
