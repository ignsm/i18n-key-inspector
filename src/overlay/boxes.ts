/**
 * Draws one box for each element that carries a key.
 *
 * The boxes go on top of the page.
 * The overlay never writes a style onto an element of the app.
 * Restyling a native control makes Safari resize it, which moves the page.
 *
 * @param into - The node that holds the boxes.
 * @param selector - Selector that finds every element with a key.
 * @example
 * ```ts
 * drawBoxes(surface.boxes, inspector.keySelector)
 * ```
 */
export function drawBoxes(into: HTMLElement, selector: string): void {
  // Read every rect, then write once.
  // A write between two reads forces the browser to lay the page out again.
  const rects = Array.from(document.querySelectorAll(selector))
    .map((element) => element.getBoundingClientRect())
    .filter((rect) => rect.width > 0 || rect.height > 0)

  into.replaceChildren(...rects.map(boxFor))
}

/**
 * Draws the stronger box for the element under the pointer.
 *
 * @param into - The node that holds this one box, and nothing else.
 * @param element - The element under the pointer, or `null` for none.
 */
export function markUnderPointer(into: HTMLElement, element: Element | null): void {
  if (element === null) {
    into.replaceChildren()
    return
  }

  const box = boxFor(element.getBoundingClientRect())
  box.classList.add('under')
  into.replaceChildren(box)
}

function boxFor(rect: DOMRect): HTMLElement {
  const box = document.createElement('div')
  box.className = 'box'
  box.style.left = `${rect.left}px`
  box.style.top = `${rect.top}px`
  box.style.width = `${rect.width}px`
  box.style.height = `${rect.height}px`
  return box
}
