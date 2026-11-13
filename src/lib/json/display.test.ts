import { describe, expect, it } from 'vitest'
import { previewValue, typeLabel } from './display'
import type { JsonType } from './types'

describe('previewValue', () => {
  it('renders primitives as JSON', () => {
    expect(previewValue(42, 50)).toBe('42')
    expect(previewValue(true, 50)).toBe('true')
    expect(previewValue(null, 50)).toBe('null')
    expect(previewValue('hi', 50)).toBe('"hi"')
  })

  it('summarises containers by size with singular and plural', () => {
    expect(previewValue([1], 50)).toBe('[1 item]')
    expect(previewValue([1, 2, 3], 50)).toBe('[3 items]')
    expect(previewValue([], 50)).toBe('[0 items]')
    expect(previewValue({ a: 1 }, 50)).toBe('{1 key}')
    expect(previewValue({ a: 1, b: 2 }, 50)).toBe('{2 keys}')
  })

  it('truncates with an ellipsis and never exceeds maxLen', () => {
    const out = previewValue('abcdefghijklmnop', 8)
    expect(out).toHaveLength(8)
    expect(out.endsWith('…')).toBe(true)
    expect(previewValue('abc', 5)).toBe('"abc"')
    expect(previewValue([1, 2, 3], 4)).toHaveLength(4)
  })

  it('clamps a tiny or fractional maxLen to at least one character', () => {
    expect(previewValue('abc', 0)).toHaveLength(1)
    expect(previewValue('abc', 2.9)).toHaveLength(2)
  })
})

describe('typeLabel', () => {
  it('labels every type', () => {
    const types: JsonType[] = ['object', 'array', 'string', 'number', 'boolean', 'null']
    for (const t of types) expect(typeLabel(t)).toBe(t)
  })
})
