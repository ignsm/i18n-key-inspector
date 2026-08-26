import { markCompiledText, type TextOptions } from './text'
import type { CompiledMessage, MessageBody, MessageNode, MessageToken } from './types'

/**
 * Tells a compiled message apart from a group with a key called `type`.
 * The node must hold a numeric AST discriminator and a body of a known shape.
 *
 * @param node - Any catalogue node.
 * @returns `true` when the node is a compiled message.
 * @example
 * ```ts
 * isCompiledMessage({ type: 0, body: { static: 'Hi' } }) // true
 * isCompiledMessage({ type: 'page', body: { static: 'Hi' } }) // false
 * ```
 */
export function isCompiledMessage(node: MessageNode): node is CompiledMessage {
  if (typeof node !== 'object' || node === null || Array.isArray(node)) return false

  const candidate = node as CompiledMessage
  const kind = candidate.type ?? candidate.t
  if (typeof kind !== 'number') return false

  return isBody(bodyOf(candidate))
}

/**
 * Puts a marker in front of the first literal text of a compiled message.
 *
 * @param message - The compiled message to copy.
 * @param marker - Marker to put in front of the text.
 * @param options - Separators that this app splits a message on.
 * @returns A marked copy, or `null` to leave the message alone.
 */
export function markCompiledMessage(
  message: CompiledMessage,
  marker: string,
  options: TextOptions
): CompiledMessage | null {
  const body = markBody(bodyOf(message), marker, options)
  if (body === null) return null

  return 'body' in message ? { ...message, body } : { ...message, b: body }
}

function bodyOf(message: CompiledMessage): MessageBody | undefined {
  return message.body ?? message.b
}

function isBody(body: MessageBody | undefined): boolean {
  if (body === undefined || typeof body !== 'object') return false

  const text = body.static ?? body.s
  const tokens = body.items ?? body.i
  const cases = body.cases ?? body.c

  if (typeof text === 'string') return true
  return Array.isArray(tokens) || Array.isArray(cases)
}

function markBody(
  body: MessageBody | undefined,
  marker: string,
  options: TextOptions
): MessageBody | null {
  if (body === undefined) return null

  const text = body.static ?? body.s
  if (typeof text === 'string') {
    const marked = markCompiledText(text, marker, options)
    if (marked === null) return null
    return 'static' in body ? { ...body, static: marked } : { ...body, s: marked }
  }

  const tokens = body.items ?? body.i
  if (tokens !== undefined) {
    const marked = markTokens(tokens, marker, options)
    if (marked === null) return null
    return 'items' in body ? { ...body, items: marked } : { ...body, i: marked }
  }

  return markCases(body, marker, options)
}

// A plural holds one body for each branch.
// The runtime renders one branch, so each branch needs its own marker.
function markCases(body: MessageBody, marker: string, options: TextOptions): MessageBody | null {
  const cases = body.cases ?? body.c
  if (cases === undefined) return null

  const marked: MessageBody[] = []
  for (const branch of cases) {
    const markedBranch = markBody(branch, marker, options)
    if (markedBranch === null) return null
    marked.push(markedBranch)
  }

  return 'cases' in body ? { ...body, cases: marked } : { ...body, c: marked }
}

// The marker goes on the first token that holds text, not on the first token.
// A message can open with an interpolation, as `{n} notes` does.
function markTokens(
  tokens: readonly MessageToken[],
  marker: string,
  options: TextOptions
): readonly MessageToken[] | null {
  const at = tokens.findIndex((token) => typeof (token.value ?? token.v) === 'string')
  if (at === -1) return null

  const token = tokens[at] as MessageToken
  const text = (token.value ?? token.v) as string
  const marked = markCompiledText(text, marker, options)
  if (marked === null) return null

  const head = 'value' in token ? { ...token, value: marked } : { ...token, v: marked }
  return tokens.map((each, index) => (index === at ? head : each))
}
