import { Plus } from 'lucide-react'

type AddRowProps = {
  label: string
  onClick?: () => void
}

export function AddRow({ label, onClick }: AddRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="group/add pressable relative flex min-h-row w-full items-center gap-3 px-inset text-left [--press-tint:8%] before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border hover:bg-foreground/[0.04] disabled:pointer-events-none disabled:opacity-50"
    >
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand/15 text-brand-ink transition-[background-color_150ms_ease-out,color_150ms_ease-out] group-hover/add:bg-brand group-hover/add:text-primary-foreground motion-safe:transition-[background-color_150ms_ease-out,color_150ms_ease-out,scale_400ms_var(--ease-spring)] motion-safe:group-hover/add:scale-105 motion-safe:group-active/add:scale-90">
        <Plus
          aria-hidden
          strokeWidth={2.5}
          className="size-4 motion-safe:transition-transform motion-safe:duration-400 motion-safe:ease-spring motion-safe:group-hover/add:rotate-90"
        />
      </span>
      <span className="text-body-lg font-medium text-brand-ink transition-colors duration-150 ease-out group-hover/add:text-brand">
        {label}
      </span>
    </button>
  )
}
