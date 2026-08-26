import { decodeMarker, encodeMarker } from './markers'

/**
 * The list of keys the markers point at.
 *
 * Every locale in one pass uses one table.
 * The app renders a missing string from the fallback catalogue.
 * One table for each locale would point that marker at another key.
 *
 * @example
 * ```ts
 * const table = new KeyTable(1)
 * const marker = table.claim('main.hero.header')
 * table.keyFor(marker) // 'main.hero.header'
 * ```
 */
export class KeyTable {
  readonly #keys: string[] = []
  readonly #generation: number

  /**
   * @param generation - Number of the round.
   * Its parity goes into every marker.
   * A new round changes each string, so the framework renders again.
   */
  constructor(generation: number) {
    this.#generation = generation
  }

  /** How many keys the table holds. */
  get size(): number {
    return this.#keys.length
  }

  /**
   * Adds a key. It returns the marker that points at the key.
   *
   * @param key - Dotted path of the message, such as `main.hero.header`.
   * @returns The marker to put in front of the text of the message.
   */
  claim(key: string): string {
    const index = this.#keys.push(key) - 1
    return encodeMarker(index * 2 + (this.#generation & 1))
  }

  /**
   * Gives back the key that belongs to a marker.
   *
   * A marker from an older round resolves to `null`.
   * Its index can point at another key in this table.
   *
   * @param marked - Text with a marker, or a marker on its own.
   * @returns The key, or `null` when the table does not know the marker.
   */
  keyFor(marked: string): string | null {
    const value = decodeMarker(marked)
    if (value === null) return null
    if ((value & 1) !== (this.#generation & 1)) return null
    return this.#keys[value >> 1] ?? null
  }

  /**
   * Drops the key from the last claim.
   * Call it for a message that cannot hold a marker.
   *
   * @param key - The key from the last claim. It guards against a mismatch.
   * @throws {RangeError} When `key` did not come from the last claim.
   */
  release(key: string): void {
    if (this.#keys[this.#keys.length - 1] !== key) {
      throw new RangeError(`Cannot release "${key}": it was not claimed last`)
    }
    this.#keys.pop()
  }
}
