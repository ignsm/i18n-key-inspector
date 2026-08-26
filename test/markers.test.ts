import { describe, expect, it } from 'vitest'
import { decodeMarker, encodeMarker, hasMarker, stripMarkers } from '../src/markers'

describe('markers', () => {
  it('round-trips a value', () => {
    for (const value of [0, 1, 7, 42, 1246, 4095]) {
      expect(decodeMarker(encodeMarker(value))).toBe(value)
    }
  })

  it('adds nothing a reader can see', () => {
    const marked = `${encodeMarker(300)}Open your notes`

    expect(stripMarkers(marked)).toBe('Open your notes')
    expect(marked.replace(/[\u200B\u200C\u2060\u2064]/g, '')).toBe('Open your notes')
  })

  it('reports text without a marker', () => {
    expect(decodeMarker('Open your notes')).toBeNull()
    expect(hasMarker('Open your notes')).toBe(false)
    expect(stripMarkers('Open your notes')).toBe('Open your notes')
  })

  it('finds a marker anywhere in the text', () => {
    expect(hasMarker(`one,, ${encodeMarker(2)}two`)).toBe(true)
  })

  it('keeps no state between calls of the exported pattern', () => {
    const marked = `${encodeMarker(1)}a${encodeMarker(2)}b`

    expect(stripMarkers(marked)).toBe('ab')
    expect(stripMarkers(marked)).toBe('ab')
  })
})
