import { describe, expect, it, vi } from 'vitest'
import { listenForActivation } from '../src/activation'
import { startInspector } from '../src/start'
import type { CatalogueAdapter, MessageGroup } from '../src/types'

const press = (key = 'Alt', repeat = false): void => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, repeat }))
}

const stubAdapter = (): CatalogueAdapter => {
  const live: Record<string, MessageGroup> = { en: { hero: { header: 'Save your note' } } }
  return {
    currentLocale: () => 'en',
    loadedLocales: () => ['en'],
    getCatalogue: (locale: string) => live[locale] ?? {},
    setCatalogue: (locale: string, next: MessageGroup) => {
      live[locale] = next
    },
  }
}

describe('activation', () => {
  it('fires after three quick presses', () => {
    const toggle = vi.fn()
    const clock = { at: 0 }
    const activation = listenForActivation(
      toggle,
      { key: 'Alt', presses: 3, windowMs: 600 },
      () => clock.at
    )

    press()
    clock.at = 100
    press()
    clock.at = 200
    press()

    expect(toggle).toHaveBeenCalledTimes(1)
    activation.destroy()
  })

  it('ignores presses that are too slow', () => {
    const toggle = vi.fn()
    const clock = { at: 0 }
    const activation = listenForActivation(
      toggle,
      { key: 'Alt', presses: 3, windowMs: 600 },
      () => clock.at
    )

    press()
    clock.at = 5000
    press()
    clock.at = 5100
    press()

    expect(toggle).not.toHaveBeenCalled()
    activation.destroy()
  })

  it('does not count a held key, which repeats', () => {
    const toggle = vi.fn()
    const activation = listenForActivation(toggle, { key: 'Alt', presses: 3, windowMs: 600 })

    press('Alt')
    press('Alt', true)
    press('Alt', true)

    expect(toggle).not.toHaveBeenCalled()
    activation.destroy()
  })

  it('takes the key and the count from the caller', () => {
    const toggle = vi.fn()
    const activation = listenForActivation(toggle, { key: 'Shift', presses: 2, windowMs: 600 })

    press('Shift')
    press('Shift')

    expect(toggle).toHaveBeenCalledTimes(1)
    activation.destroy()
  })

  it('leaves the page alone until the shortcut fires', () => {
    document.body.innerHTML = '<h1>Save your note</h1>'
    const adapter = stubAdapter()
    const running = startInspector(adapter)

    expect(running.active).toBe(false)
    expect(adapter.getCatalogue('en')).toEqual({ hero: { header: 'Save your note' } })

    press()
    press()
    press()

    expect(running.active).toBe(true)
    running.stop()
  })

  it('turns the mode off on the next run of presses', () => {
    document.body.innerHTML = '<h1>Save your note</h1>'
    const running = startInspector(stubAdapter())

    press()
    press()
    press()
    expect(running.active).toBe(true)

    press()
    press()
    press()
    expect(running.active).toBe(false)

    running.stop()
  })

  it('takes the shortcut away when it stops', () => {
    document.body.innerHTML = '<h1>Save your note</h1>'
    const running = startInspector(stubAdapter())

    running.stop()
    press()
    press()
    press()

    expect(running.active).toBe(false)
  })
})
