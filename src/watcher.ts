import { isForeignText } from './dom'

/** What the watcher needs from the inspector. */
export interface WatcherPorts {
  /** Selector for the inspector's own UI. */
  readonly toolSelector: string
  /** Reads the markers of a node that the app added. */
  readonly read: (node: Node) => void
  /** Reads the markers of the attributes of one element. */
  readonly readAttributes: (element: Element) => void
  /**
   * `true` while a mutation still belongs to the last marking pass.
   * The watcher asks once for each batch, never once for each record.
   */
  readonly isOwnChurn: () => boolean
  /** Runs when the app rendered copy that holds no marker. */
  readonly onForeignContent: () => void
}

/**
 * Builds the observer that keeps the page tagged.
 *
 * @param ports - The calls that the watcher makes back into the inspector.
 * @returns An observer. The caller starts and stops it.
 * @example
 * ```ts
 * const observer = createWatcher(ports)
 * observer.observe(document.body, { childList: true, subtree: true })
 * ```
 */
export function createWatcher(ports: WatcherPorts): MutationObserver {
  return new MutationObserver((records) => {
    // Read the clock once, before the loop.
    // A pass over a large page takes time.
    // A clock read inside the loop calls our own tail foreign.
    const ownChurn = ports.isOwnChurn()
    let sawForeignContent = false

    for (const record of records) {
      if (!ownChurn && isForeignRecord(record, ports.toolSelector)) sawForeignContent = true
      readRecord(record, ports)
    }

    if (sawForeignContent) ports.onForeignContent()
  })
}

function readRecord(record: MutationRecord, ports: WatcherPorts): void {
  if (record.type === 'characterData') ports.read(record.target)
  if (record.type === 'attributes' && record.target instanceof Element) {
    ports.readAttributes(record.target)
  }
  for (const node of Array.from(record.addedNodes)) ports.read(node)
}

function isForeignRecord(record: MutationRecord, toolSelector: string): boolean {
  if (record.type !== 'childList') return false

  const target = record.target instanceof Element ? record.target : null
  return Array.from(record.addedNodes).some((node) =>
    isForeignText(node.textContent ?? '', insideTool(node, target, toolSelector))
  )
}

// Use the node when the app adds our own UI.
// Use the target in the other cases.
// A node that the app removes in the same task has no parent.
function insideTool(node: Node, target: Element | null, toolSelector: string): boolean {
  const element = node instanceof Element ? node : (node.parentElement ?? target)
  if (element === null) return false
  return element.closest(toolSelector) !== null
}
