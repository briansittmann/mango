import type { Dispatch, SetStateAction } from 'react'
import type { SavingsMovementDraft, SavingsMutations } from '@/lib/data/savings'

export type DemoSavingsEdits = {
  created: { id: string; draft: SavingsMovementDraft }[]
  deletedIds: string[] // the demo's borrado_en: rows stay, flagged
}

export const noDemoSavingsEdits: DemoSavingsEdits = { created: [], deletedIds: [] }

let counter = 0

export function createDemoSavingsMutations(setEdits: Dispatch<SetStateAction<DemoSavingsEdits>>): SavingsMutations {
  return {
    addSavingsMovement(draft) {
      counter += 1
      const id = `demo-savings-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft }] }))
      return Promise.resolve()
    },
    softDelete(movementId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, movementId] }))
      return Promise.resolve()
    },
    restore(movementId) {
      setEdits((edits) => ({ ...edits, deletedIds: edits.deletedIds.filter((id) => id !== movementId) }))
      return Promise.resolve()
    },
  }
}
