import { Component, type ReactNode } from 'react'

interface ErrorBoundaryProps {
  children: ReactNode
  /** When this changes after an error, the boundary tries to render its children again. */
  resetKey?: unknown
}

interface ErrorBoundaryState {
  failed: boolean
}

/** Keeps a rendering failure in one panel from blanking the whole app. */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true }
  }

  componentDidUpdate(prev: ErrorBoundaryProps) {
    if (this.state.failed && prev.resetKey !== this.props.resetKey) {
      this.setState({ failed: false })
    }
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="alert" className="rounded-md border border-destructive/50 p-4 text-sm">
          <p className="mb-2 text-destructive">Something went wrong while showing the results.</p>
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-sm hover:bg-accent"
            onClick={() => this.setState({ failed: false })}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
