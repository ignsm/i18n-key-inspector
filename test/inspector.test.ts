import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NoDocumentError } from '../src/errors'
import { Inspector } from '../src/inspector'
import { stripMarkers } from '../src/markers'
import type { CatalogueAdapter, MessageGroup, MessageNode } from '../src/types'

interface FakeApp {
  readonly adapter: CatalogueAdapter
  /** Renders `key` into `element`, the way a framework would on re-render. */
  readonly render: (element: Element, key: string, attribute?: string) => void
  readonly setLocale: (locale: string) => void
}

const createApp = (catalogues: Record<string, MessageGroup>, locale: string): FakeApp => {
  const live: Record<string, MessageGroup> = { ...catalogues }
  const bindings: { element: Element; key: string; attribute: string | undefined }[] = []
  let current = locale

  const lookup = (key: string): string => {
    for (const source of [live[current], live.en]) {
      const found = read(source, key)
      if (found !== null) return found
    }
    return key
  }

  const paint = (): void => {
    for (const binding of bindings) {
      const value = lookup(binding.key)
      if (binding.attribute === undefined) binding.element.textContent = value
      else binding.element.setAttribute(binding.attribute, value)
    }
  }

  return {
    adapter: {
      currentLocale: () => current,
      loadedLocales: () => Object.keys(live),
      getCatalogue: (name: string) => live[name] ?? {},
      setCatalogue: (name: string, catalogue: MessageGroup) => {
        live[name] = catalogue
        paint()
      },
    },
    render: (element: Element, key: string, attribute?: string) => {
      bindings.push({ element, key, attribute })
      paint()
    },
    setLocale: (next: string) => {
      current = next
      paint()
    },
  }
}

const read = (group: MessageGroup | undefined, key: string): string | null => {
  let node: MessageNode | undefined = group
  for (const segment of key.split('.')) {
    if (node === undefined || typeof node === 'string' || Array.isArray(node)) return null
    node = (node as MessageGroup)[segment]
  }
  return typeof node === 'string' ? node : null
}

const flushObserver = async (): Promise<void> => {
  await Promise.resolve()
  await Promise.resolve()
}

describe('Inspector', () => {
  let inspector: Inspector | null = null

  beforeEach(() => {
    document.body.innerHTML = ''
  })

  afterEach(() => {
    inspector?.stop()
    inspector = null
    vi.useRealTimers()
  })

  it('tags an element with the key that produced its text', () => {
    const app = createApp({ en: { hero: { header: 'Save your note' } } }, 'en')
    const heading = document.createElement('h1')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    inspector = new Inspector(app.adapter)
    inspector.start()

    expect(inspector.keyAt(heading)).toBe('hero.header')
    expect(heading.textContent).toBe('Save your note')
  })

  it('tags an element from a marked attribute and leaves the value clean', () => {
    const app = createApp({ en: { nav: { home: 'Home' } } }, 'en')
    const link = document.createElement('a')
    document.body.append(link)
    app.render(link, 'nav.home', 'aria-label')

    inspector = new Inspector(app.adapter)
    inspector.start()

    expect(inspector.keyAt(link)).toBe('nav.home')
    expect(link.getAttribute('aria-label')).toBe('Home')
  })

  it('reports the fallback locale key for a string this locale is missing', () => {
    const app = createApp(
      { en: { note: { badge: 'Draft', title: 'Note' } }, es: { note: { title: 'Nota' } } },
      'es'
    )
    const badge = document.createElement('span')
    document.body.append(badge)
    app.render(badge, 'note.badge')

    inspector = new Inspector(app.adapter)
    inspector.start()

    expect(inspector.keyAt(badge)).toBe('note.badge')
    expect(badge.textContent).toBe('Draft')
  })

  it('restores every catalogue and removes every key it wrote', () => {
    const app = createApp(
      { en: { hero: { header: 'Hi' } }, es: { hero: { header: 'Hola' } } },
      'en'
    )
    const heading = document.createElement('h1')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    inspector = new Inspector(app.adapter)
    inspector.start()
    inspector.stop()

    expect(app.adapter.getCatalogue('en')).toEqual({ hero: { header: 'Hi' } })
    expect(app.adapter.getCatalogue('es')).toEqual({ hero: { header: 'Hola' } })
    expect(heading.hasAttribute('data-i18n-key')).toBe(false)
    expect(heading.textContent).toBe('Hi')
    expect(inspector.active).toBe(false)
  })

  it('keeps the markers reversible when started twice', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const heading = document.createElement('h1')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    inspector = new Inspector(app.adapter)
    inspector.start()
    inspector.start()
    inspector.stop()

    expect(app.adapter.getCatalogue('en')).toEqual({ hero: { header: 'Hi' } })
    expect(stripMarkers(heading.textContent ?? '')).toBe('Hi')
  })

  it('still finds the key after the app switches locale', async () => {
    const app = createApp(
      { en: { hero: { header: 'Hi' } }, es: { hero: { header: 'Hola' } } },
      'en'
    )
    const heading = document.createElement('h1')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    inspector = new Inspector(app.adapter)
    inspector.start()
    app.setLocale('es')
    await flushObserver()

    expect(inspector.keyAt(heading)).toBe('hero.header')
    expect(heading.textContent).toBe('Hola')
  })

  it('marks again when the app renders content of its own', async () => {
    vi.useFakeTimers()
    const app = createApp({ en: { late: { header: 'Later' } } }, 'en')
    inspector = new Inspector(app.adapter)
    inspector.start()

    const section = document.createElement('section')
    section.textContent = 'Later'
    document.body.append(section)
    await flushObserver()

    vi.advanceTimersByTime(1000)
    app.render(section, 'late.header')
    await flushObserver()

    expect(inspector.keyAt(section)).toBe('late.header')
  })

  it('does not mark again for its own tooltip', async () => {
    vi.useFakeTimers()
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const heading = document.createElement('h1')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    // A long hydration delay holds the extra pass outside this window.
    // A call to setCatalogue can then only come from the tooltip.
    inspector = new Inspector(app.adapter, { hydrationDelayMs: 60_000 })
    inspector.start()
    vi.advanceTimersByTime(1000)
    const applied = vi.spyOn(app.adapter, 'setCatalogue')

    const tooltip = document.createElement('div')
    tooltip.setAttribute('data-i18n-inspector-ui', '')
    document.body.append(tooltip)
    tooltip.textContent = 'hero.header'
    await flushObserver()
    vi.advanceTimersByTime(1000)

    expect(applied).not.toHaveBeenCalled()
  })

  it('returns null for text no catalogue produced', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const stray = document.createElement('p')
    stray.textContent = 'Hardcoded'
    document.body.append(stray)

    inspector = new Inspector(app.adapter)
    inspector.start()

    expect(inspector.keyAt(stray)).toBeNull()
  })
})

describe('NoDocumentError', () => {
  it('names itself, so a caller can tell it apart', () => {
    expect(new NoDocumentError().name).toBe('NoDocumentError')
  })
})

describe('Inspector.stop before start', () => {
  it('leaves an attribute that the app owns', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const heading = document.createElement('h1')
    heading.setAttribute('data-i18n-key', 'app.owns.this')
    document.body.append(heading)

    const inspector = new Inspector(app.adapter)
    inspector.stop()

    expect(heading.getAttribute('data-i18n-key')).toBe('app.owns.this')
  })

  it('gives an app-owned attribute back after a run', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const heading = document.createElement('h1')
    heading.setAttribute('data-i18n-key', 'app.owns.this')
    document.body.append(heading)
    app.render(heading, 'hero.header')

    const inspector = new Inspector(app.adapter)
    inspector.start()
    inspector.stop()

    expect(heading.getAttribute('data-i18n-key')).toBe('app.owns.this')
  })

  it('survives a second stop', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const inspector = new Inspector(app.adapter)

    inspector.start()
    inspector.stop()

    expect(() => inspector.stop()).not.toThrow()
  })
})

describe('Inspector on an attribute that changes after start', () => {
  it('tags the element and cleans the value', async () => {
    const app = createApp({ en: { nav: { home: 'Home' } } }, 'en')
    const link = document.createElement('a')
    document.body.append(link)

    const inspector = new Inspector(app.adapter)
    inspector.start()
    app.render(link, 'nav.home', 'aria-label')
    await flushObserver()

    expect(inspector.keyAt(link)).toBe('nav.home')
    expect(link.getAttribute('aria-label')).toBe('Home')
    inspector.stop()
  })
})

describe('Inspector on a section that hydrates in place', () => {
  it('marks again after a scroll', async () => {
    vi.useFakeTimers()
    const app = createApp({ en: { late: { header: 'Later' } } }, 'en')
    const inspector = new Inspector(app.adapter)
    inspector.start()

    // Hydration adopts the server text, so the observer sees no mutation.
    const section = document.createElement('section')
    document.body.append(section)
    app.render(section, 'late.header')
    const applied = vi.spyOn(app.adapter, 'setCatalogue')

    window.dispatchEvent(new Event('scroll'))
    vi.advanceTimersByTime(500)

    expect(applied).toHaveBeenCalled()
    inspector.stop()
    vi.useRealTimers()
  })

  it('stops listening for scrolls when it stops', () => {
    const app = createApp({ en: { hero: { header: 'Hi' } } }, 'en')
    const inspector = new Inspector(app.adapter)
    inspector.start()
    inspector.stop()

    const applied = vi.spyOn(app.adapter, 'setCatalogue')
    window.dispatchEvent(new Event('scroll'))

    expect(applied).not.toHaveBeenCalled()
  })
})
