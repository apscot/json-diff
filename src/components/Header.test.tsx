import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import Header from '@/components/Header'

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('Header', () => {
  it('renders logo, tagline and badge', () => {
    render(<Header />)
    expect(screen.getByText('JSON Diff')).toBeInTheDocument()
    expect(screen.getByText('Compare JSON. Find the difference.')).toBeInTheDocument()
    expect(screen.getByText('100% Local Processing')).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /placeholder/i })).not.toBeInTheDocument()
  })

  it('toggles the dark class and persists across a remount', async () => {
    const user = userEvent.setup()
    const html = document.documentElement
    const first = render(<Header />)
    expect(html).toHaveClass('dark')

    await user.click(screen.getByRole('button', { name: /switch to light/i }))
    expect(html).not.toHaveClass('dark')
    expect(window.localStorage.getItem('theme')).toBe('"light"')

    first.unmount()
    html.classList.add('dark') // simulate a fresh page before the hook runs
    render(<Header />)
    expect(html).not.toHaveClass('dark')
    await user.click(screen.getByRole('button', { name: /switch to dark/i }))
    expect(html).toHaveClass('dark')
  })
})
