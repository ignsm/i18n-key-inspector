import { afterEach, expect, it, vi } from 'vitest'
import { type App, createApp, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { Inspector } from '../src/inspector'
import { createVueI18nAdapter } from '../src/vue-i18n'

let inspector: Inspector
let app: App

afterEach(() => {
  inspector?.stop()
  app?.unmount()
  document.body.replaceChildren()
  vi.useRealTimers()
})

async function flush(): Promise<void> {
  await nextTick()
  await vi.advanceTimersByTimeAsync(0)
}

function element(host: Element, selector: string): Element {
  const found = host.querySelector(selector)
  if (found === null) throw new Error(`Missing ${selector}`)
  return found
}

async function mount() {
  vi.useFakeTimers()
  const key = ref('first')
  const plain = ref(false)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { first: 'First', second: 'Second', hint: 'Hint' } },
  })
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    render: () =>
      h('section', [
        h('button', { 'aria-label': plain.value ? undefined : i18n.global.t(key.value) }),
        h('p', plain.value ? 'User text' : i18n.global.t(key.value)),
        h('span', { title: i18n.global.t('hint') }, plain.value ? '' : i18n.global.t(key.value)),
      ]),
  })
  app.use(i18n)
  app.mount(host)
  inspector = new Inspector(createVueI18nAdapter(i18n.global))
  inspector.start()
  await flush()
  return { key, plain, host }
}

it('updates the key when Vue changes a translated attribute', async () => {
  const { key, host } = await mount()
  const button = element(host, 'button')
  expect(inspector.keyAt(button)).toBe('first')
  key.value = 'second'
  await flush()
  expect(button.getAttribute('aria-label')).toBe('Second')
  expect(inspector.keyAt(button)).toBe('second')
})

it('removes the key when Vue replaces a translation with plain text', async () => {
  const { plain, host } = await mount()
  const paragraph = element(host, 'p')
  expect(inspector.keyAt(paragraph)).toBe('first')
  plain.value = true
  await flush()
  expect(paragraph.textContent).toBe('User text')
  expect(inspector.keyAt(paragraph)).toBeNull()
})

it('removes the key when Vue removes a translated attribute', async () => {
  const { plain, host } = await mount()
  const button = element(host, 'button')
  plain.value = true
  await flush()
  expect(inspector.keyAt(button)).toBeNull()
})

it('keeps the attribute key when Vue removes the translated text', async () => {
  const { plain, host } = await mount()
  const span = element(host, 'span')
  expect(inspector.keyAt(span)).toBe('first')
  plain.value = true
  await flush()
  expect(inspector.keyAt(span)).toBe('hint')
})

it('removes the key when a text node changes in place', async () => {
  const { host } = await mount()
  const paragraph = element(host, 'p')
  const text = paragraph.firstChild
  if (text === null) throw new Error('Missing text')
  text.textContent = 'User text'
  await flush()
  expect(inspector.keyAt(paragraph)).toBeNull()
})

it('restores an app-owned key when its translation disappears', async () => {
  const { host } = await mount()
  const paragraph = element(host, 'p')
  inspector.stop()
  paragraph.setAttribute('data-i18n-key', 'app-owned')
  inspector.start()
  await flush()
  expect(inspector.keyAt(paragraph)).toBe('first')
  paragraph.textContent = 'User text'
  await flush()
  expect(inspector.keyAt(paragraph)).toBe('app-owned')
  inspector.stop()
  expect(inspector.keyAt(paragraph)).toBe('app-owned')
})

it('keeps keys after a scheduled pass and removes them on stop', async () => {
  const { host } = await mount()
  const paragraph = element(host, 'p')
  await vi.advanceTimersByTimeAsync(1500)
  await flush()
  expect(inspector.keyAt(paragraph)).toBe('first')
  expect(paragraph.textContent).toBe('First')
  inspector.stop()
  await flush()
  expect(inspector.keyAt(paragraph)).toBeNull()
  expect(paragraph.textContent).toBe('First')
})
