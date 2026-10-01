import { useId, useState, type FormEvent } from 'react'
import { Toast } from '@base-ui/react/toast'
import { useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { CATEGORY_COLORS, ColorSwatchPicker } from '@/components/molecules/color-swatch-picker'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import { cn } from '@/lib/utils'
import type { DUPLICATE_CATEGORY_NAME as DuplicateCategoryNameMessage } from '@/lib/data/categories'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'
import type { OnboardingActions, OnboardingData } from '@/lib/data/onboarding'
import type { RecurringDefinition } from '@/lib/data/recurring'

/** Mirrors `DUPLICATE_CATEGORY_NAME` (`lib/data/categories.ts`) without a runtime import across the data-layer boundary. */
const DUPLICATE_CATEGORY_NAME: typeof DuplicateCategoryNameMessage = 'duplicate-category-name'

/** How long a taken chip fades before it leaves the row (D14). */
const CHIP_FADE_MS = 150

type CategoriesStepProps = {
  categories: OnboardingData['categories']
  definitions: RecurringDefinition[]
  budgets: OnboardingData['budgets']
  cycleStart: LocalDate
  actions: OnboardingActions['categories']
  onStatus: (message: string) => void
}

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

/**
 * Step 3 (`onboarding` → *Categories step*, D8): suggestion chips, a composer and the list, with
 * inline rename, the colour picker under a row and swipe to delete with undo. Every write is the
 * dashboard's own category operation: alive from the cycle in progress, the first free colour.
 */
export function CategoriesStep({ categories, definitions, budgets, cycleStart, actions, onStatus }: CategoriesStepProps) {
  const t = useTranslations('onboarding')
  const tCategory = useTranslations('hojaCategoria')
  const toasts = Toast.useToastManager()
  const listId = useId()
  const [composer, setComposer] = useState('')
  const [composerError, setComposerError] = useState<'duplicate' | null>(null)
  const [busy, setBusy] = useState(false)
  // Chips tapped and not yet gone: fading for 150 ms, then removed once the category exists.
  const [taken, setTaken] = useState<Record<string, 'leaving' | 'gone'>>({})
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [pickerId, setPickerId] = useState<string | null>(null)

  const suggestions = (t.raw('sugerencias') as string[]).filter((name) => {
    const state = taken[name]
    if (state === 'gone') return false
    const exists = categories.some((category) => foldName(category.name) === foldName(name))
    return !exists || state === 'leaving'
  })

  function nextColor(): CategoryColor {
    return CATEGORY_COLORS.find((color) => !categories.some((category) => category.color === color)) ?? CATEGORY_COLORS[categories.length % CATEGORY_COLORS.length]
  }

  async function create(name: string): Promise<boolean> {
    try {
      await actions.create({ name, color: nextColor(), budget: null }, cycleStart, 'onward')
      onStatus(t('categorias.creada'))
      return true
    } catch (error) {
      if (error instanceof Error && error.message === DUPLICATE_CATEGORY_NAME) setComposerError('duplicate')
      else toasts.add({ title: tCategory('errorGuardar'), priority: 'high' })
      return false
    }
  }

  async function takeSuggestion(name: string) {
    setTaken((prev) => ({ ...prev, [name]: 'leaving' }))
    const fade = new Promise<void>((resolve) => setTimeout(resolve, CHIP_FADE_MS))
    const created = await create(name)
    await fade
    setTaken((prev) => {
      const next = { ...prev }
      if (created) next[name] = 'gone'
      else delete next[name]
      return next
    })
  }

  async function submitComposer(event: FormEvent) {
    event.preventDefault()
    const name = composer.trim()
    if (!name || busy) return
    setBusy(true)
    setComposerError(null)
    const created = await create(name)
    if (created) setComposer('')
    setBusy(false)
  }

  async function rename(category: OnboardingData['categories'][number], name: string) {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed || trimmed === category.name) return
    try {
      await actions.update(category.id, { name: trimmed, color: category.color, budget: budgets[category.id] ?? null }, { cycle: cycleStart, scope: null })
      onStatus(tCategory('cambiosGuardados'))
    } catch (error) {
      const duplicate = error instanceof Error && error.message === DUPLICATE_CATEGORY_NAME
      toasts.add({ title: tCategory(duplicate ? 'nombreDuplicado' : 'errorGuardar'), priority: 'high' })
    }
  }

  async function recolour(category: OnboardingData['categories'][number], color: CategoryColor) {
    setPickerId(null)
    if (color === category.color) return
    try {
      await actions.update(category.id, { name: category.name, color, budget: budgets[category.id] ?? null }, { cycle: cycleStart, scope: null })
    } catch {
      toasts.add({ title: tCategory('errorGuardar'), priority: 'high' })
    }
  }

  async function remove(category: OnboardingData['categories'][number]) {
    // A category holding a definition keeps it: the person removes the fixed expense first (D8).
    if (definitions.some((definition) => definition.categoryId === category.id)) {
      toasts.add({ title: t('categorias.tieneFijos'), priority: 'high' })
      throw new Error('category-not-empty')
    }
    try {
      await actions.delete(category.id, null, { cycle: cycleStart, scope: 'onward' })
    } catch (error) {
      toasts.add({ title: tCategory('errorEliminar'), priority: 'high' })
      throw error
    }
    toasts.close()
    const id = toasts.add({
      title: t('categorias.eliminada'),
      priority: 'low',
      actionProps: {
        children: t('categorias.deshacer'),
        onClick: async () => {
          // A fresh account's category holds no rows, so bringing it back is creating it again.
          try {
            await actions.create({ name: category.name, color: category.color, budget: null }, cycleStart, 'onward')
            toasts.close(id)
          } catch {
            toasts.update(id, { title: t('categorias.errorDeshacer'), priority: 'high', actionProps: undefined })
          }
        },
      },
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('categorias.titulo')}</h1>

      {suggestions.length > 0 ? (
        <div role="group" aria-label={t('categorias.sugeridas')} className="flex flex-wrap gap-2">
          {suggestions.map((name) => (
            <button
              key={name}
              type="button"
              data-leaving={taken[name] === 'leaving' || undefined}
              onClick={() => void takeSuggestion(name)}
              className="onboarding-chip h-9 rounded-full bg-muted px-4 text-body-md font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {name}
            </button>
          ))}
        </div>
      ) : null}

      <div className="rounded-card border bg-card">
        <form onSubmit={submitComposer} className="flex min-h-row items-center gap-3 px-inset py-2">
          <input
            type="text"
            aria-label={t('categorias.nombre')}
            placeholder={t('categorias.nombre')}
            autoCapitalize="sentences"
            enterKeyHint="done"
            aria-invalid={composerError != null || undefined}
            aria-describedby={composerError ? `${listId}-composer-error` : undefined}
            readOnly={busy}
            value={composer}
            onChange={(event) => {
              setComposer(event.target.value)
              setComposerError(null)
            }}
            className="field-focus min-w-0 flex-1 rounded-lg bg-muted px-3 py-1.5 text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={busy || composer.trim() === ''}
            className="onboarding-button h-10 shrink-0 rounded-full px-3 text-body-lg font-medium text-brand-ink outline-none focus-visible:outline-2 disabled:opacity-50"
          >
            {t('categorias.anadir')}
          </button>
        </form>
        {composerError ? (
          <p id={`${listId}-composer-error`} role="alert" className="px-inset pb-3 text-body-sm text-destructive-ink">
            {tCategory('nombreDuplicado')}
          </p>
        ) : null}

        {categories.length > 0 ? (
          <ul aria-label={t('categorias.lista')} className="border-t border-border">
            {categories.map((category) => {
              const isEditing = editing?.id === category.id
              const colorLabelId = `${listId}-${category.id}-color`
              return (
                <li key={category.id} className="onboarding-row">
                  <SwipeToDelete rowId={category.id} onDelete={() => remove(category)}>
                    <div className="flex min-h-row items-center gap-3 px-inset">
                      <button
                        type="button"
                        id={colorLabelId}
                        aria-label={t('categorias.color', { categoria: category.name })}
                        aria-expanded={pickerId === category.id}
                        onClick={() => setPickerId((prev) => (prev === category.id ? null : category.id))}
                        className="onboarding-button grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2"
                      >
                        <CategoryDot color={category.color} className="size-3" />
                      </button>
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          aria-label={t('categorias.renombrar', { categoria: category.name })}
                          enterKeyHint="done"
                          value={editing.name}
                          onChange={(event) => setEditing({ id: category.id, name: event.target.value })}
                          onBlur={() => void rename(category, editing.name)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setEditing(null)
                          }}
                          className="field-focus min-w-0 flex-1 rounded-lg bg-muted px-2 py-1 text-body-lg text-foreground outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={t('categorias.renombrar', { categoria: category.name })}
                          onClick={() => setEditing({ id: category.id, name: category.name })}
                          className={cn('min-w-0 flex-1 truncate py-2 text-left text-body-lg text-foreground outline-none focus-visible:outline-2')}
                        >
                          {category.name}
                        </button>
                      )}
                    </div>
                  </SwipeToDelete>
                  <Collapsible open={pickerId === category.id}>
                    <div className="pb-3">
                      <ColorSwatchPicker value={category.color} onChange={(color) => void recolour(category, color)} labelledBy={colorLabelId} />
                    </div>
                  </Collapsible>
                </li>
              )
            })}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
