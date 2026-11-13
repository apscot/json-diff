import { CodeXml, Moon, ShieldCheck, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useTheme } from '@/hooks/useTheme'

export default function Header() {
  const { isDark, toggle } = useTheme()
  const label = isDark ? 'Switch to light theme' : 'Switch to dark theme'

  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
      <div className="flex items-baseline gap-3">
        <h1 className="text-xl font-semibold tracking-tight">JSON Diff</h1>
        <p className="text-sm text-muted-foreground">Compare JSON. Find the difference.</p>
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="secondary">
          <ShieldCheck aria-hidden="true" />
          100% Local Processing
        </Badge>
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
