import type { JsonType, JsonValue } from './types'

const TYPE_LABELS: Record<JsonType, string> = {
  object: 'object',
  array: 'array',
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  null: 'null',
}

/** Human-readable name of a JSON type, for badges and row captions. */
export function typeLabel(type: JsonType): string {
  return TYPE_LABELS[type]
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`
}

function truncate(text: string, maxLen: number): string {
  const limit = Math.max(1, Math.floor(maxLen))
  if (text.length <= limit) return text
  return `${text.slice(0, limit - 1)}…`
}

/**
 * Short single-line preview of a value for list rows. Strings are quoted, containers are
 * summarised by size (cheap even for huge values), and the result never exceeds `maxLen`.
 */
export function previewValue(value: JsonValue, maxLen: number): string {
  if (Array.isArray(value)) return truncate(`[${plural(value.length, 'item')}]`, maxLen)
  if (value !== null && typeof value === 'object') {
    return truncate(`{${plural(Object.keys(value).length, 'key')}}`, maxLen)
  }
  return truncate(JSON.stringify(value), maxLen)
}
