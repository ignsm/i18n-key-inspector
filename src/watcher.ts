import { isForeignText } from './dom'

/** What the watcher needs from the inspector. */
export interface WatcherPorts {
  /** Selector for the inspector's own UI. */
  readonly toolSelector: string
  /** Reads the markers of a node that the app added. */
  readonly read: (node: Node) => void
  /** Refreshes the sources on an element after a mutation. */
  readonly readElement: (element: Element) => void
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

    // Our own read strips the markers off the rest of the batch.
    // Classify every record first, so a sibling never looks foreign.
    for (const record of records) {
      if (!ownChurn && isForeignRecord(record, ports.toolSelector)) sawForeignContent = true
    }
    readBatch(records, ports)

    if (sawForeignContent) ports.onForeignContent()
  })
}

// A read of one element covers every text node under it.
// One pass over a long list produces one record for each sibling.
// Collect the elements first, so the batch reads each of them once.
function readBatch(records: readonly MutationRecord[], ports: WatcherPorts): void {
  const elements = new Set<Element>()
  const roots: Node[] = []

  for (const record of records) {
    if (readsTarget(record) && record.target instanceof Element) elements.add(record.target)
    if (record.type === 'characterData') collect(record.target, elements, roots)
    for (const node of Array.from(record.addedNodes)) collect(node, elements, roots)
  }

  for (const root of roots) ports.read(root)
  for (const element of elements) ports.readElement(element)
}

// A subtree needs its own walk. A text node only needs its parent.
function collect(node: Node, elements: Set<Element>, roots: Node[]): void {
  if (node instanceof Element) roots.push(node)
  else if (node.parentElement !== null) elements.add(node.parentElement)
}

// The inspector reads an added node, and that read covers its parent.
// Only a removal or an attribute change needs the target itself.
function readsTarget(record: MutationRecord): boolean {
  if (record.type === 'attributes') return true
  return record.type === 'childList' && record.removedNodes.length > 0
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
