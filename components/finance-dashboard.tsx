'use client'

import { useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Languages, LogOut, Moon, Plus, Smartphone, WalletCards } from 'lucide-react'
import { t } from '@/lib/translations'

type Expense = { name: string; amount: string; date: string }
type PaletteName = 'slate' | 'amber' | 'orange' | 'purple' | 'blue' | 'stone'
type Budget = { amount: number; spent: number; pace: string; weeklyLeft: string }
type Category = { id: string; name: string; total: string; colorName: PaletteName; expenses: Expense[]; budget?: Budget }

const palette: Record<PaletteName, string> = { slate: '#59605A', amber: '#F0B429', orange: '#E87924', purple: '#9B5DE5', blue: '#4C8DCE', stone: '#9C9A92' }
const categories: Category[] = [
  { id: 'fixed', name: t.categories.fixed, total: '820 €', colorName: 'slate', expenses: [{ name: 'Alquiler', amount: '650 €', date: '' }, { name: 'Electricidad y agua', amount: '75 €', date: '' }, { name: 'Internet y móvil', amount: '42 €', date: '' }, { name: 'Gimnasio', amount: '35 €', date: '' }, { name: 'Suscripciones streaming', amount: '18 €', date: '' }] },
  { id: 'food', name: t.categories.food, total: '420 €', colorName: 'amber', expenses: [{ name: 'Lidl', amount: '62,40 €', date: t.dates.sep3 }, { name: 'Café Nero', amount: '3,50 €', date: t.dates.sep3 }, { name: 'Supermercado Tesco', amount: '48,10 €', date: t.dates.sep2 }], budget: { amount: 500, spent: 420, pace: 'Te quedan 20 por semana', weeklyLeft: 'Te quedan 20 por semana' } },
  { id: 'variable', name: t.categories.variable, total: '340 €', colorName: 'orange', expenses: [{ name: 'Compras', amount: '140 €', date: t.dates.sep12 }, { name: 'Ocio', amount: '120 €', date: t.dates.sep21 }] },
  { id: 'supplements', name: t.categories.supplements, total: '78 €', colorName: 'purple', expenses: [{ name: 'Creatina', amount: '22 €', date: t.dates.sep3 }, { name: 'Proteína', amount: '28 €', date: t.dates.sep12 }, { name: 'Omega 3', amount: '10 €', date: t.dates.sep21 }] },
  { id: 'health', name: t.categories.health, total: '85 €', colorName: 'blue', expenses: [] },
  { id: 'transport', name: t.categories.transport, total: '90 €', colorName: 'stone', expenses: [] },
]

function AddAction({ label }: { label: string }) {
  return <button type="button" className="mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-white/15 text-[15px] font-medium text-muted transition-colors hover:border-lime/35 hover:text-lime"><Plus className="size-5" aria-hidden="true" />{label}</button>
}

function CategoryCard({ name, colorName, total, items, budget, weeklyLeft, expanded, onToggle }: { name: string; colorName: PaletteName; total: string; items: Expense[]; budget?: Budget; weeklyLeft?: string; expanded: boolean; onToggle: () => void }) {
  const color = palette[colorName]
  const progress = budget ? Math.min(100, (budget.spent / budget.amount) * 100) : 0
  const threshold = budget && budget.spent > budget.amount ? 'bg-red' : budget && budget.spent / budget.amount >= 0.8 ? 'bg-amber' : 'bg-lime'
  return <section className={`overflow-hidden rounded-[24px] border bg-surface/90 transition-colors ${expanded ? '' : 'border-border hover:border-white/25'}`} style={expanded ? { borderColor: color } : undefined}>
    <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex min-h-[72px] w-full items-center gap-3 px-5 text-left">
      <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />
      <span className="min-w-0 flex-1 text-[18px] font-semibold text-text">{name}</span>
      <span className="text-right font-semibold tabular-nums text-text">{budget ? <><span>{budget.spent} €</span> <span className="font-normal text-muted">de {budget.amount} €</span></> : total}</span>
      {expanded ? <ChevronUp className="size-5 text-lime" aria-hidden="true" /> : <ChevronDown className="size-5 text-muted" aria-hidden="true" />}
    </button>
    {budget && <div className="px-5 pb-3"><div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10"><div className={`h-full rounded-full ${threshold}`} style={{ width: `${progress}%` }} /></div><p className="mt-2 text-sm text-muted">{weeklyLeft ?? budget.weeklyLeft ?? budget.pace}</p></div>}
    {expanded && <div className="px-5 pb-4"><div className="divide-y divide-border/70">{items.map((item) => <div key={item.name} className="flex min-h-12 items-center gap-4 rounded-lg py-2 transition-colors hover:bg-white/[0.04]"><div className="min-w-0 flex-1"><p className="truncate text-[16px] text-text">{item.name}</p>{item.date && <p className="mt-0.5 text-sm text-muted">{item.date}</p>}</div><span className="min-w-[76px] rounded-lg bg-white/[0.035] px-3 py-2 text-right text-[16px] font-semibold tabular-nums text-text">{item.amount}</span></div>)}</div><AddAction label={t.addExpense} /></div>}
  </section>
}

type SummaryKind = 'income' | 'expenses' | 'savings'

function SummaryCard({ label, value, active, lime, onToggle, expandedHeader, children }: { label: string; value: string; active: boolean; lime?: boolean; onToggle: () => void; expandedHeader?: ReactNode; children: ReactNode }) {
  return <div className="contents">
    <section className={`order-1 rounded-[22px] border bg-surface transition-colors ${active ? 'border-lime/60' : 'border-border hover:border-lime/35'}`}>
      <button type="button" onClick={onToggle} aria-expanded={active} className={`flex min-h-[104px] w-full flex-col p-3 text-left ${active ? 'text-lime' : 'hover:text-text'}`}><div className="flex w-full items-center justify-between"><span className="text-xs font-semibold tracking-[0.12em] text-muted">{label}</span>{active ? <ChevronUp className="size-4 text-lime" /> : <ChevronDown className="size-4 text-muted" />}</div><p className={`mt-4 text-[24px] font-bold tabular-nums ${lime ? 'text-lime' : 'text-text'}`}>{value}</p></button>
    </section>
    {active && <section className="order-2 col-span-3 rounded-[22px] border border-white/10 bg-lime/[0.06] px-3 pb-3 pt-3 transition-colors hover:border-lime/30">{expandedHeader}{children}</section>}
  </div>
}

function SummaryRow({ name, detail, amount, color, muted, tone, onClick }: { name: string; detail?: string; amount?: string; color?: string; muted?: boolean; tone?: 'positive' | 'negative'; onClick?: () => void }) {
  const amountTone = tone === 'positive' ? 'text-lime' : tone === 'negative' ? 'text-red' : muted ? 'text-lime/70' : 'text-text'
  const content = <><div className="flex min-w-0 flex-1 items-center gap-2">{color && <span aria-hidden="true" className="size-3 shrink-0 rounded-full" style={{ backgroundColor: color }} />}<div className="min-w-0"><p className={`truncate text-[16px] ${muted ? 'text-lime/70' : 'text-text'}`}>{name}</p>{detail && <p className="mt-0.5 truncate text-xs text-muted">{detail}</p>}</div></div>{amount && <span className={`min-w-[78px] text-right text-[15px] font-semibold tabular-nums ${amountTone}`}>{amount}</span>}</>
  return onClick ? <button type="button" onClick={onClick} className="flex min-h-12 w-full items-center gap-4 rounded-lg text-left transition-colors hover:bg-white/[0.04]">{content}</button> : <div className="flex min-h-12 w-full items-center gap-4 rounded-lg transition-colors hover:bg-white/[0.04]">{content}</div>
}

function AccountMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null
  const rowClass = 'flex min-h-10 w-full items-center gap-3 text-left text-[11px] text-text'
  return <>
    <button type="button" aria-label="Cerrar menú" onClick={onClose} className="fixed inset-0 z-40 bg-black/35 backdrop-blur-[3px]" />
    <section className="fixed inset-x-3 bottom-3 z-50 mx-auto h-auto max-h-[80vh] max-w-[420px] rounded-[18px] border border-white/15 border-t-white/30 bg-[#111511]/85 p-3 shadow-2xl backdrop-blur-2xl" aria-label="Menú de cuenta">
      <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-white/35 md:hidden" />
      <div className="flex items-center gap-2 border-b border-white/10 pb-3"><div className="grid size-8 place-items-center rounded-full border border-lime/40 bg-lime/10 text-[11px] font-semibold text-lime">MG</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-text">{t.account.name}</p><p className="truncate text-[8px] text-muted">{t.account.email}</p></div><span className="rounded-full bg-lime/15 px-2 py-1 text-[8px] font-bold text-lime">{t.account.plan}</span></div>
      <div className="flex flex-col gap-0.5 py-2"><button type="button" className={rowClass}><Moon className="size-3.5 text-lime" /><span className="flex-1">{t.account.theme}</span><span className="text-[9px] text-muted">{t.account.themeValue} ›</span></button><button type="button" className={rowClass}><Languages className="size-3.5 text-lime" /><span className="flex-1">{t.account.language}</span><span className="text-[9px] text-muted">{t.account.languageValue} ›</span></button><button type="button" className={rowClass}><WalletCards className="size-3.5 text-lime" /><span className="flex-1">{t.account.currency}</span><span className="text-[9px] text-muted">{t.account.currencyValue} ›</span></button><div className={rowClass}><Smartphone className="size-3.5 text-lime" /><div className="flex-1"><p>{t.account.reminders}</p><p className="text-[8px] text-muted">{t.account.remindersDetail}</p></div><span className="relative h-3.5 w-6 rounded-full bg-lime"><span className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-[#111511]" /></span></div></div>
      <button type="button" className="flex min-h-8 w-full items-center justify-center gap-2 border-t border-white/10 pt-2 text-[10px] font-semibold text-red"><LogOut className="size-3" />{t.account.logout}</button>
    </section>
  </>
}

function SpendingChart() {
  const values = ['1.4k', '1.6k', '1.8k', '1.9k', '1.5k', '1.8k']
  const heights = ['55%', '68%', '78%', '88%', '65%', '78%']
  return <section className="rounded-[24px] border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-text">{t.lastMonths}</h2><span className="text-xs font-semibold tracking-[0.08em] text-muted">{t.monthlySpend}</span></div><div className="mt-5 flex h-40 items-end justify-between gap-3 rounded-[20px] bg-background/80 px-4 pb-3 pt-5">{values.map((value, index) => <div key={value + index} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className={`text-xs ${index === values.length - 1 ? 'font-semibold text-lime' : 'text-muted'}`}>{value}</span><div className={`w-full max-w-8 rounded-t-lg ${index === values.length - 1 ? 'bg-lime shadow-[0_0_18px_rgba(195,232,107,0.3)]' : 'bg-[#20251F]'}`} style={{ height: heights[index] }} /><span className={`text-sm ${index === values.length - 1 ? 'font-semibold text-lime' : 'text-muted'}`}>{t.months[index]}</span></div>)}</div></section>
}

export default function FinanceDashboard() {
  const [expanded, setExpanded] = useState<string | null>(null)
  const [accountOpen, setAccountOpen] = useState(false)
  const [summaryExpanded, setSummaryExpanded] = useState<SummaryKind | null>(null)
  const categoriesRef = useRef<HTMLDivElement>(null)
  const scrollToCategories = () => categoriesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  const toggle = (id: string) => setExpanded((current) => current === id ? null : id)
  const toggleSummary = (kind: SummaryKind) => setSummaryExpanded((current) => current === kind ? null : kind)
  const sortedCategories = [...categories].sort((a, b) => Number.parseInt(b.total) - Number.parseInt(a.total))
  return <main className="app-shell min-h-screen bg-transparent text-text"><div className="mx-auto min-h-screen max-w-[480px] px-5 pb-12 pt-7 sm:px-6">
    <header className="flex items-center justify-between"><div className="flex items-center gap-3"><img src="/mango-logo.svg" alt="" className="size-9 object-contain" /><span className="text-[22px] font-bold tracking-tight">{t.appName}</span></div><div className="flex items-center"><button type="button" aria-label="Abrir menú de cuenta" onClick={() => setAccountOpen(true)} className="grid size-10 place-items-center rounded-full border border-lime/40 bg-lime/10 text-xs font-semibold text-lime">MG</button></div></header>
    <AccountMenu open={accountOpen} onClose={() => setAccountOpen(false)} />
    <div className="mt-8 flex items-center justify-between gap-4"><div className="flex h-12 items-center rounded-full border border-border bg-surface px-2"><button type="button" aria-label={t.previous} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"><ChevronLeft className="size-6" /></button><span className="min-w-[158px] text-center text-[18px] font-bold">{t.month}</span><button type="button" aria-label={t.next} className="grid size-9 place-items-center rounded-full text-muted transition-colors hover:text-text"><ChevronRight className="size-6" /></button></div><span className="text-[16px] font-semibold tracking-[0.04em] text-muted">{t.inProgress}</span></div>
    <section className="hero-card mt-7 rounded-[26px] border p-6"><div className="flex items-start justify-between"><p className="text-sm font-semibold tracking-[0.14em] text-muted">{t.freeMargin}</p><span className="rounded-full border border-lime/30 bg-lime/10 px-3 py-1 text-sm font-semibold text-lime">{t.available}</span></div><p className="hero-value mt-5 text-[64px] font-bold leading-none tracking-[-0.06em] text-lime">540<span className="ml-2 text-[42px]">€</span></p><div className="mt-6 h-px bg-border" /><p className="mt-4 text-sm text-muted"><span className="mr-2 text-lime">•</span>{t.incomeSummary}</p></section>
    <section className="mt-5 flex flex-col gap-3"><div className="grid grid-cols-3 gap-3"><SummaryCard label={t.income} value="2.400 €" active={summaryExpanded === 'income'} onToggle={() => toggleSummary('income')} expandedHeader={<div className="flex items-center justify-between border-b border-border py-4"><div className="flex items-center gap-3"><span className="size-3 rounded-full bg-lime" /><span className="text-[18px] font-bold uppercase text-text">{t.incomeSourcesTitle}</span></div><span className="text-[20px] font-bold tabular-nums text-lime">2.400 €</span></div>}><div className="divide-y divide-border/70">{t.incomeSources.map((source) => <SummaryRow key={source.name} name={source.name} detail={source.detail} amount={source.amount} />)}<AddAction label={t.addIncome} /></div></SummaryCard><SummaryCard label={t.expenses} value="1.833 €" active={summaryExpanded === 'expenses'} onToggle={() => toggleSummary('expenses')}><div className="-mt-1 divide-y divide-border/70 pt-2">{sortedCategories.map((category) => <SummaryRow key={category.id} name={category.name} amount={category.total} color={palette[category.colorName]} />)}<button type="button" onClick={scrollToCategories} className="flex min-h-12 w-full items-center justify-center gap-2 text-[15px] font-medium text-muted"><span>{t.viewAllExpenses}</span><ChevronDown className="size-4 text-muted" aria-hidden="true" /></button></div></SummaryCard><SummaryCard label={t.savings} value="280 €" lime active={summaryExpanded === 'savings'} onToggle={() => toggleSummary('savings')}><div className="flex items-center justify-between border-b border-border py-4"><div><p className="text-sm font-semibold text-muted">{t.savingsCycle}</p><p className="text-[24px] font-bold text-lime">280 €</p></div><div className="text-right"><p className="text-sm font-semibold text-muted">{t.accumulatedBalance}</p><p className="text-[24px] font-bold text-text">4.850 €</p></div></div><div className="divide-y divide-border/70">{t.savingsMovements.map((movement) => <SummaryRow key={movement.name} name={movement.name} detail={movement.detail} amount={movement.amount} tone={movement.kind === 'deposit' ? 'positive' : 'negative'} />)}<AddAction label={t.addMovement} /></div></SummaryCard></div></section>
    <div className="mt-10 flex items-center justify-between"><h2 className="text-sm font-semibold tracking-[0.14em] text-muted">{t.expenseBreakdown}</h2><button type="button" className="flex items-center gap-1.5 text-sm font-medium text-muted"><ChevronUp className="size-4 text-lime" />{t.collapseAll}</button></div>
    <div ref={categoriesRef} className="mt-4 scroll-mt-24 flex flex-col gap-3">{categories.map((category) => <CategoryCard key={category.id} name={category.name} colorName={category.colorName} total={category.total} items={category.expenses} budget={category.budget} expanded={expanded === category.id} onToggle={() => toggle(category.id)} />)}</div>
    <div className="mt-8 flex flex-col gap-5"><SpendingChart /><section className="rounded-[24px] border border-border bg-surface p-5"><div className="flex items-center justify-between"><h2 className="font-semibold text-text">{t.distribution}</h2><span className="font-bold text-text">1.833 €</span></div><div className="mt-5 flex items-center gap-5"><div className="grid size-28 shrink-0 place-items-center rounded-full" style={{ background: 'conic-gradient(#59605A 0deg 161deg, #E87924 161deg 310deg, #9C9A92 310deg 328deg, #4C8DCE 328deg 345deg, #9B5DE5 345deg 360deg)' }}><div className="grid size-20 place-items-center rounded-full bg-surface text-center"><span className="text-[10px] text-muted">{t.total}</span><strong className="-mt-1 text-sm">1.833€</strong></div></div><div className="flex flex-1 flex-col gap-2 text-sm">{categories.slice(0, 5).map((category) => <div key={category.id} className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: palette[category.colorName] }} /><span className="min-w-0 flex-1 truncate text-muted">{category.name}</span><strong className="text-text">{category.total}</strong></div>)}</div></div></section></div>
  </div></main>
}
