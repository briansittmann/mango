type AvatarProps = {
  name: string
  photoUrl: string | null
  className?: string
}

export function Avatar({ name, photoUrl, className }: AvatarProps) {
  if (photoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={photoUrl} alt={name} className={`size-9 shrink-0 rounded-full object-cover ${className ?? ''}`} />
    )
  }

  return (
    <span
      className={`flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-medium text-secondary-foreground ${className ?? ''}`}
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  )
}
