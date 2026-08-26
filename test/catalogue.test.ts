import { describe, expect, it } from 'vitest'
import { type CatalogueOptions, markCatalogue } from '../src/catalogue'
import { KeyTable } from '../src/key-table'
import { encodeMarker, stripMarkers } from '../src/markers'
import type { CompiledMessage, MessageBody, MessageGroup } from '../src/types'

const options = (overrides: Partial<CatalogueOptions> = {}): CatalogueOptions => ({
  skipGroups: [],
  skipNestedGroups: [],
  pluralSeparator: '|',
  listSeparators: [],
  ...overrides,
})

const markWith = (
  catalogue: MessageGroup,
  overrides: Partial<CatalogueOptions> = {}
): { marked: MessageGroup; table: KeyTable } => {
  const table = new KeyTable(1)
  return { marked: markCatalogue(catalogue, table, options(overrides)), table }
}

const text = (node: unknown): string => String(node)

describe('markCatalogue', () => {
  it('gives two identical strings two different keys', () => {
    const { marked, table } = markWith({
      menu: { note: 'Save your note' },
      hero: { header: 'Save your note' },
    })

    const fromMenu = text((marked.menu as MessageGroup).note)
    const fromHero = text((marked.hero as MessageGroup).header)

    expect(table.keyFor(fromMenu)).toBe('menu.note')
    expect(table.keyFor(fromHero)).toBe('hero.header')
    expect(stripMarkers(fromHero)).toBe('Save your note')
  })

  it('leaves the original catalogue untouched', () => {
    const original: MessageGroup = { hero: { header: 'Hi' } }
    markWith(original)

    expect((original.hero as MessageGroup).header).toBe('Hi')
  })

  it('walks a list and names each item by index', () => {
    const { marked, table } = markWith({ note: { features: ['Fast', 'Free'] } })
    const features = (marked.note as MessageGroup).features as readonly string[]

    expect(features.map((item) => table.keyFor(item))).toEqual([
      'note.features.0',
      'note.features.1',
    ])
  })

  it('skips the groups whose strings only reach the head', () => {
    const { marked, table } = markWith(
      { seo: { title: 'About' }, about: { meta: { title: 'About' }, header: 'About' } },
      { skipGroups: ['seo'], skipNestedGroups: ['meta'] }
    )

    expect((marked.seo as MessageGroup).title).toBe('About')
    expect(((marked.about as MessageGroup).meta as MessageGroup).title).toBe('About')
    expect(table.size).toBe(1)
  })

  it('leaves an empty string empty and claims no key for it', () => {
    const { marked, table } = markWith({ body: { note: '' } })

    expect((marked.body as MessageGroup).note).toBe('')
    expect(table.size).toBe(0)
  })

  it('keeps the index right after a message it had to skip', () => {
    const { marked, table } = markWith({
      row: { before: 'Before', data: '{"icon":"check"}', after: 'After' },
    })

    expect(table.size).toBe(2)
    expect(table.keyFor(text((marked.row as MessageGroup).after))).toBe('row.after')
  })
})

describe('markCatalogue on copy the app splits itself', () => {
  it('marks both branches of a plural', () => {
    const { marked, table } = markWith({ cart: { count: 'one note | {n} notes' } })
    const branches = text((marked.cart as MessageGroup).count).split('|')

    expect(branches.map((branch) => table.keyFor(branch))).toEqual(['cart.count', 'cart.count'])
    expect(branches.map((branch) => stripMarkers(branch))).toEqual(['one note ', ' {n} notes'])
  })

  it('treats an escaped pipe as one branch', () => {
    const { marked } = markWith({ page: { title: "Notes {'|'} app" } })

    expect(stripMarkers(text((marked.page as MessageGroup).title))).toBe("Notes {'|'} app")
  })

  it('marks every item of a list held in one string', () => {
    const { marked, table } = markWith(
      { faq: { questions: 'One?,, Two?,, Three?' } },
      { listSeparators: [',,'] }
    )
    const items = text((marked.faq as MessageGroup).questions).split(',,')

    expect(items.map((item) => table.keyFor(item))).toEqual([
      'faq.questions',
      'faq.questions',
      'faq.questions',
    ])
    expect(items.map((item) => stripMarkers(item).trim())).toEqual(['One?', 'Two?', 'Three?'])
  })

  it('ignores a separator the app was not configured to split on', () => {
    const { marked } = markWith({ faq: { questions: 'One?,, Two?' } })

    expect(stripMarkers(text((marked.faq as MessageGroup).questions))).toBe('One?,, Two?')
  })
})

describe('markCatalogue on a message the app parses as JSON', () => {
  it('marks inside the array, so JSON.parse still works', () => {
    const { marked, table } = markWith({ note: { features: '["Offline first","Instant search"]' } })
    const items = JSON.parse(text((marked.note as MessageGroup).features)) as string[]

    expect(items.map((item) => stripMarkers(item))).toEqual(['Offline first', 'Instant search'])
    expect(items.map((item) => table.keyFor(item))).toEqual(['note.features', 'note.features'])
  })

  it('keeps a list holding a pipe parseable', () => {
    const { marked } = markWith({ note: { features: '["draft | note"]' } })
    const items = JSON.parse(text((marked.note as MessageGroup).features)) as string[]

    expect(items.map((item) => stripMarkers(item))).toEqual(['draft | note'])
  })

  it('leaves a record alone, since its values can be identifiers', () => {
    const record = '{"icon":"check","text":"Offline first"}'
    const { marked, table } = markWith({ row: { data: record } })

    expect((marked.row as MessageGroup).data).toBe(record)
    expect(table.size).toBe(0)
  })
})

describe('markCatalogue on compiled messages', () => {
  const compiled = (body: MessageBody): CompiledMessage => ({ type: 0, body })

  it('reads the full property names', () => {
    const { marked, table } = markWith({
      hero: { header: compiled({ static: 'Hi' }) },
    })
    const node = (marked.hero as MessageGroup).header as CompiledMessage

    expect(table.keyFor(text(node.body?.static))).toBe('hero.header')
    expect(stripMarkers(text(node.body?.static))).toBe('Hi')
  })

  it('reads the minified property names a production build emits', () => {
    const { marked, table } = markWith({
      hero: { header: { t: 0, b: { s: 'Hi' } } },
    })
    const node = (marked.hero as MessageGroup).header as CompiledMessage

    expect(table.keyFor(text(node.b?.s))).toBe('hero.header')
  })

  it('marks the first token when the text sits in tokens', () => {
    const { marked, table } = markWith({
      cta: { heading: { t: 0, b: { i: [{ t: 3, v: 'Go' }, { t: 5 }] } } },
    })
    const tokens = ((marked.cta as MessageGroup).heading as CompiledMessage).b?.i ?? []

    expect(table.keyFor(text(tokens[0]?.v))).toBe('cta.heading')
    expect(tokens).toHaveLength(2)
  })

  it('marks every plural case, tokens as well as text', () => {
    const { marked, table } = markWith({
      cart: {
        count: { t: 0, b: { c: [{ s: 'one note' }, { i: [{ v: 'many ' }, { t: 5 }] }] } },
      },
    })
    const cases = ((marked.cart as MessageGroup).count as CompiledMessage).b?.c ?? []

    expect(table.keyFor(text(cases[0]?.s))).toBe('cart.count')
    expect(table.keyFor(text(cases[1]?.i?.[0]?.v))).toBe('cart.count')
  })

  it('leaves a message opening with an interpolation alone', () => {
    const message = { t: 0, b: { i: [{ t: 5 }, { t: 3, v: ' notes' }] } }
    const { marked, table } = markWith({ cart: { count: message } })

    expect((marked.cart as MessageGroup).count).toBe(message)
    expect(table.size).toBe(0)
  })

  it('does not mistake a group holding a key called b for a compiled message', () => {
    const { marked, table } = markWith({ nav: { b: 'Back' } })

    expect(table.keyFor(text((marked.nav as MessageGroup).b))).toBe('nav.b')
  })
})

describe('one key table across locales', () => {
  it('gives a fallback string the key it actually has', () => {
    const table = new KeyTable(1)
    const english = markCatalogue({ note: { badge: 'Draft', title: 'Note' } }, table, options())
    markCatalogue({ note: { title: 'Nota' } }, table, options())

    expect(table.keyFor(text((english.note as MessageGroup).badge))).toBe('note.badge')
  })
})

describe('generation', () => {
  it('changes every marker, so the framework re-renders', () => {
    const catalogue = (): MessageGroup => ({
      plain: { text: 'Hi' },
      data: { features: '["One"]' },
      plural: { count: { t: 0, b: { c: [{ s: 'one' }, { s: 'many' }] } } },
    })

    const first = markCatalogue(catalogue(), new KeyTable(1), options())
    const second = markCatalogue(catalogue(), new KeyTable(2), options())

    expect(JSON.stringify(first)).not.toBe(JSON.stringify(second))
  })
})

describe('KeyTable', () => {
  it('refuses to release a key that was not claimed last', () => {
    const table = new KeyTable(0)
    table.claim('first')
    table.claim('second')

    expect(() => table.release('first')).toThrow(RangeError)
  })
})

describe('markCatalogue on a group that looks compiled', () => {
  it('walks a group whose key is called type', () => {
    const { marked, table } = markWith({
      section: { type: 'page', body: { static: 'Hi' } },
    })
    const group = marked.section as MessageGroup

    expect(table.keyFor(text(group.type))).toBe('section.type')
    expect(stripMarkers(text((group.body as MessageGroup).static))).toBe('Hi')
  })

  it('leaves a malformed AST alone', () => {
    const broken = { t: 0, b: { s: 42 } }
    const { marked } = markWith({ cta: { label: broken } })

    expect(((marked.cta as MessageGroup).label as MessageGroup).b).toEqual({ s: 42 })
  })
})

describe('markCatalogue on a JSON list of empty strings', () => {
  it('keeps an empty item empty', () => {
    const { marked, table } = markWith({ note: { features: '["","Instant"]' } })
    const items = JSON.parse(text((marked.note as MessageGroup).features)) as string[]

    expect(items[0]).toBe('')
    expect(table.keyFor(text(items[1]))).toBe('note.features')
  })

  it('claims no key for a list that can hold no marker', () => {
    const { marked, table } = markWith({ note: { features: '["",""]' } })

    expect((marked.note as MessageGroup).features).toBe('["",""]')
    expect(table.size).toBe(0)
  })
})

describe('markCatalogue without a plural separator', () => {
  it('keeps a pipe as text', () => {
    const { marked, table } = markWith(
      { page: { title: 'Save your note | Notes app' } },
      { pluralSeparator: null }
    )
    const title = text((marked.page as MessageGroup).title)

    expect(stripMarkers(title)).toBe('Save your note | Notes app')
    expect(title.split('|')).toHaveLength(2)
    expect(table.size).toBe(1)
  })
})

describe('KeyTable across rounds', () => {
  it('refuses a marker from an older round', () => {
    const first = new KeyTable(1)
    const oldMarker = first.claim('old.key')

    const second = new KeyTable(2)
    second.claim('new.key')

    expect(second.keyFor(oldMarker)).toBeNull()
  })

  it('reads a marker from its own round', () => {
    const table = new KeyTable(2)
    const marker = table.claim('hero.header')

    expect(table.keyFor(marker)).toBe('hero.header')
  })
})

describe('encodeMarker', () => {
  it('refuses a value that cannot survive a round trip', () => {
    expect(() => encodeMarker(-1)).toThrow(RangeError)
    expect(() => encodeMarker(1.5)).toThrow(RangeError)
    expect(() => encodeMarker(Number.MAX_SAFE_INTEGER + 2)).toThrow(RangeError)
  })
})
