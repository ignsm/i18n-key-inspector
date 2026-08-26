# Changelog

## 0.1.0

First release.

- `startInspector` registers the shortcut. Three presses of Alt turn the mode on.
- `Inspector` marks every loaded catalogue and reads the keys back from the DOM.
- `createOverlay` draws the boxes and the tooltip in a shadow root. It writes
  no style onto an element of the app.
- A click copies the key. The tooltip says `Copied` for a moment.
- `createVueI18nAdapter` connects a vue-i18n Composer.
- Options for skipped groups, list separators, and the plural separator.
