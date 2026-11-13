import { useCallback, useState } from 'react'

function read<T>(key: string, initial: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    return raw === null ? initial : (JSON.parse(raw) as T)
  } catch {
    // Storage unavailable or value is not valid JSON: fall back.
    return initial
  }
}

/**
 * State persisted in localStorage as JSON. Never throws: storage or parse
 * failures fall back to the in-memory value.
 */
export function useLocalStorage<T>(
  key: string,
  initial: T,
): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setStored] = useState<T>(() => read(key, initial))

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(prev) : next
        try {
          window.localStorage.setItem(key, JSON.stringify(resolved))
        } catch {
          // Quota exceeded or storage disabled: keep the in-memory value.
        }
        return resolved
      })
    },
    [key],
  )

  return [value, setValue]
}
