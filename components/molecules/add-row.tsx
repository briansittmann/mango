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
      className="flex min-h-12 w-full items-center gap-2 rounded-lg px-2 text-sm font-medium text-brand-ink transition-colors hover:bg-brand/10 disabled:pointer-events-none disabled:opacity-50"
    >
      <Plus aria-hidden className="size-4" />
      <span>{label}</span>
    </button>
  )
}
