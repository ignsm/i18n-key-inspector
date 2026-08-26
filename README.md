# i18n-key-inspector

Point at any text on the page. See the translation key that made it.

A tool that guesses the key from the rendered text has two problems. It cannot
tell two equal strings apart. It also never sees copy that renders later. This
library takes the other route. It writes an invisible prefix in front of every
message, then reads that prefix back from the DOM. The key travels inside the
string. It survives `v-html`, attributes, and a section that hydrates ten
seconds after the first paint.

Use this library in development only. Do not ship it to production.

## Install

```sh
npm install --save-dev i18n-key-inspector
```

## Use it with vue-i18n

```ts
import { startInspector } from 'i18n-key-inspector'
import { createVueI18nAdapter } from 'i18n-key-inspector/vue-i18n'

startInspector(createVueI18nAdapter(i18n.global))
```

Press <kbd>Alt</kbd> three times to turn the mode on. <kbd>Option</kbd> on a
Mac. Then hold the same key: every translated string lights up, and the one
under the pointer shows its key. Holding it and clicking copies the key: the
tooltip says `Copied` for a moment, then goes back to the key. Three presses
again turns the mode off.

Until you press it, the page is untouched. No catalogue is rewritten, and
nothing is marked.

The shortcut is yours to change:

```ts
startInspector(adapter, {
  activation: { key: 'Shift', presses: 2, windowMs: 500 },
})

startInspector(adapter, { activation: null }) // start at once, no shortcut
```

`startInspector` returns `{ inspector, active, toggle, stop }`, so you can
drive it from your own devtools panel, and `inspector.keyAt(element)` gives
you the key for your own UI.

## Use it in Nuxt

Put it in a client plugin, and keep it out of production.

```ts
// plugins/i18n-inspector.client.ts
export default defineNuxtPlugin(async (nuxtApp) => {
  if (!import.meta.dev) return

  const { startInspector } = await import('i18n-key-inspector')
  const { createVueI18nAdapter } = await import('i18n-key-inspector/vue-i18n')

  startInspector(createVueI18nAdapter(nuxtApp.$i18n), {
    skipGroups: ['seo'],
    formatKey: (key) => key.replace(/\./g, '::'),
  })
})
```

The dynamic import keeps the package out of the production bundle. The
`formatKey` above prints a double-colon key, ready to paste into a search.

## Bring your own UI

`startInspector` is the inspector plus a small overlay. Skip the overlay when
you want your own.

```ts
import { Inspector } from 'i18n-key-inspector'

const inspector = new Inspector(createVueI18nAdapter(i18n.global))
inspector.start()

document.addEventListener('mouseover', (event) => {
  const target = event.target
  if (target instanceof Element) console.log(inspector.keyAt(target))
})
```

## Options

```ts
new Inspector(adapter, {
  keyAttribute: 'data-i18n-key',
  toolSelector: '[data-i18n-inspector-ui]',
  skipGroups: ['seo'],
  skipNestedGroups: ['meta'],
  listSeparators: [',,'],
})
```

| Option | Default | Purpose |
| --- | --- | --- |
| `activation` | `{ key: 'Alt', presses: 3, windowMs: 600 }` | Shortcut that turns the mode on. `null` starts at once |
| `modifier` | `'Alt'` | Key to hold to see the keys |
| `formatKey` | identity | Turns a key into the text the tooltip shows |
| `onCopy` | `null` | Runs after a copy, for your own toast |
| `keyAttribute` | `data-i18n-key` | Attribute that holds the key |
| `toolSelector` | `[data-i18n-inspector-ui]` | Your own overlay. The inspector then ignores it |
| `skipGroups` | `[]` | Top-level groups to leave alone |
| `skipNestedGroups` | `[]` | Group names one level in to leave alone |
| `pluralSeparator` | `'\|'` | Separator that the i18n library reads as a plural |
| `listSeparators` | `[]` | Separators that your app splits a message on |
| `reapplyDelayMs` | `400` | Delay before the next pass, after new content |
| `selfInflictedMs` | `600` | Window in which a mutation counts as our own |
| `hydrationDelayMs` | `1500` | One extra pass after start, for late hydration |

### Which strings to skip

Skip copy that reaches only `<title>` and `<meta>`. Nobody can point at it. A
marker in a title also travels to the analytics pageview. Use `skipGroups` for
a top-level `seo` group. Use `skipNestedGroups` for a `meta` group that sits
beside the strings of each page.

### Copy that your app splits

A plural needs no configuration. The `|` in `one note | {n} notes` belongs to
vue-i18n, and both branches get a marker.

A list that your own code splits does need configuration. Your FAQ questions
can sit in one message that a `,,` joins. Pass `listSeparators: [',,']`. Every
item then carries the key, not only the first one.

A real array in the catalogue needs nothing. The walk names each item by its
index, `features.0` and `features.1`. This is more exact than any separator.

### Messages that your app parses as JSON

A message can hold a JSON array of strings. Each item gets a marker inside the
array, so `JSON.parse` still works and each item carries the key.

A message can also hold a JSON record. The inspector leaves it alone. The
values of a record can be icon names and other identifiers.

## Requirements

The package ships ESM only. Node 20.19 or later, and a bundler that reads the
`exports` map. There is no `require` build, and none is planned.

The vue-i18n adapter works with vue-i18n 9, 10, and 11. CI runs the adapter
tests against each of them.

The overlay draws in a shadow root and never writes a style onto an element of
your app. That matters more than it sounds: restyling a native control makes
Safari drop its own appearance and resize it, which moves the page. The boxes
you see are drawn on top instead.

Building your own UI instead? Mark it with `data-i18n-inspector-ui`, or set
`toolSelector`, so the inspector does not read it as new copy from your app.

## Limits

- A message that opens with an interpolation gets no marker. There is no
  literal text at the front to hold it.
- A component can call `t()` once, outside a reactive scope. It keeps the text
  that it read at build time. Those strings stay untagged until the framework
  builds the component again.
- Edit a locale file while the inspector runs, and the new text appears for a
  moment. The next pass restores the snapshot from `start()`. Stop the
  inspector and start it again to pick the edit up.

## Write an adapter

Any i18n library works. You need three things. Read a catalogue, write it back,
and make the framework render again.

```ts
import type { CatalogueAdapter } from 'i18n-key-inspector'

const adapter: CatalogueAdapter = {
  currentLocale: () => 'en',
  loadedLocales: () => ['en', 'es'],
  getCatalogue: (locale) => catalogues[locale],
  setCatalogue: (locale, catalogue) => install(locale, catalogue),
}
```

One key table covers every loaded locale. The app renders a missing string from
the fallback catalogue. The inspector still reports the key that the string
came from, not a neighbour key.

`setCatalogue` must replace the catalogue and make the framework render again.
This is one call in vue-i18n. Other libraries need more work. i18next, for
example, does not re-render a React tree from `addResourceBundle` alone.

## Development

```sh
pnpm install
pnpm play      # a demo page on http://localhost:5173
pnpm verify    # format, comments, types, tests, build
```

`pnpm verify` runs the formatter, the comment checker, the type checker, the
tests, and the build. See `CONTRIBUTING.md`.

## License

MIT
