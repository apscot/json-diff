import type { JsonType, JsonValue } from './types'

/** Classifies a value. `null` and arrays are checked first because `typeof` reports both as 'object'. */
export function getJsonType(value: JsonValue): JsonType {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  switch (typeof value) {
    case 'string':
      return 'string'
    case 'number':
      return 'number'
    case 'boolean':
      return 'boolean'
    default:
      return 'object'
  }
}
