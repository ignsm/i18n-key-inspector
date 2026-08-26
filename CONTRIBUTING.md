# Contributing

Thank you for looking at this package.

## Development

The repository uses pnpm and Node 20 or later.

```sh
pnpm install
pnpm verify
```

`pnpm verify` runs the formatter, the comment checker, the type checker, the
tests, and the build. CI runs the same command, so a green `verify` means a
green pull request.

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
