import type { Dispatch, SetStateAction } from 'react'
import type { IncomeDraft, IncomeMutations } from '@/lib/data/income'

export type DemoIncomeEdits = {
  created: { id: string; draft: IncomeDraft }[]
  updated: Record<string, IncomeDraft>
  deletedIds: string[]
}

export const noDemoIncomeEdits: DemoIncomeEdits = { created: [], updated: {}, deletedIds: [] }

let counter = 0

export function createDemoIncomeMutations(setEdits: Dispatch<SetStateAction<DemoIncomeEdits>>): IncomeMutations {
  return {
    create(draft) {
      counter += 1
      const id = `demo-income-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft }] }))
      return Promise.resolve()
    },
    update(entryId, draft) {
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [entryId]: draft } }))
      return Promise.resolve()
    },
    softDelete(entryId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, entryId] }))
      return Promise.resolve()
    },
    restore(entryId) {
      setEdits((edits) => ({ ...edits, deletedIds: edits.deletedIds.filter((id) => id !== entryId) }))
      return Promise.resolve()
    },
  }
}
