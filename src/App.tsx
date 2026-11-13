import { useCallback, useMemo, useState } from 'react'
import ActionBar from '@/components/ActionBar'
import Header from '@/components/Header'
import ResultsPanel from '@/components/ResultsPanel'
import Workspace from '@/components/Workspace'
import { useCompare } from '@/hooks/useCompare'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import { useShortcuts } from '@/hooks/useShortcuts'
import { formatJson, parseJson, type IndentOption } from '@/lib/json/parse'
import { SAMPLE_MODIFIED, SAMPLE_ORIGINAL } from '@/lib/json/sample'

// Preferences hold no JSON, only settings.
const INDENT_KEY = 'indent'

export default function App() {
  const [leftText, setLeftText] = useState(SAMPLE_ORIGINAL)
  const [rightText, setRightText] = useState(SAMPLE_MODIFIED)
  const [storedIndent, setIndent] = useLocalStorage<IndentOption>(INDENT_KEY, 2)
  const indent: IndentOption = storedIndent === 4 || storedIndent === 'tab' ? storedIndent : 2
  const [autoCompare, setAutoCompare] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { outcome, loading, run, reset } = useCompare(leftText, rightText, { auto: autoCompare })

  const compareNow = useCallback(() => {
    setNotice(null)
    run()
  }, [run])

  const swap = useCallback(() => {
    setNotice(null)
    setLeftText(rightText)
    setRightText(leftText)
    reset()
  }, [leftText, rightText, reset])

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
  }, [leftText, rightText, indent])

  const clearBoth = useCallback(() => {
    setNotice(null)
    setLeftText('')
    setRightText('')
    reset()
  }, [reset])

  const clearLeft = useCallback(() => {
    setNotice(null)
    setLeftText('')
    reset()
  }, [reset])

  const clearRight = useCallback(() => {
    setNotice(null)
    setRightText('')
    reset()
  }, [reset])

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
        />
        <ResultsPanel outcome={outcome} loading={loading} />
      </main>
    </div>
  )
}
