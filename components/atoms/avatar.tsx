import { cn } from '@/lib/utils'

type AvatarProps = {
  name: string
  photoUrl: string | null
  size?: 'sm' | 'md'
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-8',
  md: 'size-10',
}

export function Avatar({ name, photoUrl, size = 'md', className }: AvatarProps) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={name}
        className={cn(SIZE_CLASSES[size], 'shrink-0 rounded-full border border-brand/40 object-cover', className)}
      />
    )
  }

  return (
    <span
      className={cn(
        SIZE_CLASSES[size],
        'grid shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 text-xs font-semibold text-brand-ink',
        className,
      )}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
