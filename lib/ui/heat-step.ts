import type { DayTotal } from '@/lib/data/weekly-spend'

/** The calendar's heat ramp (`spend-insights`): one fill per step, shared by the widget and the day detail's grid. */
export const HEAT_STEP_CLASS: Record<DayTotal['step'], string> = {
  0: 'bg-foreground/[0.05] text-muted-foreground',
  1: 'bg-heat-1 text-foreground',
  2: 'bg-heat-2 text-foreground',
  3: 'bg-heat-3 text-heat-ink-high',
  4: 'bg-heat-4 text-heat-ink-high',
}
