import { useState } from 'react'
import Header from '@/components/Header'
import Workspace from '@/components/Workspace'
import { useLocalStorage } from '@/hooks/useLocalStorage'
import type { IndentOption } from '@/lib/json/parse'
import { SAMPLE_MODIFIED, SAMPLE_ORIGINAL } from '@/lib/json/sample'

// Preferences hold no JSON, only settings.
const INDENT_KEY = 'indent'

export default function App() {
  const [leftText, setLeftText] = useState(SAMPLE_ORIGINAL)
  const [rightText, setRightText] = useState(SAMPLE_MODIFIED)
  const [storedIndent, setIndent] = useLocalStorage<IndentOption>(INDENT_KEY, 2)
  const indent: IndentOption = storedIndent === 4 || storedIndent === 'tab' ? storedIndent : 2

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Header />
      <main className="mx-auto w-full max-w-[1600px] flex-1 p-4">
        <Workspace
          leftText={leftText}
          rightText={rightText}
          onLeftChange={setLeftText}
          onRightChange={setRightText}
          indent={indent}
          onIndentChange={setIndent}
        />
      </main>
    </div>
  )
}
