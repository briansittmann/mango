import type { Dispatch, SetStateAction } from 'react'
import { DUPLICATE_CATEGORY_NAME } from '@/lib/data/categories'
import type { CategoryDraft, CategoryMutations } from '@/lib/data/categories'
import type { ExpenseGroup } from '@/lib/data/dashboard'

export type DemoCategoryEdits = {
  created: { id: string; draft: CategoryDraft }[]
  updated: Record<string, CategoryDraft>
  deleted: { id: string; reassignTo: string | null }[]
  order: string[] | null
}

export const noDemoCategoryEdits: DemoCategoryEdits = { created: [], updated: {}, deleted: [], order: null }

let counter = 0

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

export function createDemoCategoryMutations(
  currentGroups: ExpenseGroup[],
  setEdits: Dispatch<SetStateAction<DemoCategoryEdits>>,
): CategoryMutations {
  return {
    create(draft) {
      const name = foldName(draft.name)
      const duplicate = currentGroups.some((group) => group.kind === 'category' && foldName(group.name) === name)
      if (duplicate) return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))

      counter += 1
      const id = `demo-category-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, draft }] }))
      return Promise.resolve(id)
    },
    update(categoryId, draft) {
      const name = foldName(draft.name)
      const duplicate = currentGroups.some(
        (group) => group.kind === 'category' && group.id !== categoryId && foldName(group.name) === name,
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
