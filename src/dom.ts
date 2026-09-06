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
  readonly texts: WeakMap<Element, readonly MarkerSource[]>
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
// Hold the sources in DOM order instead, so the new node finds one.
function readTexts(element: Element, context: ReaderContext): string | null {
  const carried = [...(context.texts.get(element) ?? [])]
  const texts: MarkerSource[] = []
  let key: string | null = null

  for (const node of Array.from(element.childNodes)) {
    if (!(node instanceof Text)) continue
    const source = readSource(node.data, takeSource(carried, node.data), context)
    if (source === null) continue
    texts.push(source)
    key = source.key
    if (node.data !== source.value) node.data = source.value
  }
  if (texts.length === 0) context.texts.delete(element)
  else context.texts.set(element, texts)

  return key
}

// Two messages can render the same text, and each keeps its own key.
// One source therefore serves one node. Take it out of the list.
// Plain text that repeats a translation then carries no key.
function takeSource(carried: MarkerSource[], value: string): MarkerSource | undefined {
  const index = carried.findIndex((source) => source.value === value)
  if (index === -1) return undefined
  return carried.splice(index, 1)[0]
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
  if (attributes.size === 0) context.attributes.delete(element)
  else context.attributes.set(element, attributes)

  return key
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
