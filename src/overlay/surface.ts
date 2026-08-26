/** The attribute that marks the overlay's own nodes. */
export const UI_ATTRIBUTE = 'data-i18n-inspector-ui'

// Everything the overlay draws lives in a shadow root.
// The page's reset cannot reach in, and our styles cannot leak out.
const STYLES = `
:host { all: initial; }
.box {
  position: fixed;
  box-sizing: border-box;
  border: 1px dashed rgba(59, 130, 246, 0.9);
  background: rgba(59, 130, 246, 0.08);
  pointer-events: none;
}
.box.under {
  border: 2px solid rgb(29, 78, 216);
  background: rgba(59, 130, 246, 0.2);
}
.tip {
  position: fixed;
  top: 0;
  left: 0;
  display: none;
  box-sizing: border-box;
  max-width: 80vw;
  padding: 6px 10px;
  border-radius: 6px;
  background: #0f172a;
  color: #fff;
  font: 12px ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  transition: background-color 120ms ease-out;
}
.tip.copied { background: #047857; }
.badge {
  position: fixed;
  right: 12px;
  bottom: 12px;
  box-sizing: border-box;
  padding: 5px 9px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.88);
  color: #e2e8f0;
  font: 11px ui-monospace, SFMono-Regular, Menlo, monospace;
  line-height: 1.4;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0.9;
  transition: opacity 140ms ease-out;
}
.badge::before {
  content: '';
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: #34d399;
  vertical-align: middle;
}
.badge.dim { opacity: 0.25; }
.tip.failed { background: #b91c1c; }
`

// A zero box, fixed in the corner.
// It cannot push the page, whatever the app's CSS says.
const HOST_STYLE: Readonly<Record<string, string>> = {
  position: 'fixed',
  top: '0',
  left: '0',
  width: '0',
  height: '0',
  margin: '0',
  padding: '0',
  border: '0',
  overflow: 'visible',
  'pointer-events': 'none',
  'z-index': '2147483647',
}

/** The nodes that the overlay owns. */
export interface Surface {
  /** The element in the page. Everything else hides inside its shadow root. */
  readonly host: HTMLElement
  /** Holds one box for each element that carries a key. */
  readonly boxes: HTMLElement
  /** Holds the single box for the element under the pointer. */
  readonly under: HTMLElement
  /** The corner label that says the mode is on. */
  readonly badge: HTMLElement
  /** The label that follows the pointer. */
  readonly tip: HTMLElement
}

/**
 * Builds the shadow root that the overlay draws in.
 *
 * @returns The host and the two nodes inside it.
 * @example
 * ```ts
 * const surface = createSurface()
 * surface.host.remove() // takes the whole overlay away
 * ```
 */
export function createSurface(): Surface {
  const host = document.createElement('div')
  host.setAttribute(UI_ATTRIBUTE, '')
  for (const [property, value] of Object.entries(HOST_STYLE)) {
    host.style.setProperty(property, value, 'important')
  }

  const root = host.attachShadow({ mode: 'open' })
  const style = document.createElement('style')
  style.textContent = STYLES

  const boxes = document.createElement('div')
  const under = document.createElement('div')
  const tip = document.createElement('div')
  tip.className = 'tip'
  const badge = document.createElement('div')
  badge.className = 'badge'
  root.append(style, boxes, under, tip, badge)

  document.body.append(host)
  return { host, boxes, under, tip, badge }
}
