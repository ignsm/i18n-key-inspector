import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createOverlay, UI_ATTRIBUTE } from '../src/overlay'
import { startInspector } from '../src/start'
import type { CatalogueAdapter, MessageGroup } from '../src/types'

const catalogue: MessageGroup = { hero: { header: 'Save your note' } }

const createAdapter = (): CatalogueAdapter => {
  const live: Record<string, MessageGroup> = { en: catalogue }
  const heading = document.querySelector('h1')

  return {
    currentLocale: () => 'en',
    loadedLocales: () => ['en'],
    getCatalogue: (locale: string) => live[locale] ?? {},
    setCatalogue: (locale: string, next: MessageGroup) => {
      live[locale] = next
      const group = next.hero as MessageGroup
      if (heading !== null) heading.textContent = String(group.header)
    },
  }
}

const hold = (key: string): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key }))
}

const tooltip = (): HTMLElement => {
  const host = document.body.querySelector(`[${UI_ATTRIBUTE}]`)
  const tip = host?.shadowRoot?.querySelector('.tip')
  if (!(tip instanceof HTMLElement)) throw new Error('the overlay drew no tooltip')
  return tip
}

const pointAt = (element: Element): void => {
  const move = new MouseEvent('mousemove', { bubbles: true, clientX: 10, clientY: 40 })
  element.dispatchEvent(move)
}

describe('the overlay', () => {
  beforeEach(() => {
    document.body.innerHTML = '<h1>Save your note</h1>'
  })

  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('shows the key of the element under the pointer', () => {
    const running = startInspector(createAdapter(), { activation: null })
    const heading = document.querySelector('h1') as HTMLElement

    hold('Alt')
    pointAt(heading)

    const tip = tooltip()
    expect(tip.textContent).toBe('hero.header')
    expect(tip.style.display).toBe('block')
    // The app's own element keeps every class and style it had.
    expect(heading.className).toBe('')
    expect(heading.getAttribute('style')).toBeNull()
    running.stop()
  })

  it('formats the key the way the caller asked', () => {
    const running = startInspector(createAdapter(), {
      activation: null,
      formatKey: (key) => key.replace(/\./g, '::'),
    })

    hold('Alt')
    pointAt(document.querySelector('h1') as HTMLElement)

    expect(tooltip().textContent).toBe('hero::header')
    running.stop()
  })

  it('shows nothing until the modifier goes down', () => {
    const running = startInspector(createAdapter(), { activation: null })

    pointAt(document.querySelector('h1') as HTMLElement)

    expect(tooltip().style.display).not.toBe('block')
    running.stop()
  })

  it('draws its boxes in the shadow root, not on the page', () => {
    // happy-dom lays nothing out, so give the heading a size to draw around.
    const heading = document.querySelector('h1') as HTMLElement
    heading.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40)

    const running = startInspector(createAdapter(), { activation: null })
    hold('Alt')

    const host = document.body.querySelector(`[${UI_ATTRIBUTE}]`)
    expect(host?.shadowRoot?.querySelectorAll('.box').length).toBe(1)
    expect(document.querySelectorAll('.box').length).toBe(0)
    running.stop()
  })

  it('copies the key on a click, and tells the caller', async () => {
    const copied: string[] = []
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { clipboard: { writeText } })

    const running = startInspector(createAdapter(), {
      activation: null,
      onCopy: (key) => copied.push(key),
    })
    hold('Alt')
    document.querySelector('h1')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()

    expect(writeText).toHaveBeenCalledWith('hero.header')
    expect(copied).toEqual(['hero.header'])
    running.stop()
    vi.unstubAllGlobals()
  })

  it('keeps every style of its own inside the shadow root', () => {
    const running = startInspector(createAdapter(), { activation: null })

    expect(document.head.querySelector('style')).toBeNull()
    expect(document.body.querySelector(`[${UI_ATTRIBUTE}]`)?.shadowRoot).not.toBeNull()
    running.stop()
  })

  it('leaves nothing behind when it goes away', () => {
    const running = startInspector(createAdapter(), { activation: null })
    hold('Alt')
    running.stop()

    expect(document.body.querySelector(`[${UI_ATTRIBUTE}]`)).toBeNull()

    expect(document.querySelector('[data-i18n-key]')).toBeNull()
  })

  it('can run without the inspector, for a caller with its own lifecycle', () => {
    const running = startInspector(createAdapter(), { activation: null })
    const second = createOverlay(running.inspector)

    expect(() => second.destroy()).not.toThrow()
    running.stop()
  })

  it('turns the tooltip into Copied for a moment', async () => {
    vi.useFakeTimers()
    vi.stubGlobal('navigator', { clipboard: { writeText: () => Promise.resolve() } })
    const running = startInspector(createAdapter(), { activation: null })
    const heading = document.querySelector('h1') as HTMLElement

    hold('Alt')
    pointAt(heading)
    expect(tooltip().textContent).toBe('hero.header')

    heading.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()
    expect(tooltip().textContent).toBe('Copied')

    // The pointer keeps moving, and the tooltip holds the word for a moment.
    pointAt(heading)
    expect(tooltip().textContent).toBe('Copied')

    // The pointer then stands still. The key comes back on its own.
    vi.advanceTimersByTime(1500)
    expect(tooltip().textContent).toBe('hero.header')
    expect(tooltip().classList.contains('copied')).toBe(false)

    running.stop()
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it('says so when the clipboard refuses', async () => {
    vi.stubGlobal('navigator', {
      clipboard: { writeText: () => Promise.reject(new Error('not focused')) },
    })
    const running = startInspector(createAdapter(), { activation: null })

    hold('Alt')
    document.querySelector('h1')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
    await Promise.resolve()

    expect(tooltip().textContent).toBe('Copy failed')
    running.stop()
    vi.unstubAllGlobals()
  })

  it('says so when the browser gives no clipboard at all', () => {
    vi.stubGlobal('navigator', {})
    const running = startInspector(createAdapter(), { activation: null })

    hold('Alt')
    document.querySelector('h1')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(tooltip().textContent).toBe('Copy failed')
    running.stop()
    vi.unstubAllGlobals()
  })

  it('hides everything when the modifier goes up', () => {
    const heading = document.querySelector('h1') as HTMLElement
    heading.getBoundingClientRect = () => new DOMRect(0, 0, 200, 40)
    const running = startInspector(createAdapter(), { activation: null })

    hold('Alt')
    const host = document.body.querySelector(`[${UI_ATTRIBUTE}]`)
    expect(host?.shadowRoot?.querySelectorAll('.box').length).toBe(1)

    window.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt' }))

    expect(host?.shadowRoot?.querySelectorAll('.box').length).toBe(0)
    expect(tooltip().style.display).toBe('none')
    running.stop()
  })
})
