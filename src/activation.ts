/** How the developer turns the inspector on. */
export interface ActivationOptions {
  /** Key to press. The same key then works as the modifier. */
  readonly key: string
  /** How many presses turn the mode on, and off again. */
  readonly presses: number
  /** How long one gap between two presses may be, in milliseconds. */
  readonly windowMs: number
}

/** The default: three quick presses of Alt, which is Option on a Mac. */
export const DEFAULT_ACTIVATION: ActivationOptions = {
  key: 'Alt',
  presses: 3,
  windowMs: 600,
}

/** A registered shortcut that a caller can take away again. */
export interface Activation {
  /** Removes the listener. */
  destroy(): void
}

/**
 * Calls `toggle` when the developer presses the key often enough, fast enough.
 *
 * A held key repeats, so a repeat never counts as a press.
 *
 * @param toggle - Runs on each completed run of presses.
 * @param options - Key, count, and time window.
 * @param now - Clock, for tests.
 * @returns The registered shortcut.
 * @example
 * ```ts
 * const activation = listenForActivation(() => inspector.start())
 * activation.destroy()
 * ```
 */
export function listenForActivation(
  toggle: () => void,
  options: ActivationOptions = DEFAULT_ACTIVATION,
  now: () => number = Date.now
): Activation {
  let presses = 0
  let last = 0

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== options.key || event.repeat) return

    const at = now()
    presses = at - last < options.windowMs ? presses + 1 : 1
    last = at

    if (presses < options.presses) return
    presses = 0
    toggle()
  }

  window.addEventListener('keydown', onKeyDown)

  return {
    destroy(): void {
      window.removeEventListener('keydown', onKeyDown)
    },
  }
}
