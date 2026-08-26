import type { Inspector } from '../inspector'
import { drawBoxes, markUnderPointer } from './boxes'
import { createSurface } from './surface'
import { createTooltip } from './tooltip'

export type { Surface } from './surface'
export { UI_ATTRIBUTE } from './surface'
export type { Tooltip } from './tooltip'

/** How the overlay reacts to the pointer and the keyboard. */
export interface OverlayOptions {
  /** Key to hold. Holding it shows the key of everything on the page. */
  readonly modifier: 'Alt' | 'Control' | 'Meta' | 'Shift'
  /** Turns a key into the text that the tooltip shows and the click copies. */
  readonly formatKey: (key: string) => string
  /** Runs after a copy. Use it for your own reporting. */
  readonly onCopy: ((key: string) => void) | null
  /** Whether the corner label says that the mode is on. */
  readonly badge: boolean
}

/** The overlay that a caller can take away again. */
export interface Overlay {
  /** Removes the overlay and every listener. */
  destroy(): void
}

const DEFAULTS: OverlayOptions = {
  modifier: 'Alt',
  formatKey: (key: string) => key,
  onCopy: null,
  badge: true,
}

/**
 * Draws the keys on the page. Hold the modifier to see them.
 *
 * @param inspector - A started inspector.
 * @param init - Overlay options. Every field has a default.
 * @returns The overlay. Call `destroy()` to take it away.
 * @example
 * ```ts
 * const inspector = new Inspector(adapter)
 * inspector.start()
 * const overlay = createOverlay(inspector, { modifier: 'Control' })
 * ```
 */
export function createOverlay(inspector: Inspector, init: Partial<OverlayOptions> = {}): Overlay {
  const options: OverlayOptions = { ...DEFAULTS, ...init }

  const surface = createSurface()
  const tooltip = createTooltip(surface.tip)
  let held = false
  let frame = 0
  let alive = true

  surface.badge.textContent = `i18n-inspector on. Hold ${options.modifier}`
  if (!options.badge) surface.badge.remove()

  const draw = (): void => {
    if (held) drawBoxes(surface.boxes, inspector.keySelector)
    else surface.boxes.replaceChildren()
  }

  const redraw = (): void => {
    if (frame !== 0) cancelAnimationFrame(frame)
    frame = requestAnimationFrame(() => {
      frame = 0
      draw()
    })
  }

  const hide = (): void => {
    held = false
    surface.boxes.replaceChildren()
    surface.under.replaceChildren()
    surface.badge.classList.remove('dim')
    tooltip.hide()
  }

  const onKey = (event: KeyboardEvent): void => {
    if (event.key !== options.modifier || event.repeat) return
    if (event.type === 'keyup') {
      hide()
      return
    }
    held = true
    // The label steps back while the keys are on screen.
    surface.badge.classList.add('dim')
    draw()
  }

  // Only the one box under the pointer moves here.
  // Redrawing every box on each pointer move lays the whole page out again.
  const onMove = (event: MouseEvent): void => {
    if (!held) return

    const target = event.target instanceof Element ? event.target : null
    const holder = target?.closest(inspector.keySelector) ?? null
    markUnderPointer(surface.under, holder)

    if (holder === null) {
      tooltip.hide()
      return
    }

    const key = holder.getAttribute(inspector.keyAttribute) ?? ''
    tooltip.show(options.formatKey(key), event.clientX, event.clientY)
  }

  const onClick = (event: MouseEvent): void => {
    if (!held) return
    const target = event.target instanceof Element ? event.target : null
    const key = target === null ? null : inspector.keyAt(target)
    if (key === null) return

    event.preventDefault()
    event.stopImmediatePropagation()
    copy(options.formatKey(key))
  }

  // A rejected clipboard write reaches the host app's error reporting.
  // The overlay handles it, and the tooltip says what happened.
  const copy = (text: string): void => {
    const clipboard = navigator.clipboard
    if (clipboard === undefined) {
      tooltip.reportCopy(false)
      return
    }

    // The overlay can go away while the write is still in flight.
    const report = (worked: boolean): void => {
      if (!alive) return
      tooltip.reportCopy(worked)
      if (worked) options.onCopy?.(text)
    }

    try {
      clipboard.writeText(text).then(
        () => report(true),
        () => report(false)
      )
    } catch {
      report(false)
    }
  }

  window.addEventListener('keydown', onKey)
  window.addEventListener('keyup', onKey)
  window.addEventListener('blur', hide)
  // Capture, so a nested container's scroll reaches this too.
  document.addEventListener('scroll', redraw, { capture: true, passive: true })
  window.addEventListener('resize', redraw)
  const pageChanged = new MutationObserver(() => {
    if (held) redraw()
  })
  pageChanged.observe(document.body, { childList: true, subtree: true })
  document.addEventListener('mousemove', onMove)
  document.addEventListener('click', onClick, true)

  return {
    destroy(): void {
      alive = false
      hide()
      tooltip.destroy()
      if (frame !== 0) cancelAnimationFrame(frame)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', hide)
      document.removeEventListener('scroll', redraw, { capture: true })
      window.removeEventListener('resize', redraw)
      pageChanged.disconnect()
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('click', onClick, true)
      surface.host.remove()
    },
  }
}
