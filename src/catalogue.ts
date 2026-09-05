import { isCompiledMessage, markCompiledMessage } from './compiled-message'
import type { KeyTable } from './key-table'
import { markMessageText, type TextOptions } from './text'
import {
  type CompiledMessage,
  isMessageGroup,
  type MessageGroup,
  type MessageList,
  type MessageNode,
} from './types'

/** Which parts of a catalogue to mark, and how to split their text. */
export interface CatalogueOptions extends TextOptions {
  /**
   * Top-level groups to leave alone.
   * Put a group here when its strings reach only `<title>` and `<meta>`.
   * Nobody can point at those strings.
   * A marker in a title also travels to the analytics pageview.
   */
  readonly skipGroups: readonly string[]
  /**
   * Group names, one level inside any group, to skip for the same reason.
   * A page needs this when it keeps head copy beside its own strings.
   */
  readonly skipNestedGroups: readonly string[]
}

/** The options that apply when a caller gives none. */
export const DEFAULT_CATALOGUE_OPTIONS: CatalogueOptions = {
  skipGroups: [],
  skipNestedGroups: [],
  pluralSeparator: '|',
  listSeparators: [],
}

/**
 * Copies a catalogue. Every string in the copy holds a marker.
 *
 * @param catalogue - The catalogue as the i18n library keeps it.
 * @param table - Key table for the markers. Every locale shares one table.
 * @param options - Which parts to skip, and how to split the text.
 * @returns A new catalogue. The function does not touch the original.
 * @example
 * ```ts
 * const table = new KeyTable(1)
 * const marked = markCatalogue({ hero: { title: 'Hi' } }, table)
 * table.keyFor(marked.hero.title as string) // 'hero.title'
 * ```
 */
export function markCatalogue(
  catalogue: MessageGroup,
  table: KeyTable,
  options: CatalogueOptions = DEFAULT_CATALOGUE_OPTIONS
): MessageGroup {
  return markGroup(catalogue, table, options, '')
}

function markGroup(
  group: MessageGroup,
  table: KeyTable,
  options: CatalogueOptions,
  prefix: string
): MessageGroup {
  const marked: Record<string, MessageNode> = {}

  for (const [segment, node] of Object.entries(group)) {
    const path = prefix === '' ? segment : `${prefix}.${segment}`
    marked[segment] = isSkipped(segment, prefix, options)
      ? node
      : markNode(node, table, options, path)
  }

  return marked
}

function isSkipped(segment: string, prefix: string, options: CatalogueOptions): boolean {
  if (prefix === '') return options.skipGroups.includes(segment)
  return !prefix.includes('.') && options.skipNestedGroups.includes(segment)
}

function markNode(
  node: MessageNode,
  table: KeyTable,
  options: CatalogueOptions,
  path: string
): MessageNode {
  if (typeof node === 'string') return markString(node, table, options, path)
  if (Array.isArray(node)) return markList(node, table, options, path)
  if (isCompiledMessage(node)) return markCompiled(node, table, options, path)
  if (isMessageGroup(node)) return markGroup(node, table, options, path)
  return node
}

// A marker makes an empty string not empty.
// A `t(key).length > 0` guard then shows copy that does not exist.
function markString(
  text: string,
  table: KeyTable,
  options: CatalogueOptions,
  path: string
): string {
  if (text === '') return text

  const marker = table.claim(path)
  const marked = markMessageText(text, marker, options)
  if (marked === null) table.release(path)
  return marked ?? text
}

function markList(
  list: MessageList,
  table: KeyTable,
  options: CatalogueOptions,
  path: string
): MessageList {
  return list.map((item, index) => markNode(item, table, options, `${path}.${index}`))
}

function markCompiled(
  message: CompiledMessage,
  table: KeyTable,
  options: CatalogueOptions,
  path: string
): MessageNode {
  const marker = table.claim(path)
  const marked = markCompiledMessage(message, marker, options)

  // A compiled message needs literal text to hold a marker.
  // Leave its key out when marking the message fails.
  if (marked === null) {
    table.release(path)
    return message
  }

  return marked
}
