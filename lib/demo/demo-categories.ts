import type { Dispatch, SetStateAction } from 'react'
import { DUPLICATE_CATEGORY_NAME } from '@/lib/data/categories'
import type { CategoryDraft, CategoryMutations } from '@/lib/data/categories'
import type { ExpenseGroup } from '@/lib/data/dashboard'

export type DemoCategoryEdits = {
  updated: Record<string, CategoryDraft>
  deleted: { id: string; reassignTo: string | null }[]
  order: string[] | null
}

export const noDemoCategoryEdits: DemoCategoryEdits = { updated: {}, deleted: [], order: null }

export function createDemoCategoryMutations(
  currentGroups: ExpenseGroup[],
  setEdits: Dispatch<SetStateAction<DemoCategoryEdits>>,
): CategoryMutations {
  return {
    update(categoryId, draft) {
      const name = draft.name.trim()
      const duplicate = currentGroups.some(
        (group) => group.kind === 'category' && group.id !== categoryId && group.name === name,
      )
      if (duplicate) return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))

      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [categoryId]: draft } }))
      return Promise.resolve()
    },
    delete(categoryId, reassignTo) {
      setEdits((edits) => ({ ...edits, deleted: [...edits.deleted, { id: categoryId, reassignTo }] }))
      return Promise.resolve()
    },
    reorder(categoryIds) {
      setEdits((edits) => ({ ...edits, order: [...categoryIds] }))
      return Promise.resolve()
    },
  }
}
