import type { LocalDate } from './expenses'

export type SavingsMovementKind = 'deposit' | 'withdrawal'

export type SavingsMovementDraft = {
  kind: SavingsMovementKind
  name: string // trimmed, never empty
  amount: number // > 0, at most two decimals; the sign comes from `kind`
  date: LocalDate
}

/**
 * One operation, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - it resolves once the movement is durable, and rejects with nothing changed
 * - the amount is always positive; the sign is applied by the implementation from `kind`
 */
export type SavingsMutations = {
  addSavingsMovement(draft: SavingsMovementDraft): Promise<void>
}

export type SavingsProgress = {
  target: number
  deposited: number
  withdrawn: number
  net: number
  netRatio: number
  depositedRatio: number
  reached: boolean
}

export function getSavingsProgress({
  target,
  movements,
}: {
  target: number
  movements: { amount: number }[]
}): SavingsProgress {
  const deposited = movements.filter((m) => m.amount > 0).reduce((sum, m) => sum + m.amount, 0)
  const withdrawn = movements.filter((m) => m.amount < 0).reduce((sum, m) => sum - m.amount, 0)
  const net = deposited - withdrawn
  const netRatio = Math.min(1, Math.max(0, net / target))
  const depositedRatio = Math.min(1, Math.max(0, deposited / target))
  const reached = net >= target

  return { target, deposited, withdrawn, net, netRatio, depositedRatio, reached }
}
