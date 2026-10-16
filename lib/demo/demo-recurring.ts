import type { Dispatch, SetStateAction } from 'react'
import type { LocalDate } from '@/lib/data/expenses'
import type { RecurringDefinition, RecurringDraft, RecurringMutations, RecurringTarget, SlotEntry } from '@/lib/data/recurring'
import type { DemoCardEdits } from './demo-cards'

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
  /** "Marcar como cobrado" and its undo, keyed by `slotKey`: the charge's state in that cycle. */
  charged: Record<string, boolean>
  /** The reminder setting each definition was last given from its row's sheet. */
  reminders: Record<string, RecurringDefinition['reminder']>
}

export const noDemoRecurringEdits: DemoRecurringEdits = {
  created: [],
  updated: {},
  updatedSeq: {},
  stoppedIds: [],
  deletedIds: [],
  onward: [],
  slots: {},
  charged: {},
  reminders: {},
}

export function slotKey(definitionId: string, cycle: LocalDate): string {
  return `${definitionId}@${cycle}`
}

let counter = 0
let seq = 0

/** `setCard` writes to the cards' edits, where the card sheet's checklist writes too (`demo-cards.ts`). */
export function createDemoRecurringMutations(
  setEdits: Dispatch<SetStateAction<DemoRecurringEdits>>,
  setCardEdits: Dispatch<SetStateAction<DemoCardEdits>>,
): RecurringMutations {
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
    setCharged(definitionId, cycle, charged) {
      setEdits((edits) => ({ ...edits, charged: { ...edits.charged, [slotKey(definitionId, cycle)]: charged } }))
      return Promise.resolve()
    },
    setReminder(definitionId, reminder) {
      setEdits((edits) => ({ ...edits, reminders: { ...edits.reminders, [definitionId]: reminder } }))
      return Promise.resolve()
    },
    setCard(definitionId, cardId) {
      setCardEdits((edits) => ({ ...edits, assignments: { ...edits.assignments, [definitionId]: cardId } }))
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
