import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: [
        'display',
        'display-mobile',
        'headline-lg',
        'headline-md',
        'headline-sm',
        'body-lg',
        'body-md',
        'body-sm',
        'tabular-numeric-lg',
        'tabular-numeric-md',
        'label-caps',
        'label-ui',
      ],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
