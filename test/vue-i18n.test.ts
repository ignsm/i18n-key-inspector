import { afterEach, describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import { Inspector } from '../src/inspector'
import { stripMarkers } from '../src/markers'
import { type ComposerLike, createVueI18nAdapter } from '../src/vue-i18n/index'

const messages = {
  en: {
    hero: { header: 'Save your note' },
    cart: { count: 'one note | {n} notes' },
    greeting: 'Hello {name}',
    faq: { questions: 'One?,, Two?' },
    seo: { title: 'Notes app' },
  },
  es: {
    hero: { header: 'Guarda tu nota' },
  },
}

const createComposer = (locale = 'en'): ComposerLike => {
  const i18n = createI18n({ legacy: false, locale, fallbackLocale: 'en', messages })
  return i18n.global as unknown as ComposerLike
}

describe('the vue-i18n adapter', () => {
  let inspector: Inspector | null = null

  afterEach(() => {
    inspector?.stop()
    inspector = null
  })

  it('marks a message that the runtime compiler already compiled', () => {
    const composer = createComposer()
    // The first call compiles the message.
    // The AST path then runs, not the plain-string path.
    composer.getLocaleMessage('en')
    const adapter = createVueI18nAdapter(composer)
    const translate = (key: string): string => (composer as never as Translator).t(key)

    translate('hero.header')
    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()

    expect(stripMarkers(translate('hero.header'))).toBe('Save your note')
  })

  it('keeps both plural branches usable, and marks the one it renders', () => {
    const composer = createComposer()
    const adapter = createVueI18nAdapter(composer)
    const translate = composer as never as Translator

    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()

    expect(stripMarkers(translate.t('cart.count', 1))).toBe('one note')
    expect(stripMarkers(translate.t('cart.count', 2))).toBe('2 notes')
  })

  it('keeps a named interpolation working', () => {
    const composer = createComposer()
    const adapter = createVueI18nAdapter(composer)
    const translate = composer as never as Translator

    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()

    expect(stripMarkers(translate.t('greeting', { name: 'Ada' }))).toBe('Hello Ada')
  })

  it('leaves a skipped group without a marker', () => {
    const composer = createComposer()
    const adapter = createVueI18nAdapter(composer)
    const translate = composer as never as Translator

    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()

    expect(translate.t('seo.title')).toBe('Notes app')
  })

  it('restores the catalogue when it stops', () => {
    const composer = createComposer()
    const adapter = createVueI18nAdapter(composer)
    const translate = composer as never as Translator

    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()
    inspector.stop()

    expect(translate.t('hero.header')).toBe('Save your note')
    expect(translate.t('cart.count', 2)).toBe('2 notes')
  })

  it('marks the fallback locale as well', () => {
    const composer = createComposer('es')
    const adapter = createVueI18nAdapter(composer)
    const translate = composer as never as Translator

    inspector = new Inspector(adapter, { skipGroups: ['seo'] })
    inspector.start()

    expect(stripMarkers(translate.t('greeting', { name: 'Ada' }))).toBe('Hello Ada')
  })
})

interface Translator {
  t(key: string, plural?: number | Record<string, unknown>): string
}
