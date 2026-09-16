import { Check } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/lib/data/dashboard'

const CATEGORY_COLORS: CategoryColor[] = [
  'naranja_calido',
  'verde_profundo',
  'azul_apagado',
  'gris_calido',
  'violeta_metalico',
  'gris_oscuro',
  'blanco',
  'granate',
]

type ColorSwatchPickerProps = {
  value: CategoryColor
  onChange: (color: CategoryColor) => void
  labelledBy: string
  disabled?: boolean
}

export function ColorSwatchPicker({ value, onChange, labelledBy, disabled }: ColorSwatchPickerProps) {
  const t = useTranslations('hojaCategoria.colores')

  return (
    <div role="radiogroup" aria-labelledby={labelledBy} className="flex flex-wrap gap-1 px-3">
      {CATEGORY_COLORS.map((color) => {
        const selected = value === color
        return (
          <button
            key={color}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(color)}
            disabled={disabled}
            onClick={() => onChange(color)}
            className="pressable relative grid size-11 shrink-0 place-items-center rounded-full [--press-scale:0.94] disabled:opacity-50"
          >
            <span
              aria-hidden
              className={cn('size-7 rounded-full ring-1 ring-border', selected && 'ring-2 ring-foreground')}
              style={{ background: `var(--cat-${color})` }}
            />
            {selected ? (
              <span aria-hidden className="absolute bottom-1 right-1 grid size-4 place-items-center rounded-full bg-card ring-1 ring-border">
                <Check className="size-2.5 text-foreground" strokeWidth={3} />
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
