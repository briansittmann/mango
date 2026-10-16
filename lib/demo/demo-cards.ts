import type { Dispatch, SetStateAction } from 'react'
import { DUPLICATE_CARD_NAME, type Card, type CardDraft, type CardMutations } from '@/lib/data/cards'
import type { RecurringDefinition } from '@/lib/data/recurring'

/**
 * The visitor's card changes over the seed (`card-wallet` → *The demo's cards stay in memory*,
 * design D9). `assignments` is the card each definition was last given, by the card sheet's
 * checklist or the fixed's "Tarjeta" row; a definition not in it keeps its seed card.
 */
export type DemoCardEdits = {
  created: Card[]
  updated: Record<string, CardDraft>
  deletedIds: string[]
  assignments: Record<string, string | null>
}

export const noDemoCardEdits: DemoCardEdits = { created: [], updated: {}, deletedIds: [], assignments: {} }

/** The cards as the visitor left them, in creation order. */
export function applyDemoCardEdits(seed: Card[], edits: DemoCardEdits): Card[] {
  return [...seed, ...edits.created]
    .filter((card) => !edits.deletedIds.includes(card.id))
    .map((card) => (edits.updated[card.id] ? { ...card, ...edits.updated[card.id] } : card))
}

/** Each definition with the card it carries now: its assignment, none once that card is deleted, none on income. */
export function applyDemoCardAssignments(definitions: RecurringDefinition[], cards: Card[], edits: DemoCardEdits): RecurringDefinition[] {
  const alive = new Set(cards.map((card) => card.id))
  return definitions.map((definition) => {
    const cardId = definition.id in edits.assignments ? edits.assignments[definition.id] : definition.cardId
    return { ...definition, cardId: definition.tipo === 'gasto' && cardId && alive.has(cardId) ? cardId : null }
  })
}

let counter = 0

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function createDemoCardMutations(
  cards: Card[],
  definitions: RecurringDefinition[],
  setEdits: Dispatch<SetStateAction<DemoCardEdits>>,
): CardMutations {
  const taken = (name: string, except?: string) => cards.some((card) => card.id !== except && foldName(card.name) === foldName(name))
  return {
    create(draft) {
      if (taken(draft.name)) return Promise.reject(new Error(DUPLICATE_CARD_NAME))
      counter += 1
      const id = `demo-card-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, ...draft }] }))
      return Promise.resolve(id)
    },
    update(cardId, draft) {
      if (taken(draft.name, cardId)) return Promise.reject(new Error(DUPLICATE_CARD_NAME))
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [cardId]: draft } }))
      return Promise.resolve()
    },
    delete(cardId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, cardId] }))
      return Promise.resolve()
    },
    setFixedCharges(cardId, definitionIds) {
      const assignments: Record<string, string | null> = {}
      for (const definition of definitions) {
        if (definition.cardId === cardId && !definitionIds.includes(definition.id)) assignments[definition.id] = null
      }
      for (const id of definitionIds) assignments[id] = cardId
      setEdits((edits) => ({ ...edits, assignments: { ...edits.assignments, ...assignments } }))
      return Promise.resolve()
    },
  }
}
