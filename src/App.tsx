import { useCallback, useMemo, useState } from 'react'
import ActionBar from '@/components/ActionBar'
import Header from '@/components/Header'
import ResultsPanel from '@/components/ResultsPanel'
import Workspace from '@/components/Workspace'
import { useCompare } from '@/hooks/useCompare'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useShortcuts } from '@/hooks/useShortcuts'
import { locatePath, type TextRange } from '@/lib/json/locate'
import { formatJson, parseJson, type IndentOption } from '@/lib/json/parse'
import { SAMPLE_MODIFIED, SAMPLE_ORIGINAL } from '@/lib/json/sample'
import type { PathSegment } from '@/lib/json/types'

// Preferences hold no JSON, only settings.
const INDENT_KEY = 'indent'

interface Selection {
  path: string
  left: TextRange | null
  right: TextRange | null
}

export default function App() {
  const [leftText, setLeftState] = useState(SAMPLE_ORIGINAL)
  const [rightText, setRightState] = useState(SAMPLE_MODIFIED)
  // The selected difference and where it sits in each text. Ranges are offsets into the texts
  // as they were when the difference was selected, so any edit clears the selection.
  const [selection, setSelection] = useState<Selection | null>(null)
  const setLeftText = useCallback((value: string) => {
    setSelection(null)
    setLeftState(value)
  }, [])
  const setRightText = useCallback((value: string) => {
    setSelection(null)
    setRightState(value)
  }, [])
  const [storedIndent, setIndent] = useLocalStorage<IndentOption>(INDENT_KEY, 2)
  const indent: IndentOption = storedIndent === 4 || storedIndent === 'tab' ? storedIndent : 2
  const [autoCompare, setAutoCompare] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { outcome, loading, run, reset } = useCompare(leftText, rightText, { auto: autoCompare })

  // Located lazily, only when a difference is clicked. A side without the node (added or
  // removed) gets the range of its nearest ancestor from `locatePath`.
  const selectDifference = useCallback(
    (path: string, segments: readonly PathSegment[]) => {
      setSelection({
        path,
        left: locatePath(leftText, segments),
        right: locatePath(rightText, segments),
      })
    },
    [leftText, rightText],
  )

  const compareNow = useCallback(() => {
    setNotice(null)
    run()
  }, [run])

  const swap = useCallback(() => {
    setNotice(null)
    setLeftText(rightText)
    setRightText(leftText)
    reset()
  }, [leftText, rightText, reset, setLeftText, setRightText])

  const formatBoth = useCallback(() => {
    const problems: string[] = []
    const apply = (label: string, text: string, set: (value: string) => void) => {
      const parsed = parseJson(text)
      if (parsed.ok) set(formatJson(parsed.value, indent))
      else if (parsed.error.kind === 'syntax') problems.push(`${label} is not valid JSON`)
    }
    apply('Original', leftText, setLeftText)
    apply('Modified', rightText, setRightText)
    setNotice(problems.length > 0 ? `${problems.join(' and ')}, so it was left unchanged.` : null)
  }, [leftText, rightText, indent, setLeftText, setRightText])

  const clearBoth = useCallback(() => {
    setNotice(null)
    setLeftText('')
    setRightText('')
    reset()
  }, [reset, setLeftText, setRightText])

  const clearLeft = useCallback(() => {
    setNotice(null)
    setLeftText('')
    reset()
  }, [reset, setLeftText])

  const clearRight = useCallback(() => {
    setNotice(null)
    setRightText('')
    reset()
  }, [reset, setRightText])

  const shortcuts = useShortcuts({ onCompare: compareNow, onFormat: formatBoth, onSwap: swap })
  // Inside an editor, stop the key event so the window listener does not run it a second time.
  const keymap = useMemo(
    () => shortcuts.keymap.map((binding) => ({ ...binding, stopPropagation: true })),
    [shortcuts.keymap],
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header onCompare={compareNow} loading={loading} />
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-4 p-4">
        <ActionBar
          onCompare={compareNow}
          onSwap={swap}
          onFormatBoth={formatBoth}
          onClearLeft={clearLeft}
          onClearRight={clearRight}
          onClearBoth={clearBoth}
          autoCompare={autoCompare}
          onAutoCompareChange={setAutoCompare}
          loading={loading}
          notice={notice}
        />
        <Workspace
          leftText={leftText}
          rightText={rightText}
          onLeftChange={setLeftText}
          onRightChange={setRightText}
          indent={indent}
          onIndentChange={setIndent}
          keymap={keymap}
          leftRange={selection?.left ?? null}
          rightRange={selection?.right ?? null}
        />
        <ResultsPanel
          outcome={outcome}
          loading={loading}
          onSelect={selectDifference}
          selectedPath={selection?.path ?? null}
        />
      </main>
    </div>
  )
}
