import { UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'

type AvatarProps = {
  name: string
  photoUrl: string | null
  size?: 'sm' | 'md' | 'lg'
  /** The initial pops in each time it changes (the onboarding's live avatar). */
  animateInitial?: boolean
  className?: string
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-8 text-label-ui',
  md: 'size-10 text-label-ui',
  lg: 'size-24 font-display text-display-mobile',
}

export function Avatar({ name, photoUrl, size = 'md', animateInitial = false, className }: AvatarProps) {
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

  const initial = name.trim().charAt(0).toUpperCase()
  return (
    <span
      className={cn(
        SIZE_CLASSES[size],
        'grid shrink-0 place-items-center rounded-full border border-brand/40 bg-brand/10 font-semibold text-brand-ink',
        className,
      )}
    >
      {initial ? (
        <span key={initial} className={cn(animateInitial && 'animate-segment-pop motion-reduce:animate-none')}>
          {initial}
        </span>
      ) : (
        <UserRound aria-hidden className={size === 'lg' ? 'size-10 text-brand-ink/60' : 'size-4 text-brand-ink/60'} />
      )}
    </span>
  )
}
