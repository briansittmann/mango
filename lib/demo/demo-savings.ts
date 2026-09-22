import type { Dispatch, SetStateAction } from 'react'
import type { SavingsMovementDraft, SavingsMutations } from '@/lib/data/savings'

export type DemoSavingsEdits = {
  created: { id: string; draft: SavingsMovementDraft }[]
}

export const noDemoSavingsEdits: DemoSavingsEdits = { created: [] }

let counter = 0

export function createDemoSavingsMutations(setEdits: Dispatch<SetStateAction<DemoSavingsEdits>>): SavingsMutations {
  return {
    addSavingsMovement(draft) {
      counter += 1
      const id = `demo-savings-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft }] }))
      return Promise.resolve()
    },
  }
}
