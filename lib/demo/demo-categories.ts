import type { Dispatch, SetStateAction } from 'react'
import { DUPLICATE_CATEGORY_NAME } from '@/lib/data/categories'
import type { CategoryDeleteTarget, CategoryDraft, CategoryMutations, CategoryUpdateTarget } from '@/lib/data/categories'
import type { ExpenseGroup } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'

export type DemoCategoryEdits = {
  /** `cycle`: the first cycle the category lives in (`categorias.desde_ciclo`); `only`: it ends there too. */
  created: { id: string; draft: CategoryDraft; cycle: LocalDate; only: boolean }[]
  /** Name and colour: the last saved draft wins. */
  updated: Record<string, CategoryDraft>
  /** Every budget save in order, with the cycle it was made from: each one builds on the last. */
  budgets: ({ categoryId: string; amount: number | null } & CategoryUpdateTarget)[]
  deleted: ({ id: string; reassignTo: string | null } & CategoryDeleteTarget)[]
  order: string[] | null
}

export const noDemoCategoryEdits: DemoCategoryEdits = { created: [], updated: {}, budgets: [], deleted: [], order: null }

let counter = 0

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function createDemoCategoryMutations(
  currentGroups: ExpenseGroup[],
  setEdits: Dispatch<SetStateAction<DemoCategoryEdits>>,
): CategoryMutations {
  return {
    create(draft, cycle, scope) {
      const name = foldName(draft.name)
      const duplicate = currentGroups.some((group) => group.kind === 'category' && foldName(group.name) === name)
      if (duplicate) return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))

      counter += 1
      const id = `demo-category-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft, cycle, only: scope === 'only' }] }))
      return Promise.resolve(id)
    },
    update(categoryId, draft, target) {
      const name = foldName(draft.name)
      const duplicate = currentGroups.some(
        (group) => group.kind === 'category' && group.id !== categoryId && foldName(group.name) === name,
      )
      if (duplicate) return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))

      setEdits((edits) => ({
        ...edits,
        updated: { ...edits.updated, [categoryId]: draft },
        budgets: [...edits.budgets, { categoryId, amount: draft.budget, ...target }],
      }))
      return Promise.resolve()
    },
    delete(categoryId, reassignTo, target) {
      setEdits((edits) => ({ ...edits, deleted: [...edits.deleted, { id: categoryId, reassignTo, ...target }] }))
      return Promise.resolve()
    },
    reorder(categoryIds) {
      setEdits((edits) => ({ ...edits, order: [...categoryIds] }))
      return Promise.resolve()
    },
  }
}
