import { type CatalogueOptions, DEFAULT_CATALOGUE_OPTIONS } from './catalogue'

/** How the inspector tags the page and how often it re-marks it. */
export interface InspectorOptions extends CatalogueOptions {
  /** Attribute that holds the key. */
  readonly keyAttribute: string
  /**
   * Selector for our own UI.
   * Content inside it must not count as new copy.
   * A tooltip would otherwise start a new pass on every hover.
   */
  readonly toolSelector: string
  /** Milliseconds to wait after new content, before the next pass. */
  readonly reapplyDelayMs: number
  /**
   * Milliseconds after a pass.
   * Inside this window the inspector counts a mutation as its own work.
   */
  readonly selfInflictedMs: number
  /**
   * Milliseconds after start to re-mark once, for content that hydrates late.
   */
  readonly hydrationDelayMs: number
}

/** Everything an `InspectorOptions` field can be left out of. */
export type InspectorInit = Partial<InspectorOptions>

/** The options that apply when a caller gives none. */
export const DEFAULT_INSPECTOR_OPTIONS: InspectorOptions = {
  ...DEFAULT_CATALOGUE_OPTIONS,
  keyAttribute: 'data-i18n-key',
  toolSelector: '[data-i18n-inspector-ui]',
  reapplyDelayMs: 400,
  selfInflictedMs: 600,
  hydrationDelayMs: 1500,
}
