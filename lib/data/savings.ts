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
