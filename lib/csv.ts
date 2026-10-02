import type { DashboardData } from './data/dashboard'

export type CsvLabels = {
  headers: { date: string; kind: string; category: string; description: string; amount: string; currency: string; status: string }
  kinds: { expense: string; income: string; savings: string }
  statuses: { charged: string; pending: string; projected: string }
}

/**
 * The displayed cycle as one CSV: every expense, income entry and savings movement, one per row,
 * ordered by date. Spanish opens in Excel with `;` and decimal comma; English with `,` and dot.
 */
export function buildCycleCsv(data: DashboardData, labels: CsvLabels, locale: string): string {
  const separator = locale === 'es' ? ';' : ','
  const decimal = locale === 'es' ? ',' : '.'
  const currency = data.user.currency

  const rows: string[][] = []
  for (const group of data.expenses.groups) {
    for (const expense of group.expenses) {
      const status = expense.projected
        ? labels.statuses.projected
        : expense.fixed
          ? expense.fixed.charged
            ? labels.statuses.charged
            : labels.statuses.pending
          : ''
      rows.push([expense.date, labels.kinds.expense, group.name, expense.name, formatAmount(-expense.amount, decimal), currency, status])
    }
  }
  for (const entry of data.income.entries) {
    rows.push([entry.date, labels.kinds.income, '', entry.name, formatAmount(entry.amount, decimal), currency, entry.projected ? labels.statuses.projected : ''])
  }
  for (const movement of data.savings.movements) {
    rows.push([movement.date, labels.kinds.savings, '', movement.name, formatAmount(movement.amount, decimal), currency, ''])
  }
  rows.sort((a, b) => a[0].localeCompare(b[0]))

  const h = labels.headers
  const lines = [[h.date, h.kind, h.category, h.description, h.amount, h.currency, h.status], ...rows]
  // BOM so Excel reads the accents as UTF-8.
  return '﻿' + lines.map((line) => line.map((cell) => escapeCell(cell, separator)).join(separator)).join('\r\n')
}

function formatAmount(amount: number, decimal: string): string {
  return amount.toFixed(2).replace('.', decimal)
}

function escapeCell(value: string, separator: string): string {
  if (!/[";\n\r]/.test(value) && !value.includes(separator)) return value
  return `"${value.replace(/"/g, '""')}"`
}

/** Triggers the browser download of a CSV; the object URL is revoked once the click is dispatched. */
export function downloadCsv(filename: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
