const MARGIN = 12
const COPIED_MS = 1400

/** The label that follows the pointer and reports a copy. */
export interface Tooltip {
  /** Shows `text` at the pointer. */
  show(text: string, x: number, y: number): void
  /** Hides the label. */
  hide(): void
  /** Says `Copied` for a moment, then puts the key back. */
  reportCopy(worked: boolean): void
  /** Clears the pending timer. */
  destroy(): void
}

/**
 * Drives the label inside the overlay's shadow root.
 *
 * @param element - The label node.
 * @returns The calls that the overlay makes on it.
 * @example
 * ```ts
 * const tooltip = createTooltip(surface.tip)
 * tooltip.show('hero.header', event.clientX, event.clientY)
 * tooltip.reportCopy(true)
 * ```
 */
export function createTooltip(element: HTMLElement): Tooltip {
  let timer: ReturnType<typeof setTimeout> | null = null
  let shownKey = ''

  return {
    show(text: string, x: number, y: number): void {
      element.style.display = 'block'
      shownKey = text
      // Set the text before placing it. `place` measures the element.
      if (timer === null) element.textContent = text
      place(element, x, y)
    },

    hide(): void {
      element.style.display = 'none'
      element.classList.remove('copied', 'failed')
    },

    // The pointer can stand still, so the timer puts the key back itself.
    reportCopy(worked: boolean): void {
      element.textContent = worked ? 'Copied' : 'Copy failed'
      element.classList.add(worked ? 'copied' : 'failed')
      if (timer !== null) clearTimeout(timer)

      timer = setTimeout(() => {
        timer = null
        element.classList.remove('copied', 'failed')
        element.textContent = shownKey
      }, COPIED_MS)
    },

    destroy(): void {
      if (timer !== null) clearTimeout(timer)
      timer = null
    },
  }
}

// Keep the label inside the viewport, so it never grows the scroll area.
function place(element: HTMLElement, x: number, y: number): void {
  const width = element.offsetWidth
  const height = element.offsetHeight
  const left = Math.min(Math.max(0, x + MARGIN), Math.max(0, window.innerWidth - width))
  const top = Math.min(Math.max(0, y - height - 6), Math.max(0, window.innerHeight - height))

  element.style.left = `${left}px`
  element.style.top = `${top}px`
}
