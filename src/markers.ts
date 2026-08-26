const START = '\u2060'
const END = '\u2064'
const ZERO = '\u200B'
const ONE = '\u200C'

// Use escapes, not the characters.
// A zero-width character in source is invisible, and it trips a linter.
const MARKER_SOURCE = `${START}[${ZERO}${ONE}]+${END}`

// A fresh regex for each call. A shared global one carries `lastIndex`.
function everyMarker(): RegExp {
  return new RegExp(MARKER_SOURCE, 'g')
}

/**
 * Encodes a number as an invisible prefix built from zero-width characters.
 *
 * @param value - Non-negative safe integer to encode.
 * @returns A marker string that renders as nothing.
 * @throws {RangeError} When the value cannot survive a round trip.
 * @example
 * ```ts
 * const marked = encodeMarker(7) + 'Open your notes'
 * marked.length > 'Open your notes'.length // true, and it looks the same
 * ```
 */
export function encodeMarker(value: number): string {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`A marker needs a non-negative safe integer, got ${value}`)
  }

  const bits = value
    .toString(2)
    .split('')
    .map((bit) => (bit === '1' ? ONE : ZERO))
    .join('')
  return `${START}${bits}${END}`
}

/**
 * Reads the first marker in a string.
 *
 * @param text - Text that can carry a marker.
 * @returns The encoded number, or `null` when the text carries no marker.
 * @example
 * ```ts
 * decodeMarker(encodeMarker(7) + 'Open your notes') // 7
 * decodeMarker('Open your notes') // null
 * ```
 */
export function decodeMarker(text: string): number | null {
  const match = new RegExp(MARKER_SOURCE).exec(text)
  if (match === null) return null

  const bits = match[0]
    .slice(1, -1)
    .split('')
    .map((character) => (character === ONE ? '1' : '0'))
    .join('')
  return Number.parseInt(bits, 2)
}

/**
 * Reports whether a string carries a marker.
 *
 * @param text - Text to test.
 * @returns `true` when the text has one marker or more.
 */
export function hasMarker(text: string): boolean {
  return new RegExp(MARKER_SOURCE).test(text)
}

/**
 * Removes every marker from a string.
 *
 * @param text - Text that can carry markers.
 * @returns The text that a reader sees.
 * @example
 * ```ts
 * stripMarkers(encodeMarker(7) + 'Open your notes') // 'Open your notes'
 * ```
 */
export function stripMarkers(text: string): string {
  return text.replace(everyMarker(), '')
}
