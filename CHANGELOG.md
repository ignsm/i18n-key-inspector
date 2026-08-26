# Changelog

## 0.2.1

- A section that hydrates on scroll now gets its keys. Hydration adopts the
  server text in place, so the observer sees no mutation to react to.

## 0.2.0

- The vue-i18n adapter now supports vue-i18n 9 and 10, next to 11. CI tests
  each major.
- Minimum Node is 20.19, down from 22.

## 0.1.1

- A plural whose branch opens with an interpolation now carries its key.
  `one note | {n} notes` reported nothing before.

## 0.1.0

First release.

- `startInspector` registers the shortcut. Three presses of Alt turn the mode on.
- `Inspector` marks every loaded catalogue and reads the keys back from the DOM.
- `createOverlay` draws the boxes and the tooltip in a shadow root. It writes
  no style onto an element of the app.
- A click copies the key. The tooltip says `Copied` for a moment.
- `createVueI18nAdapter` connects a vue-i18n Composer.
- Options for skipped groups, list separators, and the plural separator.
