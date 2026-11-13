export type JsonPrimitive = string | number | boolean | null

export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue }

export type JsonType = 'object' | 'array' | 'string' | 'number' | 'boolean' | 'null'

export type DiffKind = 'added' | 'removed' | 'modified' | 'type-changed'

/** A string is an object key, a number is an array index. */
export type PathSegment = string | number

interface DifferenceBase {
  /** JSONPath string, e.g. `$.user.items[2]['a.b']`. Built only by `formatPath`. */
  path: string
  /** The same location as a segment list. */
  segments: PathSegment[]
}

/** Only the modified side exists: `original` and `originalType` are omitted. */
export interface AddedDifference extends DifferenceBase {
  kind: 'added'
  modified: JsonValue
  modifiedType: JsonType
}

/** Only the original side exists: `modified` and `modifiedType` are omitted. */
export interface RemovedDifference extends DifferenceBase {
  kind: 'removed'
  original: JsonValue
  originalType: JsonType
}

export interface ModifiedDifference extends DifferenceBase {
  kind: 'modified'
  original: JsonValue
  modified: JsonValue
  originalType: JsonType
  modifiedType: JsonType
}

export interface TypeChangedDifference extends DifferenceBase {
  kind: 'type-changed'
  original: JsonValue
  modified: JsonValue
  originalType: JsonType
  modifiedType: JsonType
}

export type Difference =
  | AddedDifference
  | RemovedDifference
  | ModifiedDifference
  | TypeChangedDifference

/** `total` always equals added + removed + modified + typeChanged. */
export interface DiffSummary {
  total: number
  added: number
  removed: number
  modified: number
  typeChanged: number
}

export interface DiffResult {
  differences: Difference[]
  summary: DiffSummary
}
