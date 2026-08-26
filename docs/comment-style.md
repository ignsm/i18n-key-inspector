# Comment style

Every comment has one audience. It is the person who must decide if they can
change the line below it.

Write in simplified technical English. The rules below follow ASD-STE100.

## Sentence rules

1. Write one idea in one sentence. Use 20 words or less.
2. Use the active voice. Write "the observer reads the marker". Do not write
   "the marker is read by the observer".
3. Use the present tense.
4. Start an instruction with the verb. Write "Read the file". Do not write
   "The file should be read".
5. Keep the articles. Write "the catalogue", not "catalogue".
6. Do not use a verb as a noun. Write "the inspector marks the page". Do not
   write "the marking of the page".
7. Do not put a second idea in brackets. Write a second sentence.
8. Do not use an em dash to join two clauses. Use a full stop.
9. Keep one sentence on one line. A sentence that runs onto the next line
   is hard to read, so make it shorter instead.

## Comment rules

1. A comment tells the reader why. The code tells the reader what.
2. A comment line has 80 characters or less. The hook stops the edit if it
   is longer. A sentence therefore has about 12 words.
3. One comment covers one case, or one TODO. Do not summarize the file.
4. TSDoc is documentation. Give `@param`, `@returns`, and an `@example` for
   each export. The same sentence rules apply.

## One word, one meaning

Use these words for these things. Do not use a synonym.

| Word | Meaning |
| --- | --- |
| catalogue | All messages for one locale |
| message | One entry in a catalogue |
| key | The path that finds a message |
| marker | The invisible prefix that holds a key |
| mark | To put a marker in front of text |
| tag | To write the key attribute on an element |
| locale | One language the app loads |
| piece | One part of a message that the app renders alone |

Do not use "annotate", "label", "inject", "decorate", or "handle" for these
actions.

## Words to cut

The hook fails on these. They add no information.

| Cut | Write |
| --- | --- |
| is responsible for | the verb itself |
| in order to | to |
| note that | the fact, or nothing |
| we simply | nothing |
| leverage | use |
| seamless, robust | the property you mean |
| handle edge cases | the case, and what the code does |

## Examples from this codebase

The comment repeats the code:

```ts
// Loop through the cases and mark each one
for (const branch of cases) { ... }
```

The comment gives the reason:

```ts
// A plural holds one body for each branch. The runtime renders one branch.
// Each branch needs its own marker.
```

The comment is long and vague:

```ts
// We use the target here instead of the node because of some edge cases with
// nodes that might have been detached from the document at this point
```

The comment is short and exact:

```ts
// Use the node when the app adds our own UI. Use the target in the other
// cases. A node that the app removes in the same task has no parent.
```

## Before you stop

Read each comment again. Cut it to half the length. If the short sentence is
still true, keep the short sentence.

The same rules apply to the README, to an error message, and to a commit
subject.
