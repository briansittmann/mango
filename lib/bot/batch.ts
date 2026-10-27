/**
 * A message with several movements (`add-bot-batch-loads` D2, D3): which items a batch writes, with
 * which message id, and where it stops. The database steps are injected, so `batch.test.mjs` runs
 * it from plain Node. Relative imports only.
 */

import { normalizeName } from '../data/supabase/bot.ts'
import type { LeftOutLoads, SkippedLoad } from './format.ts'

/** At most this many rows per message; the rest are named as left out. */
export const MAX_BATCH_ROWS = 10

/** The fields of a `cargar` item the decisions read. */
export type BatchItem = {
  tipo: 'gasto' | 'ingreso' | 'ahorro' | 'transferencia'
  monto: number
  categoria: string | null
  descripcion: string | null
  recurrente: string | null
}

export type ItemResult<R> = { written: R } | { skipped: SkippedLoad }

export type BatchSteps<I, R> = {
  /** A skip decided before the daily limit is spent, or null to try the item. */
  precheck: (item: I) => SkippedLoad | null
  /** Spends one load of the daily limit; false when the limit refuses it. */
  quota: () => Promise<boolean>
  /** Writes the item with `externalId` as its row's message id. */
  write: (item: I, externalId: string) => Promise<ItemResult<R>>
}

export type BatchOutcome<R> = { rows: R[]; skipped: SkippedLoad[]; leftOut: LeftOutLoads | null }

/**
 * The message id the n-th written row of a message records (D2): the plain id for the first, so a
 * retry is still discarded by it, and `<id>#n` after. A WhatsApp id never contains `#`.
 */
export function rowExternalId(messageId: string, n: number): string {
  return n === 1 ? messageId : `${messageId}#${n}`
}

/**
 * Where a single load would ask or refuse, a batch skips (D3): a transfer for an account without
 * payment methods, an expense whose category is not found and with no Otros to fall back to. A
 * fixed charge already charged is only known on the write.
 */
export function precheckItem(
  item: BatchItem,
  account: { paymentMethods: boolean; categories: { id: string; nombre: string }[]; recurring: { nombre: string; categoria_id: string }[] },
): SkippedLoad | null {
  const skip = (reason: SkippedLoad['reason']): SkippedLoad => ({ name: item.descripcion, amount: Math.abs(item.monto), reason })
  if (item.tipo === 'transferencia') return account.paymentMethods ? null : skip('transferencia')
  if (item.tipo !== 'gasto') return null

  const byName = <T extends { nombre: string }>(rows: T[], name: string) => rows.find((row) => normalizeName(row.nombre) === normalizeName(name))
  const definition = item.recurrente ? byName(account.recurring, item.recurrente) : undefined
  const category = definition
    ? account.categories.find((c) => c.id === definition.categoria_id)
    : ((item.categoria ? byName(account.categories, item.categoria) : undefined) ?? byName(account.categories, 'Otros'))
  return category ? null : skip('sinCategoria')
}

/**
 * Walks the items in order (D3): a precheck skip spends nothing; otherwise one load of the daily
 * limit, then the write. Stops at the 10th row, at the first refused quota and at a failed write,
 * keeping what was written. A failure before any row is written goes up as for a single load.
 */
export async function runBatch<I, R>(items: I[], messageId: string, steps: BatchSteps<I, R>): Promise<BatchOutcome<R>> {
  const rows: R[] = []
  const skipped: SkippedLoad[] = []

  for (const [index, item] of items.entries()) {
    const left = items.length - index
    if (rows.length === MAX_BATCH_ROWS) return { rows, skipped, leftOut: { count: left, reason: 'limite' } }

    const skip = steps.precheck(item)
    if (skip) {
      skipped.push(skip)
      continue
    }

    try {
      if (!(await steps.quota())) return { rows, skipped, leftOut: { count: left, reason: 'tope' } }
      const result = await steps.write(item, rowExternalId(messageId, rows.length + 1))
      if ('skipped' in result) skipped.push(result.skipped)
      else rows.push(result.written)
    } catch (error) {
      if (rows.length === 0) throw error
      console.error('[bot] batch stopped after a failed write:', error)
      return { rows, skipped, leftOut: { count: left, reason: 'error' } }
    }
  }

  return { rows, skipped, leftOut: null }
}

/**
 * The message ids the rows of one load can carry (D2), from the id of any of them: the plain id and
 * `#2`…`#10`. An `in` list, never a `like`.
 */
export function loadExternalIds(externalId: string): string[] {
  const base = externalId.replace(/#\d+$/, '')
  return Array.from({ length: MAX_BATCH_ROWS }, (_, i) => rowExternalId(base, i + 1))
}

/** The fields of a load's row the matching reads. */
export type NamedRow = { descripcion: string | null; categoria: { nombre: string } | null }

/**
 * The one row of a load a message names (D5): by description, else by category, case and accents
 * aside. Null when none or more than one row matches, so the bot asks instead of guessing.
 */
export function matchRow<R extends NamedRow>(rows: R[], cual: string): R | null {
  const key = normalizeName(cual)
  const only = (found: R[]) => (found.length === 1 ? found[0] : null)
  const byDescription = rows.filter((row) => row.descripcion !== null && normalizeName(row.descripcion) === key)
  if (byDescription.length > 0) return only(byDescription)
  return only(rows.filter((row) => row.categoria !== null && normalizeName(row.categoria.nombre) === key))
}

/**
 * What `borrar` deletes (D5): a single row whatever the name; on several, every row without a name,
 * else the one it names. Null when the name matches no single row: the bot asks which one.
 */
export function rowsToDelete<R extends NamedRow>(rows: R[], cual: string | null | undefined): R[] | null {
  if (rows.length === 1 || !cual) return rows
  const row = matchRow(rows, cual)
  return row ? [row] : null
}

/** What `corregir` changes (D5): a single row whatever the name; on several, only the one it names, else null. */
export function rowToCorrect<R extends NamedRow>(rows: R[], cual: string | null | undefined): R | null {
  if (rows.length === 1) return rows[0]
  return cual ? matchRow(rows, cual) : null
}
