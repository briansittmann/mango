import { useFormatter } from 'next-intl'

type ShortDateProps = {
  date: string
  timeZone: string
  className?: string
}

export function ShortDate({ date, timeZone, className }: ShortDateProps) {
  const format = useFormatter()

  return (
    <span className={className}>
      {format.dateTime(new Date(date), { day: 'numeric', month: 'short', timeZone })}
    </span>
  )
}
