#!/usr/bin/env node
// The machine half of docs/comment-style.md.
// It checks the length, the filler, the passive voice, and the breaks.
import { readFileSync } from 'node:fs'

const LINE_LIMIT = 80
const SENTENCE_LIMIT = 20
const COMMENT = /^\s*(\/\/|\/\*|\*)/
const SOURCE = /\.(ts|tsx|js|mjs|vue)$/
const FENCE = /```/
const ENDS_SENTENCE = /[.!?:;]$|[.!?]\)$/
const CONTINUES = /^[a-z(]/
const CODE = /[(){}=;]|=>|\bconst\b|\bimport\b/

const FILLER = [
  /\bis responsible for\b/i,
  /\bin order to\b/i,
  /\bnote that\b/i,
  /\bwe simply\b/i,
  /\bit('s| is) worth noting\b/i,
  /\bleverage[sd]?\b/i,
  /\bseamless(ly)?\b/i,
  /\brobust\b/i,
  /\bhandle edge cases\b/i,
  /—/,
]

// Finds a form of "to be" with a past participle. Name the actor.
const PASSIVE = /\b(is|are|was|were|be|been|being)\s+(\w+ed|written|read|shown|kept|held)\b/i

/**
 * Reads the text of one comment line, without the comment marker.
 *
 * @param {string} line - One source line.
 * @returns {string} The text that a reader sees.
 */
function commentText(line) {
  return line.replace(/^\s*(\/\/+|\/\*+|\*+\/?)/, '').trim()
}

/**
 * Counts the words of the longest sentence on a line.
 *
 * @param {string} text - Text of one comment line.
 * @returns {number} Word count of the longest sentence.
 */
function longestSentence(text) {
  const sentences = text.split(/[.!?]\s|[.!?]$/)
  const counts = sentences.map((part) => part.trim().split(/\s+/).filter(Boolean).length)
  return Math.max(0, ...counts)
}

/**
 * Reports a sentence that runs from one line onto the next one.
 *
 * @param {string} text - Text of this comment line.
 * @param {string | undefined} next - Text of the comment line below.
 * @returns {boolean} `true` when the sentence continues on the next line.
 */
function breaksAcrossLines(text, next) {
  if (next === undefined || text === '' || next === '') return false
  if (ENDS_SENTENCE.test(text) || CODE.test(text) || CODE.test(next)) return false
  if (text.startsWith('|') || text.startsWith('-') || text.startsWith('@')) return false
  return CONTINUES.test(next)
}

/**
 * Checks one comment line against every rule.
 *
 * @param {string} line - The source line.
 * @param {string} text - Comment text of the line.
 * @param {string | undefined} next - Text of the comment line below.
 * @returns {string[]} One message for each rule that the line breaks.
 */
function checkLine(line, text, next) {
  const problems = []

  if (line.length > LINE_LIMIT) {
    problems.push(`has ${line.length} characters. The limit is ${LINE_LIMIT}.`)
  }

  const filler = FILLER.find((pattern) => pattern.test(text))
  if (filler !== undefined) problems.push(`has filler that matches ${filler}.`)

  if (PASSIVE.test(text)) problems.push('uses the passive voice. Name the actor.')

  const words = longestSentence(text)
  if (words > SENTENCE_LIMIT) {
    problems.push(`has a sentence of ${words} words. The limit is ${SENTENCE_LIMIT}.`)
  }

  if (breaksAcrossLines(text, next)) {
    problems.push('runs one sentence over two lines. Make it shorter.')
  }

  return problems
}

/**
 * Collects each comment line that fails the standard.
 *
 * @param {string} file - Path of the file to read.
 * @returns {string[]} One message for each line that fails.
 */
function inspect(file) {
  if (!SOURCE.test(file)) return []

  let lines
  try {
    lines = readFileSync(file, 'utf8').split('\n')
  } catch {
    return []
  }

  const found = []
  let inFence = false

  lines.forEach((line, index) => {
    if (!COMMENT.test(line)) return

    const text = commentText(line)
    if (FENCE.test(text)) {
      inFence = !inFence
      return
    }
    if (inFence) return

    const below = lines[index + 1] ?? ''
    const next = COMMENT.test(below) ? commentText(below) : undefined

    for (const problem of checkLine(line, text, next)) {
      found.push(`${file}:${index + 1} ${problem}`)
    }
  })

  return found
}

const offences = process.argv.slice(2).flatMap(inspect)

if (offences.length > 0) {
  console.error(`These comments fail the standard:\n${offences.join('\n')}`)
  console.error('\nRead docs/comment-style.md. Then write them again.')
  process.exit(1)
}
