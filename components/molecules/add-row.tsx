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
      className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-inner border border-dashed border-foreground/15 text-label-ui text-muted-foreground transition-colors hover:border-brand/35 hover:text-brand-ink disabled:pointer-events-none disabled:opacity-50"
    >
      <Plus aria-hidden className="size-5" />
      <span>{label}</span>
    </button>
  )
}
