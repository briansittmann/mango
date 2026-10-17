import type { Dispatch, SetStateAction } from 'react'
import type { DashboardData } from '@/lib/data/dashboard'
import type { CountedRow, Transfer, TransferDraft, TransferMutations } from '@/lib/data/payment-method'
import type { RecurringDefinition } from '@/lib/data/recurring'

// The demo's transfers and the cash it held before September (`dashboard-ui` → *The demo's payment
// methods*, design D11). In memory, like every other demo edit: a reload resets them.

export type DemoTransferEdits = {
  created: { id: string; draft: TransferDraft }[]
  updated: Record<string, TransferDraft>
  deletedIds: string[] // the demo's borrado_en: rows stay, flagged
}

export const noDemoTransferEdits: DemoTransferEdits = { created: [], updated: {}, deletedIds: [] }

/** A withdrawal of 100 € on 4 September: the sample's one transfer. */
export const DEMO_TRANSFER_SEED: { id: string; draft: TransferDraft }[] = [
  { id: 'demo-transfer-1', draft: { amount: 100, into: 'efectivo', date: '2026-09-04' } },
]

/** Cash tips of 28 August, a cycle the demo never shows: they only feed the cash balance. */
export const DEMO_POCKET_OPENING: CountedRow[] = [{ kind: 'income', amount: 150, date: '2026-08-28T12:00:00Z', paymentMethod: 'efectivo' }]

/** Every transfer not deleted, seed and created, with its last edit; any month. */
export function resolveDemoTransfers(seed: { id: string; draft: TransferDraft }[], edits: DemoTransferEdits): Transfer[] {
  return [...seed, ...edits.created]
    .filter(({ id }) => !edits.deletedIds.includes(id))
    .map(({ id, draft }) => {
      const { amount, into, date } = edits.updated[id] ?? draft
      return { id, amount, into, date: `${date}T12:00:00Z` }
    })
}

/**
 * The sample with no payment method anywhere (`?e2e=no-payment-methods`): the state of an account
 * that never marked a movement, for the "no pockets until the first mark" scenarios.
 */
export function withoutPaymentMethods(data: DashboardData, definitions: RecurringDefinition[]) {
  return {
    data: {
      ...data,
      expenses: {
        ...data.expenses,
        groups: data.expenses.groups.map((group) => ({
          ...group,
          expenses: group.expenses.map((expense) => ({ ...expense, paymentMethod: null })),
        })),
      },
      income: { ...data.income, entries: data.income.entries.map((entry) => ({ ...entry, paymentMethod: null })) },
    },
    definitions: definitions.map((definition) => ({ ...definition, paymentMethod: null })),
  }
}

let counter = 0

export function createDemoTransferMutations(setEdits: Dispatch<SetStateAction<DemoTransferEdits>>): TransferMutations {
  return {
    create(draft) {
      counter += 1
      const id = `demo-transfer-new-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft }] }))
      return Promise.resolve()
    },
    update(transferId, draft) {
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [transferId]: draft } }))
      return Promise.resolve()
    },
    softDelete(transferId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, transferId] }))
      return Promise.resolve()
    },
    restore(transferId) {
      setEdits((edits) => ({ ...edits, deletedIds: edits.deletedIds.filter((id) => id !== transferId) }))
      return Promise.resolve()
    },
  }
}
