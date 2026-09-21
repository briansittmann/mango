import type { Dispatch, SetStateAction } from 'react'
import type { RecurringDraft, RecurringMutations, RecurringTarget } from '@/lib/data/recurring'

export type DemoRecurringEdits = {
  created: { id: string; target: RecurringTarget; draft: RecurringDraft }[]
  updated: Record<string, RecurringDraft>
  stoppedIds: string[]
  deletedIds: string[]
}

export const noDemoRecurringEdits: DemoRecurringEdits = { created: [], updated: {}, stoppedIds: [], deletedIds: [] }

let counter = 0

export function createDemoRecurringMutations(setEdits: Dispatch<SetStateAction<DemoRecurringEdits>>): RecurringMutations {
  return {
    create(target, draft) {
      counter += 1
      const id = `demo-recurring-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, target, draft }] }))
      return Promise.resolve()
    },
    update(definitionId, draft) {
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [definitionId]: draft } }))
      return Promise.resolve()
    },
    stop(definitionId) {
      setEdits((edits) => ({
        ...edits,
        stoppedIds: edits.stoppedIds.includes(definitionId) ? edits.stoppedIds : [...edits.stoppedIds, definitionId],
      }))
      return Promise.resolve()
    },
    delete(definitionId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, definitionId] }))
      return Promise.resolve()
    },
  }
}
