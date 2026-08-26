/**
 * A message as an i18n library keeps it.
 * It is literal text, a compiled AST, a list, or a nested group.
 * A catalogue comes from JSON, so a leaf can also be a number or a flag.
 */
export type MessageNode =
  | string
  | number
  | boolean
  | null
  | MessageList
  | CompiledMessage
  | MessageGroup

/** A branch of the catalogue. One path segment finds each child. */
export interface MessageGroup {
  readonly [segment: string]: MessageNode
}

/** A catalogue list. An index finds each item. */
export type MessageList = readonly MessageNode[]

/**
 * A message that vue-i18n compiled already.
 * A production build minifies the names, so the shape holds both spellings.
 */
export interface CompiledMessage {
  readonly type?: number
  readonly t?: number
  readonly body?: MessageBody
  readonly b?: MessageBody
}

/** The payload of a compiled message: literal text, tokens, or plural cases. */
export interface MessageBody {
  readonly static?: string
  readonly s?: string
  readonly items?: readonly MessageToken[]
  readonly i?: readonly MessageToken[]
  readonly cases?: readonly MessageBody[]
  readonly c?: readonly MessageBody[]
}

/** One token of a compiled message: literal text, an interpolation, a link. */
export interface MessageToken {
  readonly type?: number
  readonly t?: number
  readonly value?: string
  readonly v?: string
}

/**
 * What the inspector needs from an i18n library.
 * One adapter for each library keeps the package free of framework code.
 *
 * The adapter must meet three rules.
 * `setCatalogue` replaces the catalogue, it does not merge into it.
 * `setCatalogue` makes the framework render again, without a further call.
 * `getCatalogue` returns a value that the inspector can hold and read later.
 */
export interface CatalogueAdapter {
  /** The locale that the app renders now. */
  currentLocale(): string
  /** Every locale whose catalogue is already loaded. */
  loadedLocales(): readonly string[]
  /** The catalogue for a locale. Return an empty group for an unknown one. */
  getCatalogue(locale: string): MessageGroup
  /** Installs a catalogue. It must make the framework render again. */
  setCatalogue(locale: string, catalogue: MessageGroup): void
}

/**
 * Tells a group apart from the other node kinds.
 *
 * @param node - Any catalogue node.
 * @returns `true` when the node is a group of messages.
 */
export function isMessageGroup(node: MessageNode): node is MessageGroup {
  return typeof node === 'object' && node !== null && !Array.isArray(node)
}
