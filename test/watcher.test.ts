import { afterEach, expect, it, vi } from 'vitest'
import { createWatcher, type WatcherPorts } from '../src/watcher'

afterEach(() => {
  document.body.replaceChildren()
})

function spyPorts() {
  return {
    toolSelector: '[data-i18n-inspector-ui]',
    read: vi.fn(),
    readElement: vi.fn(),
    isOwnChurn: () => false,
    onForeignContent: vi.fn(),
  } satisfies WatcherPorts
}

function watch(ports: WatcherPorts): { observer: MutationObserver; host: HTMLElement } {
  const observer = createWatcher(ports)
  const host = document.createElement('div')
  document.body.append(host)
  observer.observe(host, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
  })
  return { observer, host }
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

it('leaves the target alone when the app only adds nodes', async () => {
  const ports = spyPorts()
  const { observer, host } = watch(ports)
  host.append(document.createElement('span'))
  host.append(document.createElement('span'))
  await settle()
  observer.disconnect()
  expect(ports.read).toHaveBeenCalledTimes(2)
  expect(ports.readElement).not.toHaveBeenCalled()
})

it('reads the target again when the app removes a node', async () => {
  const ports = spyPorts()
  const { observer, host } = watch(ports)
  const child = document.createElement('span')
  host.append(child)
  await settle()
  child.remove()
  await settle()
  observer.disconnect()
  expect(ports.readElement).toHaveBeenCalledWith(host)
})

it('reads the target again when the app changes an attribute', async () => {
  const ports = spyPorts()
  const { observer, host } = watch(ports)
  host.setAttribute('title', 'Hint')
  await settle()
  observer.disconnect()
  expect(ports.readElement).toHaveBeenCalledWith(host)
})

it('reads an element once when a batch changes many of its text nodes', async () => {
  const ports = spyPorts()
  const { observer, host } = watch(ports)
  const nodes = ['one', 'two', 'three'].map((text) => document.createTextNode(text))
  host.append(...nodes)
  await settle()
  ports.readElement.mockClear()
  for (const node of nodes) node.data = `${node.data}!`
  await settle()
  observer.disconnect()
  expect(ports.readElement.mock.calls).toEqual([[host]])
})

it('reads a parent once when a batch adds many text nodes', async () => {
  const ports = spyPorts()
  const { observer, host } = watch(ports)
  host.append(document.createTextNode('one'))
  host.append(document.createTextNode('two'))
  host.append(document.createTextNode('three'))
  await settle()
  observer.disconnect()
  expect(ports.readElement.mock.calls).toEqual([[host]])
  expect(ports.read).not.toHaveBeenCalled()
})
