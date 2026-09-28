import type { Dispatch, SetStateAction } from 'react'
import type { LocalDate } from '@/lib/data/expenses'
import type { RecurringDraft, RecurringMutations, RecurringTarget, SlotEntry } from '@/lib/data/recurring'

/**
 * One cycle's slot of a definition (`add-forward-scoped-edits` D1): an override of what that cycle
 * shows (`entry`, `null` = what the projection says), or deleted. `seq` orders it against the
 * definition changes: a later change reaching past it rewrites it, as 0024 rewrites pending slots.
 */
export type DemoSlot = { entry: SlotEntry | null; deleted: boolean; seq: number }

export type DemoRecurringEdits = {
  created: { id: string; target: RecurringTarget; draft: RecurringDraft }[]
  updated: Record<string, RecurringDraft>
  /** When each definition-sheet update was saved, on the same clock as `onward` and `slots`. */
  updatedSeq: Record<string, number>
  stoppedIds: string[]
  deletedIds: string[]
  /** Changes "from this month on" made from a row, in order: from `cycle` on the definition takes `entry`, or stops (`null`). */
  onward: { seq: number; definitionId: string; cycle: LocalDate; entry: SlotEntry | null }[]
  /** Keyed by `slotKey`. */
  slots: Record<string, DemoSlot>
}

export const noDemoRecurringEdits: DemoRecurringEdits = {
  created: [],
  updated: {},
  updatedSeq: {},
  stoppedIds: [],
  deletedIds: [],
  onward: [],
  slots: {},
}

export function slotKey(definitionId: string, cycle: LocalDate): string {
  return `${definitionId}@${cycle}`
}

let counter = 0
let seq = 0

export function createDemoRecurringMutations(setEdits: Dispatch<SetStateAction<DemoRecurringEdits>>): RecurringMutations {
  return {
    create(target, draft) {
      counter += 1
      const id = `demo-recurring-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, target, draft }] }))
      return Promise.resolve()
    },
    update(definitionId, draft) {
      seq += 1
      const at = seq
      setEdits((edits) => ({
        ...edits,
        updated: { ...edits.updated, [definitionId]: draft },
        updatedSeq: { ...edits.updatedSeq, [definitionId]: at },
      }))
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
    editInCycle(definitionId, cycle, entry, scope) {
      seq += 1
      const at = seq
      setEdits((edits) => ({
        ...edits,
        onward: scope === 'onward' ? [...edits.onward, { seq: at, definitionId, cycle, entry }] : edits.onward,
        slots: { ...edits.slots, [slotKey(definitionId, cycle)]: { entry, deleted: false, seq: at } },
      }))
      return Promise.resolve()
    },
    deleteInCycle(definitionId, cycle, scope) {
      seq += 1
      const at = seq
      setEdits((edits) => {
        const key = slotKey(definitionId, cycle)
        return {
          ...edits,
          onward: scope === 'onward' ? [...edits.onward, { seq: at, definitionId, cycle, entry: null }] : edits.onward,
          slots: { ...edits.slots, [key]: { entry: edits.slots[key]?.entry ?? null, deleted: true, seq: at } },
        }
      })
      return Promise.resolve()
    },
    restoreInCycle(definitionId, cycle) {
      setEdits((edits) => {
        const key = slotKey(definitionId, cycle)
        const slot = edits.slots[key]
        if (!slot?.deleted) return edits
        return { ...edits, slots: { ...edits.slots, [key]: { ...slot, deleted: false } } }
      })
      return Promise.resolve()
    },
  }
}
