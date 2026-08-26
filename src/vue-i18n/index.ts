import type { CatalogueAdapter, MessageGroup } from '../types'

/**
 * The part of a vue-i18n Composer that the adapter uses.
 * This file declares it, so the core also runs without vue-i18n.
 */
export interface ComposerLike {
  readonly locale: { readonly value: string }
  readonly availableLocales: readonly string[]
  getLocaleMessage(locale: string): MessageGroup
  setLocaleMessage(locale: string, message: MessageGroup): void
}

/**
 * Adapts a vue-i18n Composer to the inspector.
 *
 * A vue-i18n Composer types its catalogue loosely, so pass it through here.
 * The walk checks each node, and leaves an unknown shape alone.
 *
 * @param composer - The Composer from `useI18n()` or from `i18n.global`.
 * @returns An adapter for the inspector.
 * @example
 * ```ts
 * const inspector = new Inspector(createVueI18nAdapter(i18n.global))
 * inspector.start()
 * ```
 */
export function createVueI18nAdapter(composer: ComposerLike): CatalogueAdapter {
  return {
    currentLocale(): string {
      return composer.locale.value
    },

    loadedLocales(): readonly string[] {
      return composer.availableLocales
    },

    getCatalogue(locale: string): MessageGroup {
      return composer.getLocaleMessage(locale)
    },

    setCatalogue(locale: string, catalogue: MessageGroup): void {
      composer.setLocaleMessage(locale, catalogue)
    },
  }
}
