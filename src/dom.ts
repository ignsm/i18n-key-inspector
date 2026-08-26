import { hasMarker, stripMarkers } from './markers'

/** What the DOM reader needs. It turns a marker into a tagged element. */
export interface ReaderContext {
  /** Attribute that holds the key, such as `data-i18n-key`. */
  readonly keyAttribute: string
  /** Finds the key of a marker in the current table. */
  readonly keyFor: (marked: string) => string | null
  /**
   * Elements that already have a key this round.
   * An element can hold more than one marked attribute.
   * The first attribute names it.
   * The next pass clears the set, so a new marker can replace an old key.
   */
  readonly labelled: WeakSet<Element>
  /** Runs before the reader writes the key attribute on an element. */
  readonly onTag: (element: Element) => void
}

/**
 * Tags an element from the markers in its attributes.
 * It then removes the markers, so an `href` stays a valid URL.
 *
 * @param element - Element with attributes that can hold markers.
 * @param context - Key attribute, key lookup, and the labelled set.
 */
export function readAttributeMarkers(element: Element, context: ReaderContext): void {
  for (const attribute of Array.from(element.attributes)) {
    const key = context.keyFor(attribute.value)
    if (key === null) continue

    if (!context.labelled.has(element)) {
      context.onTag(element)
      element.setAttribute(context.keyAttribute, key)
      context.labelled.add(element)
    }
    element.setAttribute(attribute.name, stripMarkers(attribute.value))
  }
}

/**
 * Tags elements from the markers in their text.
 * It then removes the markers.
 *
 * The marker travels inside the string.
 * A `v-html` block therefore tags its own container.
 * Repeated copy tags each place with its own key.
 *
 * @param root - Subtree to read, or a text node on its own.
 * @param context - Key attribute, key lookup, and the labelled set.
 */
export function readMarkers(root: Node, context: ReaderContext): void {
  if (root instanceof Element) {
    readAttributeMarkers(root, context)
    for (const child of Array.from(root.querySelectorAll('*'))) {
      readAttributeMarkers(child, context)
    }
  }

  for (const text of collectTextNodes(root)) {
    const key = context.keyFor(text.data)
    if (key === null) continue

    const parent = text.parentElement
    if (parent !== null) {
      context.onTag(parent)
      parent.setAttribute(context.keyAttribute, key)
    }
    text.data = stripMarkers(text.data)
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

function collectTextNodes(root: Node): readonly Text[] {
  const nodes: Text[] = []
  if (root.nodeType === Node.TEXT_NODE) nodes.push(root as Text)

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let node = walker.nextNode()
  while (node !== null) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }

  return nodes
}
