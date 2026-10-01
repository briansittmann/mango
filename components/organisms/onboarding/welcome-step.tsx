import { useTranslations } from 'next-intl'

/**
 * Step 1 (`onboarding` → *Welcome without a loaded expense*, D14): the logo pops, the title comes
 * in, the three lines follow 50 ms apart. No field, no name, nothing to congratulate. Nothing here
 * blocks "Empezar", which the template renders in its own slot.
 */
export function WelcomeStep() {
  const t = useTranslations('onboarding')
  const lines = ['linea1', 'linea2', 'linea3'] as const

  return (
    <div className="flex flex-col items-center pt-8 text-center sm:pt-16">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-[72px] animate-header-pop object-contain motion-reduce:animate-none dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-[72px] animate-header-pop object-contain motion-reduce:animate-none dark:block" />
      <h1 className="mt-8 animate-header-in font-display text-display-mobile text-foreground [animation-delay:90ms] motion-reduce:animate-none">
        {t('bienvenida.titulo')}
      </h1>
      <ul className="mt-6 flex flex-col gap-3 text-body-lg text-muted-foreground">
        {lines.map((line, index) => (
          <li key={line} className="onboarding-fade-in" style={{ animationDelay: `${50 + index * 50}ms` }}>
            {t(`bienvenida.${line}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
