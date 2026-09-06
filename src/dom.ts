import { hasMarker, stripMarkers } from './markers'

/** A key and the clean value that still belongs to it. */
export interface MarkerSource {
  readonly key: string
  readonly value: string
}

/** What the DOM reader needs. It turns a marker into a tagged element. */
export interface ReaderContext {
  readonly keyAttribute: string
  readonly keyFor: (marked: string) => string | null
  readonly texts: WeakMap<Element, Map<string, MarkerSource>>
  readonly attributes: WeakMap<Element, Map<string, MarkerSource>>
  readonly onTag: (element: Element) => void
  readonly onClear: (element: Element) => void
}

/**
 * Reads the sources on one element and updates its key.
 * Text takes precedence over attributes.
 * The last marked text node wins, and the first marked attribute wins.
 *
 * @param element - Element whose text or attributes changed.
 * @param context - Key lookup and sources from earlier reads.
 */
export function readElementMarkers(element: Element, context: ReaderContext): void {
  const attributeKey = readAttributes(element, context)
  const textKey = readTexts(element, context)
  const key = textKey ?? attributeKey

  if (key === null) {
    context.onClear(element)
  } else if (element.getAttribute(context.keyAttribute) !== key) {
    context.onTag(element)
    element.setAttribute(context.keyAttribute, key)
  }
}

// The app can rebuild a text node and write the same text again.
// A source held against the node itself dies with the old node.
// Hold it against the clean text, so the new node finds it.
// One source serves one node, so later plain text carries no key.
function readTexts(element: Element, context: ReaderContext): string | null {
  const previous = context.texts.get(element)
  const texts = new Map<string, MarkerSource>()
  let key: string | null = null

  for (const node of Array.from(element.childNodes)) {
    if (!(node instanceof Text)) continue
    const carried = texts.has(node.data) ? undefined : previous?.get(node.data)
    const source = readSource(node.data, carried, context)
    if (source === null) continue
    texts.set(source.value, source)
    key = source.key
    if (node.data !== source.value) node.data = source.value
  }
  keepSources(context.texts, element, texts)

  return key
}

function readAttributes(element: Element, context: ReaderContext): string | null {
  const previous = context.attributes.get(element)
  const attributes = new Map<string, MarkerSource>()
  let key: string | null = null

  for (const attribute of Array.from(element.attributes)) {
    if (attribute.name === context.keyAttribute) continue
    const source = readSource(attribute.value, previous?.get(attribute.name), context)
    if (source === null) continue
    attributes.set(attribute.name, source)
    key ??= source.key
    if (attribute.value !== source.value) element.setAttribute(attribute.name, source.value)
  }
  keepSources(context.attributes, element, attributes)

  return key
}

// An empty map serves no previous value.
// The first pass reads every element on the page, so do not keep one each.
function keepSources(
  cache: WeakMap<Element, Map<string, MarkerSource>>,
  element: Element,
  sources: Map<string, MarkerSource>
): void {
  if (sources.size === 0) cache.delete(element)
  else cache.set(element, sources)
}

// Our cleanup also produces mutations. Keep the key for that clean value.
function readSource(
  value: string,
  previous: MarkerSource | undefined,
  context: ReaderContext
): MarkerSource | null {
  const key = context.keyFor(value)
  if (key !== null) return { key, value: stripMarkers(value) }
  return previous?.value === value ? previous : null
}

/**
 * Reads markers in a subtree or in a text node's parent.
 *
 * @param root - Subtree to read, or a text node on its own.
 * @param context - Key lookup and sources from earlier reads.
 */
export function readMarkers(root: Node, context: ReaderContext): void {
  if (root instanceof Element) {
    readElementMarkers(root, context)
    for (const child of Array.from(root.querySelectorAll('*'))) {
      readElementMarkers(child, context)
    }
  } else if (root.parentElement !== null) {
    readElementMarkers(root.parentElement, context)
  }
}

/**
 * Decides if new content forces another pass over the catalogue.
 *
 * @param text - Text of the added node.
 * @param insideTool - `true` when the node belongs to our own UI.
 * @returns `true` for unmarked copy that the app rendered by itself.
 * @example
 * ```ts
 * isForeignText('New section', false) // true
 * isForeignText(markedText, false) // false, ours already
 * isForeignText('main.hero.header', true) // false, our own tooltip
 * ```
 */
export function isForeignText(text: string, insideTool: boolean): boolean {
  if (insideTool) return false
  return text.trim().length > 0 && !hasMarker(text)
}
