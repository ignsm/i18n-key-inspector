import { markCatalogue } from './catalogue'
import { type ReaderContext, readAttributeMarkers, readMarkers } from './dom'
import { NoDocumentError } from './errors'
import {
  DEFAULT_INSPECTOR_OPTIONS,
  type InspectorInit,
  type InspectorOptions,
} from './inspector-options'
import { KeyTable } from './key-table'
import type { CatalogueAdapter, MessageGroup } from './types'
import { createWatcher } from './watcher'

/**
 * Marks a catalogue, so every string holds its own key.
 * It then reads those keys back from the DOM.
 *
 * @example
 * ```ts
 * const inspector = new Inspector(adapter, { listSeparators: [',,'] })
 * inspector.start()
 * inspector.keyAt(document.querySelector('h1')) // 'main.hero.header'
 * inspector.stop()
 * ```
 */
export class Inspector {
  readonly #adapter: CatalogueAdapter
  readonly #options: InspectorOptions
  readonly #originals = new Map<string, MessageGroup>()

  #table = new KeyTable(0)
  #generation = 0
  #selfInflictedUntil = 0
  #running = false
  #observer: MutationObserver | null = null
  #onScroll: (() => void) | null = null
  #reapplyTimer: ReturnType<typeof setTimeout> | null = null
  #hydrationTimer: ReturnType<typeof setTimeout> | null = null
  #labelled = new WeakSet<Element>()
  readonly #tagged = new Map<Element, string | null>()

  constructor(adapter: CatalogueAdapter, init: InspectorInit = {}) {
    this.#adapter = adapter
    this.#options = { ...DEFAULT_INSPECTOR_OPTIONS, ...init }
  }

  /** Whether the inspector is currently marking the page. */
  get active(): boolean {
    return this.#running
  }

  /** Attribute that holds the key on a tagged element. */
  get keyAttribute(): string {
    return this.#attribute
  }

  /** Selector that finds every element with a key. */
  get keySelector(): string {
    return `[${this.#attribute}]`
  }

  /**
   * Marks every loaded catalogue.
   * It then watches the page for new content.
   *
   * A second call does nothing.
   * A second snapshot would take the marked catalogue for the original one.
   * The markers would then stay forever.
   *
   * @throws {NoDocumentError} When there is no document to read.
   */
  start(): void {
    if (this.#running) return
    if (typeof document === 'undefined') throw new NoDocumentError()

    this.#running = true
    try {
      this.#apply()
      this.#watch()
      this.#watchScroll()
      this.#hydrationTimer = setTimeout(() => this.#apply(), this.#options.hydrationDelayMs)
    } catch (failure) {
      // A half-started inspector would keep the markers forever.
      this.stop()
      throw failure
    }
  }

  /** Restores every catalogue and removes every key the inspector wrote. */
  stop(): void {
    if (!this.#running) return
    this.#running = false

    try {
      this.#restore()
    } finally {
      this.#observer?.disconnect()
      this.#observer = null
      if (this.#onScroll !== null) window.removeEventListener('scroll', this.#onScroll)
      this.#onScroll = null
      this.#clearTimers()
      this.#clearTags()
    }
  }

  // Every locale gets its catalogue back, even when one of them fails.
  #restore(): void {
    let failure: unknown = null

    for (const [locale, original] of this.#originals) {
      try {
        this.#adapter.setCatalogue(locale, original)
      } catch (error) {
        failure = failure ?? error
      }
    }

    this.#originals.clear()
    if (failure !== null) throw failure
  }

  // Only the elements from this run, and only the value from this run.
  // The app can own the same attribute on an element of its own.
  #clearTags(): void {
    for (const [element, previous] of this.#tagged) {
      if (previous === null) element.removeAttribute(this.#attribute)
      else element.setAttribute(this.#attribute, previous)
    }
    this.#tagged.clear()
    this.#labelled = new WeakSet()
  }

  /**
   * Reads the key of the nearest tagged element.
   *
   * @param element - Element under the pointer.
   * @returns The key, or `null` when no catalogue made this text.
   */
  keyAt(element: Element): string | null {
    return element.closest(`[${this.#attribute}]`)?.getAttribute(this.#attribute) ?? null
  }

  get #attribute(): string {
    return this.#options.keyAttribute
  }

  get #reader(): ReaderContext {
    return {
      keyAttribute: this.#attribute,
      keyFor: (marked: string) => this.#table.keyFor(marked),
      labelled: this.#labelled,
      onTag: (element: Element) => this.#remember(element),
    }
  }

  #remember(element: Element): void {
    if (this.#tagged.has(element)) return
    this.#tagged.set(element, element.getAttribute(this.#attribute))
  }

  // One table covers every loaded locale.
  // The app renders a missing string from the fallback locale.
  // One table for each locale would point that marker at another key.
  #apply(): void {
    if (!this.#running) return

    this.#snapshotLocales()
    this.#generation += 1
    this.#table = new KeyTable(this.#generation)
    this.#labelled = new WeakSet()
    this.#selfInflictedUntil = Date.now() + this.#options.selfInflictedMs

    for (const [locale, original] of this.#originals) {
      this.#adapter.setCatalogue(locale, markCatalogue(original, this.#table, this.#options))
    }
  }

  #snapshotLocales(): void {
    const locales = [this.#adapter.currentLocale(), ...this.#adapter.loadedLocales()]
    for (const locale of locales) {
      if (this.#originals.has(locale)) continue

      const catalogue = this.#adapter.getCatalogue(locale)
      if (Object.keys(catalogue).length > 0) this.#originals.set(locale, catalogue)
    }
  }

  // A section that hydrates on scroll adopts the server text in place, so the
  // observer sees no mutation. Scrolling is the only signal that it happened.
  #watchScroll(): void {
    this.#onScroll = () => this.#scheduleApply()
    window.addEventListener('scroll', this.#onScroll, { passive: true })
  }

  #watch(): void {
    this.#observer = createWatcher({
      toolSelector: this.#options.toolSelector,
      read: (node: Node) => readMarkers(node, this.#reader),
      readAttributes: (element: Element) => readAttributeMarkers(element, this.#reader),
      isOwnChurn: () => Date.now() <= this.#selfInflictedUntil,
      onForeignContent: () => this.#scheduleApply(),
    })

    this.#observer.observe(document.body, {
      attributes: true,
      characterData: true,
      childList: true,
      subtree: true,
    })
    readMarkers(document.body, this.#reader)
  }

  #scheduleApply(): void {
    if (this.#reapplyTimer !== null) clearTimeout(this.#reapplyTimer)
    this.#reapplyTimer = setTimeout(() => this.#apply(), this.#options.reapplyDelayMs)
  }

  #clearTimers(): void {
    for (const timer of [this.#reapplyTimer, this.#hydrationTimer]) {
      if (timer !== null) clearTimeout(timer)
    }
    this.#reapplyTimer = null
    this.#hydrationTimer = null
  }
}
