import { CodeXml, Moon, ShieldCheck, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import CompareButton from '@/components/CompareButton'
import LimitationsPopover from '@/components/LimitationsPopover'
import ShortcutsPopover from '@/components/ShortcutsPopover'
import { useTheme } from '@/hooks/useTheme'

interface HeaderProps {
  /** When given, a compact Compare button is shown on desktop. */
  onCompare?: () => void
  loading?: boolean
}

export default function Header({ onCompare, loading = false }: HeaderProps = {}) {
  const { isDark, toggle } = useTheme()
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b px-3 py-2 sm:px-4 sm:py-3">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h1 className="text-xl font-semibold tracking-tight">JSON Diff</h1>
        <p className="hidden text-sm text-muted-foreground sm:block">Compare JSON. Find the difference.</p>
      </div>
      <div className="flex flex-wrap items-center gap-1 sm:gap-2">
        {onCompare ? (
          <CompareButton compact onCompare={onCompare} loading={loading} className="hidden lg:inline-flex" />
        ) : null}
        <Badge variant="secondary">
          <ShieldCheck aria-hidden="true" />
          100% Local Processing
        </Badge>
        <ShortcutsPopover />
        <LimitationsPopover />
        <Button variant="ghost" size="icon" asChild>
          {/* Placeholder: the repository URL is not decided yet. */}
          <a href="#" aria-label="GitHub (placeholder link)">
            <CodeXml aria-hidden="true" />
          </a>
        </Button>
        <Button variant="ghost" size="icon" onClick={toggle} aria-label={label} title={label}>
          {isDark ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
        </Button>
      </div>
    </header>
  )
}
