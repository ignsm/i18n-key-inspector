import {
  type Activation,
  type ActivationOptions,
  DEFAULT_ACTIVATION,
  listenForActivation,
} from './activation'
import { NoDocumentError } from './errors'
import { Inspector } from './inspector'
import type { InspectorInit } from './inspector-options'
import { createOverlay, type Overlay, type OverlayOptions } from './overlay'
import type { CatalogueAdapter } from './types'

/** Everything that `startInspector` accepts. */
export interface StartOptions extends InspectorInit, Partial<OverlayOptions> {
  /**
   * The shortcut that turns the mode on, and off again.
   * Pass `null` to start at once, with no shortcut.
   */
  readonly activation?: Partial<ActivationOptions> | null
}

/** The registered inspector, and the calls that drive it. */
export interface RunningInspector {
  /** The inspector itself, for `keyAt` and for your own UI. */
  readonly inspector: Inspector
  /** Whether the mode is on right now. */
  readonly active: boolean
  /** Turns the mode on, or off again. */
  toggle(): void
  /** Turns the mode off and removes the shortcut. */
  stop(): void
}

/**
 * Registers the inspector. Press the shortcut to see the keys.
 *
 * The page stays untouched until the shortcut fires.
 * The inspector marks nothing, and it rewrites no catalogue.
 * Registering costs one listener.
 *
 * @param adapter - Adapter for your i18n library.
 * @param options - Inspector, overlay, and activation options together.
 * @returns The registered inspector.
 * @throws {NoDocumentError} When it runs outside a browser.
 * @example
 * ```ts
 * startInspector(createVueI18nAdapter(i18n.global))
 * // press Alt three times, then hold Alt and point at any text
 * ```
 */
export function startInspector(
  adapter: CatalogueAdapter,
  options: StartOptions = {}
): RunningInspector {
  if (typeof window === 'undefined') throw new NoDocumentError()

  const inspector = new Inspector(adapter, options)
  const overlayOptions = withModifier(options)
  let overlay: Overlay | null = null

  const turnOn = (): void => {
    if (overlay !== null) return
    inspector.start()
    overlay = createOverlay(inspector, overlayOptions)
  }

  const turnOff = (): void => {
    overlay?.destroy()
    overlay = null
    inspector.stop()
  }

  const toggle = (): void => {
    if (overlay === null) turnOn()
    else turnOff()
  }

  const activation = register(options.activation, toggle)
  if (activation === null) turnOn()

  return {
    inspector,
    get active(): boolean {
      return overlay !== null
    },
    toggle,
    stop(): void {
      activation?.destroy()
      turnOff()
    },
  }
}

// You hold the key that turned the mode on.
// A caller can name a different one.
function withModifier(options: StartOptions): StartOptions {
  const key = options.activation?.key
  if (options.modifier !== undefined || key === undefined) return options
  if (!MODIFIERS.includes(key)) return options
  return { ...options, modifier: key as OverlayOptions['modifier'] }
}

const MODIFIERS: readonly string[] = ['Alt', 'Control', 'Meta', 'Shift']

function register(
  init: Partial<ActivationOptions> | null | undefined,
  toggle: () => void
): Activation | null {
  if (init === null) return null
  return listenForActivation(toggle, { ...DEFAULT_ACTIVATION, ...init })
}
