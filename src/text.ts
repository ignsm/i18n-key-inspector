/** How to split the text of a message before each piece gets a marker. */
export interface TextOptions {
  /**
   * Separator that the i18n library reads as a plural branch.
   * vue-i18n uses `|`. Pass `null` for a library without plural syntax.
   */
  readonly pluralSeparator: string | null
  /**
   * Separators that the app splits a message on.
   * A `,,` joins a list that the app renders as several nodes.
   */
  readonly listSeparators: readonly string[]
}

/** Any value `JSON.parse` can produce. */
export type JsonValue = string | number | boolean | null | JsonValue[] | JsonObject

/** A JSON object. Each value is JSON as well. */
export interface JsonObject {
  readonly [key: string]: JsonValue
}

const ESCAPED_PIPE = "{'|'}"
const PIPE_PLACEHOLDER = '\u0000'

/**
 * Marks a plain message.
 * Each piece that the app renders alone gets one marker.
 *
 * @param text - The message as the catalogue holds it.
 * @param marker - Marker to put in front of every piece.
 * @param options - Separators that this app splits a message on.
 * @returns The marked message, or `null` to leave the message alone.
 * @example
 * ```ts
 * markMessageText('one note | {n} notes', marker, { listSeparators: [] })
 * // both branches hold the marker, so any count shows the key
 * ```
 */
export function markMessageText(text: string, marker: string, options: TextOptions): string | null {
  // Check for data before pipes.
  // A pipe inside a JSON list is text.
  // A split on that pipe breaks the list that the app parses.
  if (looksLikeData(text)) return markData(text, marker, options)

  const plural = options.pluralSeparator
  if (plural === null) return markPieces(text, marker, options)

  return text
    .split(ESCAPED_PIPE)
    .join(PIPE_PLACEHOLDER)
    .split(plural)
    .map((branch) => markPieces(branch, marker, options))
    .join(plural)
    .split(PIPE_PLACEHOLDER)
    .join(ESCAPED_PIPE)
}

/**
 * Marks text from a message that vue-i18n compiled already.
 * The compiler removed the `|`, so only app separators remain.
 *
 * @param text - Literal text of a compiled message.
 * @param marker - Marker to put in front of every piece.
 * @param options - Separators that this app splits a message on.
 * @returns The marked text, or `null` to leave the message alone.
 */
export function markCompiledText(
  text: string,
  marker: string,
  options: TextOptions
): string | null {
  if (looksLikeData(text)) return markData(text, marker, options)
  return markPieces(text, marker, options)
}

function markPieces(text: string, marker: string, options: TextOptions): string {
  let marked = markAfterIndent(text, marker)

  for (const separator of options.listSeparators) {
    marked = marked
      .split(separator)
      .map((piece, index) => (index === 0 ? piece : markAfterIndent(piece, marker)))
      .join(separator)
  }

  return marked
}

// Put the marker after the indent of the piece, never before it.
// Every split here trims the piece.
// A marker ahead of the space keeps that space in the text.
function markAfterIndent(text: string, marker: string): string {
  return text.replace(/^(\s*)/, `$1${marker}`)
}

function looksLikeData(text: string): boolean {
  const trimmed = text.trim()
  const opens = trimmed.startsWith('[') || trimmed.startsWith('{')
  const closes = trimmed.endsWith(']') || trimmed.endsWith('}')
  return opens && closes
}

// The values of a record can be icon names and other identifiers.
// Only a plain array of strings gets markers, item by item.
// The JSON then still parses.
function markData(text: string, marker: string, options: TextOptions): string | null {
  const parsed = parseJson(text.trim())
  if (parsed === null) return markPieces(text, marker, options)
  if (!isStringArray(parsed)) return null

  // An empty item stays empty, for the same reason as an empty message.
  const marked = parsed.map((item) => (item === '' ? item : markPieces(item, marker, options)))
  if (marked.every((item) => item === '')) return null

  return JSON.stringify(marked)
}

function parseJson(text: string): JsonValue | null {
  try {
    // The one cast in the package. `JSON.parse` returns `any` upstream.
    return JSON.parse(text) as JsonValue
  } catch {
    return null
  }
}

function isStringArray(value: JsonValue): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}
