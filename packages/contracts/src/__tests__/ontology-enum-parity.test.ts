import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

import { ENUMS } from '../enums'

/**
 * Guards against exactly what CLAUDE.md section 8 forbids: "an ontology written in markdown
 * that the code never reads is decoration". This test READS the section 3.5 table of
 * docs/ontology.md at run time and compares it with the objects in enums.ts. Change one
 * side and forget the other and it goes red.
 *
 * Known limitation, stated plainly: the ontology only declares display labels for 8 of the
 * 12 rows. For the other four (next_step_source·created_by, trigger_context, entry_type,
 * fetch_status) the "Hiển thị" cell is a note, not a label list — so only the CODES are
 * guarded there. Those labels are ours and have no source to check against.
 *
 * Second known limitation, and it cost a real bug: this test compares section 3.5 against
 * enums.ts, but it does NOT check that every enum-typed COLUMN named in sections 3.1–3.4 has
 * a row in 3.5. `proposals.status` was listed in 3.2 with no 3.5 row and no enum in code for
 * a full day without anything going red.
 */

interface OntologyEnumRow {
  /** One "Enum" cell may hold several names, e.g. `next_step_source` · `created_by`. */
  names: string[]
  codes: string[]
  /** null when the "Hiển thị" cell is not a label list (its item count differs from codes). */
  labels: string[] | null
}

const ONTOLOGY_PATH = resolve(__dirname, '../../../../docs/ontology.md')

function backtickedValues(cell: string): string[] {
  return [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1])
}

function splitOnMiddleDot(cell: string): string[] {
  return cell
    .split('·')
    .map((part) => part.replace(/\*\*/g, '').replace(/`/g, '').trim())
    .filter((part) => part.length > 0)
}

/** Slice the table under section 3.5 and parse its rows. No markdown library — 20 lines is enough. */
export function readEnumTableFromOntology(content: string): OntologyEnumRow[] {
  const lines = content.split(/\r?\n/)
  const sectionIndex = lines.findIndex((line) => line.startsWith('### 3.5.'))
  if (sectionIndex === -1) throw new Error('Section 3.5 not found in ontology.md')

  const rows: OntologyEnumRow[] = []
  let insideTable = false
  for (const line of lines.slice(sectionIndex + 1)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) {
      if (insideTable) break // table ended
      continue // table not reached yet
    }
    insideTable = true

    const cells = trimmed.split('|').slice(1, -1).map((cell) => cell.trim())
    if (cells.length < 3) continue
    if (/^-+$/.test(cells[0].replace(/\s/g, ''))) continue // separator row
    if (cells[0] === 'Enum') continue // header row

    const names = backtickedValues(cells[0])
    const codes = backtickedValues(cells[1])
    if (names.length === 0 || codes.length === 0) continue

    const labelCandidates = splitOnMiddleDot(cells[2])
    rows.push({
      names,
      codes,
      labels: labelCandidates.length === codes.length ? labelCandidates : null,
    })
  }
  return rows
}

const table = readEnumTableFromOntology(readFileSync(ONTOLOGY_PATH, 'utf8'))

describe('enums.ts matches the section 3.5 table of ontology.md', () => {
  it('reads exactly 12 enum rows from the ontology', () => {
    expect(table).toHaveLength(12)
  })

  it.each(table.flatMap((row) => row.names.map((name) => ({ name, row }))))(
    'enum $name has the ontology codes, in the ontology order',
    ({ name, row }) => {
      const target = ENUMS[name as keyof typeof ENUMS]
      expect(target, `enums.ts is missing enum "${name}"`).toBeDefined()
      expect(Object.keys(target)).toEqual(row.codes)
    },
  )

  it.each(
    table
      .filter((row) => row.labels !== null)
      .flatMap((row) => row.names.map((name) => ({ name, labels: row.labels as string[] }))),
  )('enum $name has the Vietnamese labels declared by the ontology', ({ name, labels }) => {
    expect(Object.values(ENUMS[name as keyof typeof ENUMS])).toEqual(labels)
  })

  it('has no enum in code that the ontology never declared (catches drift the other way)', () => {
    const declared = new Set(table.flatMap((row) => row.names))
    const extra = Object.keys(ENUMS).filter((name) => !declared.has(name))
    expect(extra).toEqual([])
  })

  it('does not name the "Soạn đề xuất" stage `proposal` — the naming trap in ontology 3.5', () => {
    expect(Object.keys(ENUMS.stage)).toContain('drafting')
    expect(Object.keys(ENUMS.stage)).not.toContain('proposal')
  })
})
