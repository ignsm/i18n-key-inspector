# Contributing

Thank you for looking at this package.

## Development

Use pnpm and Node 22.18 or a newer Node 22 release for development.
The published package supports Node 20.19 as well.

```sh
pnpm install
pnpm verify
```

`pnpm verify` runs the formatter, the comment checker, the type checker, the
tests, and the build. CI also tests the supported vue-i18n majors, checks
the package exports and types, and imports the tarball on Node 20.

Single steps: `pnpm test`, `pnpm typecheck`, `pnpm check`, `pnpm comments`.

## Writing style

Comments and documentation follow `docs/comment-style.md`. The short
version: one sentence on one line, active voice, 80 characters, and a comment
tells the reader why. `pnpm comments` fails the build when a line breaks the
rules.

## A bug fix needs a test

Add the test that fails without your fix. The suite runs in Vitest, and
anything that touches the DOM uses happy-dom.

## Release

A maintainer tags `vX.Y.Z`. The release workflow runs `pnpm verify` and
publishes to npm with provenance.
