import { afterEach, expect, it, vi } from 'vitest'
import { type App, createApp, h, nextTick, ref } from 'vue'
import { createI18n } from 'vue-i18n'
import { Inspector } from '../src/inspector'
import type { CatalogueAdapter, MessageGroup } from '../src/types'
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
  const show = ref(true)
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { first: 'First', second: 'Second', hint: 'Hint', alias: 'First' } },
  })
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp({
    render: () =>
      h('section', [
        h('button', { 'aria-label': plain.value ? undefined : i18n.global.t(key.value) }),
        h('p', plain.value ? 'User text' : i18n.global.t(key.value)),
        h('span', { title: i18n.global.t('hint') }, plain.value ? '' : i18n.global.t(key.value)),
        h('div', [i18n.global.t('first'), i18n.global.t('second')]),
        h('em', [i18n.global.t('first'), i18n.global.t('second'), i18n.global.t('alias')]),
        h('small', [i18n.global.t('first'), i18n.global.t('second'), 'First']),
        h('strong', [show.value ? i18n.global.t('first') : null, i18n.global.t('alias')]),
      ]),
  })
  app.use(i18n)
  app.mount(host)
  inspector = new Inspector(createVueI18nAdapter(i18n.global))
  inspector.start()
  await flush()
  return { key, plain, show, host }
}

async function mountWithSpy() {
  vi.useFakeTimers()
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: { en: { first: 'First', second: 'Second' } },
  })
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp({ render: () => h('section', []) })
  app.use(i18n)
  app.mount(host)
  const base = createVueI18nAdapter(i18n.global)
  const setCatalogue = vi.fn((locale: string, catalogue: MessageGroup) => {
    base.setCatalogue(locale, catalogue)
  })
  const adapter: CatalogueAdapter = { ...base, setCatalogue }
  inspector = new Inspector(adapter)
  inspector.start()
  await flush()
  return { host, i18n, setCatalogue }
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

it('keeps the key when the app rebuilds the text node with the same text', async () => {
  const { host } = await mount()
  const paragraph = element(host, 'p')
  await vi.advanceTimersByTimeAsync(1500)
  expect(inspector.keyAt(paragraph)).toBe('first')
  paragraph.replaceChildren(document.createTextNode(paragraph.textContent ?? ''))
  await flush()
  expect(inspector.keyAt(paragraph)).toBe('first')
})

it('ignores plain text that repeats an earlier translation', async () => {
  const { host } = await mount()
  const pair = element(host, 'div')
  expect(inspector.keyAt(pair)).toBe('second')
  pair.append(document.createTextNode('First'))
  await flush()
  expect(inspector.keyAt(pair)).toBe('second')
})

it('reads a batch of added translations without a second pass', async () => {
  const { host, i18n, setCatalogue } = await mountWithSpy()
  const section = element(host, 'section')
  await vi.advanceTimersByTimeAsync(3000)
  const passes = setCatalogue.mock.calls.length
  section.append(document.createTextNode(i18n.global.t('first')))
  section.append(document.createTextNode(i18n.global.t('second')))
  await flush()
  await vi.advanceTimersByTimeAsync(2000)
  expect(setCatalogue.mock.calls.length).toBe(passes)
})

it('keeps the last key when two translations render the same text', async () => {
  const { host } = await mount()
  const trio = element(host, 'em')
  expect(inspector.keyAt(trio)).toBe('alias')
  await vi.advanceTimersByTimeAsync(3000)
  expect(inspector.keyAt(trio)).toBe('alias')
})

it('keeps the key when a pass re-marks a literal that repeats a translation', async () => {
  const { host } = await mount()
  const mixed = element(host, 'small')
  expect(inspector.keyAt(mixed)).toBe('second')
  await vi.advanceTimersByTimeAsync(3000)
  expect(inspector.keyAt(mixed)).toBe('second')
})

it('keeps its own key when an identical translation disappears', async () => {
  const { show, host } = await mount()
  const pair = element(host, 'strong')
  expect(inspector.keyAt(pair)).toBe('alias')
  show.value = false
  await flush()
  expect(inspector.keyAt(pair)).toBe('alias')
})
