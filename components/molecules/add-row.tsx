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
      className="pressable relative flex min-h-row w-full items-center gap-3 px-inset text-body-lg font-medium text-brand-ink before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border disabled:pointer-events-none disabled:opacity-50"
    >
      <Plus aria-hidden className="size-5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}
