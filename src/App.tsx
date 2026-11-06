import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import type { SupabaseClient, User } from '@supabase/supabase-js'
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  BookOpen,
  CalendarDays,
  CalendarPlus,
  Check,
  CircleAlert,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  CreditCard,
  Download,
  Ellipsis,
  FileText,
  LayoutDashboard,
  ListFilter,
  Moon,
  MoreHorizontal,
  PartyPopper,
  Plus,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Target,
  Trash2,
  TrendingUp,
  Upload,
  Users,
  Wallet,
  X,
  LogOut,
} from 'lucide-react'
import './App.css'
import './Cloud.css'
import './Admin.css'
import './Calendar.css'
import './Obligations.css'
import SavingsGoalsPage, { unlockedFor as unlockedSavingsAchievements } from './SavingsGoals'
import './SavingsGoals.css'
import {
  nextSavingsDate,
  savingsBalance,
  savingsCategories,
  savingsDateString,
  savingsFrequencies,
  type SavingsAchievement,
  type SavingsGoal,
  type SavingsMovement,
  type SavingsSchedule,
} from './savingsModel'

type TransactionType = 'income' | 'expense' | 'transfer-in' | 'transfer-out'
type AccountType = 'checking' | 'savings' | 'cash' | 'digital'
type Transaction = {
  id: string
  description: string
  amountCents: number
  type: TransactionType
  category: string
  date: string
  accountId: string
  sourcePaymentId?: string
  sourceGoalMovementId?: string
}
type DebtType = 'vehicle' | 'home' | 'purchase' | 'personal-loan' | 'consigned' | 'fgts' | 'secured-vehicle' | 'secured-home' | 'credit' | 'person-to-person' | 'other'
type DebtPayment = {
  id: string
  amountCents: number
  date: string
  accountId: string
  method: string
  note: string
}
type Installment = {
  id: string
  number: number
  dueDate: string
  amountCents: number
  payments: DebtPayment[]
}
type Debt = {
  id: string
  name: string
  type: DebtType
  creditor: string
  description: string
  originalAmountCents: number
  receivedAmountCents?: number
  installmentAmountCents: number
  installmentCount: number
  startDate: string
  dueDay: number
  firstDueDate: string
  overdueRecord?: boolean
  monthlyInterestBps?: number
  annualInterestBps?: number
  cetBps?: number
  downPaymentCents: number
  notes: string
  installments: Installment[]
  reductions: { term?: number; installmentAmountCents?: number }
}
type BillFrequency = 'once' | 'weekly' | 'monthly' | 'quarterly' | 'yearly'
type Bill = {
  id: string
  name: string
  category: string
  amountCents: number
  frequency: BillFrequency
  startDate: string
  endDate?: string
  overdueRecord?: boolean
  dueDay: number
  accountId: string
  notes: string
  occurrences: { date: string; amountCents?: number; payments: DebtPayment[] }[]
}
type PaymentTarget =
  | { kind: 'debt'; debtId: string; installmentNumber: number; label: string; remainingCents: number }
  | { kind: 'bill'; billId: string; date: string; label: string; remainingCents: number; preferredAccountId?: string }
type CalendarObligation = {
  key: string
  title: string
  subtitle: string
  date: string
  amountCents: number
  remainingCents: number
  status: string
  target: PaymentTarget | null
}
type CalendarEventType = 'bill' | 'receivable' | 'card' | 'installment' | 'investment' | 'reminder'
type CalendarEvent = {
  id: string
  title: string
  date: string
  type: CalendarEventType
  amountCents?: number
  note: string
  done: boolean
}
type Account = {
  id: string
  name: string
  type: AccountType
  openingBalanceCents: number
  color: string
}
type NotebookNote = {
  id: string
  title: string
  content: string
  updatedAt: string
}
type AppData = {
  version: 1
  theme: 'dark' | 'light'
  transactions: Transaction[]
  calendarEvents: CalendarEvent[]
  debts: Debt[]
  bills: Bill[]
  accounts: Account[]
  notes?: NotebookNote[]
  reminderDays?: number[]
  savingsGoals: SavingsGoal[]
  savingsSchedules: SavingsSchedule[]
  savingsAchievements: SavingsAchievement[]
}
type FinanceAppProps = {
  initialData?: AppData
  cloudUser?: string
  cloudLabel?: string
  cloudSyncStatus?: string
  cloudSyncError?: string
  presenceError?: string
  adminClient?: SupabaseClient
  onCloudPersist?: (next: AppData) => void
  onRetrySync?: () => void
  onSignOut?: () => void
}
type Page = 'dashboard' | 'transactions' | 'accounts' | 'calendar' | 'obligations' | 'notes' | 'savings' | 'reports' | 'settings' | 'admin'

const STORAGE_KEY = 'nexus-finance-data-v1'
const defaultReminderDays = [7, 3, 1, 0]
const reminderOptions = [
  { days: 7, label: '7 dias antes' },
  { days: 3, label: '3 dias antes' },
  { days: 1, label: '1 dia antes' },
  { days: 0, label: 'No dia do vencimento' },
]
const incomeCategories = ['Salário', 'Freelance', 'Vendas', 'Comissões', 'Investimentos', 'Outros']
const expenseCategories = ['Alimentação', 'Moradia', 'Transporte', 'Saúde', 'Educação', 'Lazer', 'Compras', 'Assinaturas', 'Contas domésticas', 'Outros']
const calendarEventTypes: { value: CalendarEventType; label: string }[] = [
  { value: 'bill', label: 'Conta a pagar' },
  { value: 'receivable', label: 'Conta a receber' },
  { value: 'card', label: 'Fatura de cartão' },
  { value: 'installment', label: 'Parcela' },
  { value: 'investment', label: 'Investimento' },
  { value: 'reminder', label: 'Lembrete' },
]
const debtTypes: { value: DebtType; label: string }[] = [
  { value: 'vehicle', label: 'Financiamento de veículo' },
  { value: 'home', label: 'Financiamento imobiliário' },
  { value: 'purchase', label: 'Compra parcelada' },
  { value: 'personal-loan', label: 'Empréstimo pessoal' },
  { value: 'consigned', label: 'Empréstimo consignado' },
  { value: 'fgts', label: 'Antecipação do FGTS' },
  { value: 'secured-vehicle', label: 'Empréstimo com garantia de veículo' },
  { value: 'secured-home', label: 'Empréstimo com garantia de imóvel' },
  { value: 'credit', label: 'Crédito pessoal bancário' },
  { value: 'person-to-person', label: 'Empréstimo entre pessoas' },
  { value: 'other', label: 'Outra dívida' },
]
const paymentMethods = ['PIX', 'Débito', 'Transferência', 'Boleto', 'Dinheiro', 'Desconto em folha', 'Outro']
const accountTypes: { value: AccountType; label: string }[] = [
  { value: 'checking', label: 'Conta corrente' },
  { value: 'savings', label: 'Poupança' },
  { value: 'digital', label: 'Conta digital' },
  { value: 'cash', label: 'Dinheiro' },
]

function emptyData(): AppData {
  return {
    version: 1,
    theme: 'dark',
    transactions: [],
    calendarEvents: [],
    debts: [],
    bills: [],
    accounts: [],
    notes: [],
    reminderDays: defaultReminderDays,
    savingsGoals: [],
    savingsSchedules: [],
    savingsAchievements: [],
  }
}

function parseAppData(value: unknown): AppData {
  if (!value || typeof value !== 'object') throw new Error('O arquivo não contém um backup válido do Nexus Finance.')
  const data = value as Partial<AppData>
  if (
    data.version !== 1 ||
    !Array.isArray(data.transactions) ||
    !Array.isArray(data.calendarEvents ?? []) ||
    !Array.isArray(data.debts ?? []) ||
    !Array.isArray(data.bills ?? []) ||
    !Array.isArray(data.accounts) ||
    (data.theme !== 'dark' && data.theme !== 'light')
  ) {
    throw new Error('Formato de backup incompatível. Nenhum dado foi alterado.')
  }
  const validTransactions = data.transactions.every((item) => {
    if (!item || typeof item !== 'object') return false
    const transaction = item as Transaction
    return typeof transaction.id === 'string'
      && typeof transaction.description === 'string'
      && Number.isSafeInteger(transaction.amountCents)
      && transaction.amountCents > 0
      && ['income', 'expense', 'transfer-in', 'transfer-out'].includes(transaction.type)
      && typeof transaction.category === 'string'
      && isValidDate(transaction.date)
      && typeof transaction.accountId === 'string'
      && (transaction.sourcePaymentId === undefined || typeof transaction.sourcePaymentId === 'string')
      && (transaction.sourceGoalMovementId === undefined || typeof transaction.sourceGoalMovementId === 'string')
  })
  const validAccounts = data.accounts.every((item) => {
    if (!item || typeof item !== 'object') return false
    const account = item as Account
    return typeof account.id === 'string'
      && typeof account.name === 'string'
      && account.name.trim().length > 0
      && accountTypes.some((type) => type.value === account.type)
      && Number.isSafeInteger(account.openingBalanceCents)
      && typeof account.color === 'string'
  })
  const calendarEvents = data.calendarEvents ?? []
  const validCalendarEvents = calendarEvents.every((item) => {
    if (!item || typeof item !== 'object') return false
    const calendarEvent = item as CalendarEvent
    return typeof calendarEvent.id === 'string'
      && typeof calendarEvent.title === 'string'
      && calendarEvent.title.trim().length > 0
      && isValidDate(calendarEvent.date)
      && calendarEventTypes.some((type) => type.value === calendarEvent.type)
      && (calendarEvent.amountCents === undefined || (Number.isSafeInteger(calendarEvent.amountCents) && calendarEvent.amountCents > 0))
      && typeof calendarEvent.note === 'string'
      && typeof calendarEvent.done === 'boolean'
  })
  const debts = data.debts ?? []
  const validDebts = debts.every((item) => {
    if (!item || typeof item !== 'object') return false
    const debt = item as Debt
    return typeof debt.id === 'string'
      && typeof debt.name === 'string'
      && debt.name.trim().length > 0
      && debtTypes.some((type) => type.value === debt.type)
      && typeof debt.creditor === 'string'
      && typeof debt.description === 'string'
      && Number.isSafeInteger(debt.originalAmountCents)
      && debt.originalAmountCents > 0
      && (debt.receivedAmountCents === undefined || (Number.isSafeInteger(debt.receivedAmountCents) && debt.receivedAmountCents > 0))
      && Number.isSafeInteger(debt.installmentAmountCents)
      && debt.installmentAmountCents > 0
      && Number.isInteger(debt.installmentCount)
      && debt.installmentCount > 0
      && isValidDate(debt.startDate)
      && Number.isInteger(debt.dueDay)
      && debt.dueDay >= 1 && debt.dueDay <= 31
      && isValidDate(debt.firstDueDate)
      && (debt.overdueRecord === undefined || typeof debt.overdueRecord === 'boolean')
      && Number.isSafeInteger(debt.downPaymentCents)
      && debt.downPaymentCents >= 0
      && (debt.monthlyInterestBps === undefined || (Number.isSafeInteger(debt.monthlyInterestBps) && debt.monthlyInterestBps >= 0))
      && (debt.annualInterestBps === undefined || (Number.isSafeInteger(debt.annualInterestBps) && debt.annualInterestBps >= 0))
      && (debt.cetBps === undefined || (Number.isSafeInteger(debt.cetBps) && debt.cetBps >= 0))
      && typeof debt.notes === 'string'
      && Array.isArray(debt.installments)
      && debt.installments.every((installment) => isValidInstallment(installment))
      && typeof debt.reductions === 'object'
  })
  const bills = data.bills ?? []
  const validBills = bills.every((item) => {
    if (!item || typeof item !== 'object') return false
    const bill = item as Bill
    return typeof bill.id === 'string'
      && typeof bill.name === 'string'
      && bill.name.trim().length > 0
      && typeof bill.category === 'string'
      && Number.isSafeInteger(bill.amountCents)
      && bill.amountCents > 0
      && ['once', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(bill.frequency)
      && isValidDate(bill.startDate)
      && (bill.endDate === undefined || isValidDate(bill.endDate))
      && (bill.overdueRecord === undefined || typeof bill.overdueRecord === 'boolean')
      && Number.isInteger(bill.dueDay)
      && bill.dueDay >= 1 && bill.dueDay <= 31
      && typeof bill.accountId === 'string'
      && typeof bill.notes === 'string'
      && Array.isArray(bill.occurrences)
      && bill.occurrences.every((occurrence) => isValidDate(occurrence.date)
        && (occurrence.amountCents === undefined || (Number.isSafeInteger(occurrence.amountCents) && occurrence.amountCents > 0))
        && Array.isArray(occurrence.payments)
        && occurrence.payments.every(isValidPayment))
  })
  const savingsGoals = data.savingsGoals ?? []
  const storedTransactions = data.transactions ?? []
  const storedAccounts = data.accounts ?? []
  const validSavingsGoals = Array.isArray(savingsGoals) && savingsGoals.every((item) => {
    if (!item || typeof item !== 'object') return false
    const goal = item as SavingsGoal
    return typeof goal.id === 'string'
      && typeof goal.name === 'string' && goal.name.trim().length > 0
      && typeof goal.description === 'string'
      && savingsCategories.includes(goal.category)
      && (goal.category !== 'Personalizado' || (typeof goal.customCategory === 'string' && goal.customCategory.trim().length > 0))
      && typeof goal.icon === 'string'
      && typeof goal.color === 'string' && /^#[\da-f]{6}$/i.test(goal.color)
      && (goal.coverImage === undefined || (typeof goal.coverImage === 'string' && goal.coverImage.startsWith('data:image/') && goal.coverImage.length <= 700_000))
      && Number.isSafeInteger(goal.targetCents) && goal.targetCents > 0
      && isValidDate(goal.startDate) && isValidDate(goal.targetDate) && goal.targetDate >= goal.startDate
      && typeof goal.archived === 'boolean'
      && typeof goal.createdAt === 'string' && Number.isFinite(Date.parse(goal.createdAt))
      && (goal.yieldRateBps === undefined || (Number.isSafeInteger(goal.yieldRateBps) && goal.yieldRateBps >= 0 && goal.yieldRateBps <= 100_000))
      && (goal.yieldPeriod === undefined || goal.yieldPeriod === 'monthly' || goal.yieldPeriod === 'yearly')
      && Array.isArray(goal.movements)
      && goal.movements.every((movement) => {
        if (!movement || typeof movement !== 'object') return false
        return typeof movement.id === 'string'
          && (movement.type === 'deposit' || movement.type === 'withdrawal')
          && Number.isSafeInteger(movement.amountCents) && movement.amountCents > 0
          && isValidDate(movement.date)
          && typeof movement.createdAt === 'string' && Number.isFinite(Date.parse(movement.createdAt))
          && typeof movement.description === 'string'
          && storedAccounts.some((account) => account.id === movement.accountId)
          && typeof movement.linkedTransactionId === 'string'
          && (movement.scheduleId === undefined || typeof movement.scheduleId === 'string')
          && storedTransactions.some((transaction) => transaction.id === movement.linkedTransactionId
            && transaction.sourceGoalMovementId === movement.id
            && transaction.accountId === movement.accountId
            && transaction.amountCents === movement.amountCents
            && transaction.date === movement.date
            && transaction.type === (movement.type === 'deposit' ? 'transfer-out' : 'transfer-in'))
      })
  })
  const savingsSchedules = data.savingsSchedules ?? []
  const validSavingsSchedules = Array.isArray(savingsSchedules) && savingsSchedules.every((item) => {
    if (!item || typeof item !== 'object') return false
    const schedule = item as SavingsSchedule
    return typeof schedule.id === 'string'
      && savingsGoals.some((goal) => goal.id === schedule.goalId)
      && Number.isSafeInteger(schedule.amountCents) && schedule.amountCents > 0
      && savingsFrequencies.some((frequency) => frequency.value === schedule.frequency)
      && isValidDate(schedule.startDate) && isValidDate(schedule.nextDate)
      && schedule.nextDate >= schedule.startDate
      && (schedule.endDate === undefined || (isValidDate(schedule.endDate) && schedule.endDate >= schedule.startDate))
      && storedAccounts.some((account) => account.id === schedule.accountId)
      && typeof schedule.active === 'boolean'
      && Array.isArray(schedule.runs)
      && schedule.runs.every((run) => isValidDate(run.date)
        && ['completed', 'insufficient-funds', 'missed', 'reverted'].includes(run.status)
        && (run.movementId === undefined || typeof run.movementId === 'string')
        && (run.status !== 'completed' || savingsGoals.some((goal) => goal.movements.some((movement) =>
          movement.id === run.movementId && movement.scheduleId === schedule.id && movement.date === run.date)))
        && (run.status !== 'reverted' || run.movementId === undefined || savingsGoals.every((goal) => goal.movements.every((movement) => movement.id !== run.movementId))))
  })
  const savingsAchievements = data.savingsAchievements ?? []
  const validSavingsAchievements = Array.isArray(savingsAchievements) && savingsAchievements.every((item) =>
    item && typeof item === 'object'
    && typeof item.id === 'string'
    && typeof item.achievedAt === 'string'
    && Number.isFinite(Date.parse(item.achievedAt))
    && (item.goalId === undefined || savingsGoals.some((goal) => goal.id === item.goalId)),
  )
  const validGoalTransactions = storedTransactions.every((transaction) => {
    if (!transaction.sourceGoalMovementId) return transaction.type !== 'transfer-in' && transaction.type !== 'transfer-out'
    return savingsGoals.flatMap((goal) => goal.movements).filter((movement) =>
      movement.id === transaction.sourceGoalMovementId
      && movement.linkedTransactionId === transaction.id
      && movement.amountCents === transaction.amountCents
      && movement.accountId === transaction.accountId
      && movement.date === transaction.date
      && transaction.type === (movement.type === 'deposit' ? 'transfer-out' : 'transfer-in'),
    ).length === 1
  })
  const notes = data.notes ?? []
  const validNotes = Array.isArray(notes) && notes.length <= 500 && notes.every((item) =>
    item && typeof item === 'object'
    && typeof item.id === 'string'
    && typeof item.title === 'string' && item.title.trim().length > 0 && item.title.length <= 120
    && typeof item.content === 'string' && item.content.length <= 20_000
    && typeof item.updatedAt === 'string' && Number.isFinite(Date.parse(item.updatedAt)),
  )
  const reminderDays = data.reminderDays ?? defaultReminderDays
  const validReminderDays = Array.isArray(reminderDays)
    && reminderDays.every((day) => Number.isInteger(day) && day >= 0 && day <= 30)
    && new Set(reminderDays).size === reminderDays.length
  if (!validTransactions || !validAccounts || !validCalendarEvents || !validDebts || !validBills || !validNotes || !validReminderDays || !validSavingsGoals || !validSavingsSchedules || !validSavingsAchievements || !validGoalTransactions) throw new Error('O backup contém registros inválidos. Nenhum dado foi alterado.')
  return {
    version: 1,
    theme: data.theme,
    transactions: data.transactions,
    calendarEvents,
    debts,
    bills,
    accounts: data.accounts,
    notes,
    reminderDays,
    savingsGoals,
    savingsSchedules,
    savingsAchievements,
  }
}

function isValidPayment(payment: unknown): payment is DebtPayment {
  if (!payment || typeof payment !== 'object') return false
  const record = payment as DebtPayment
  return typeof record.id === 'string'
    && Number.isSafeInteger(record.amountCents)
    && record.amountCents > 0
    && isValidDate(record.date)
    && typeof record.accountId === 'string'
    && typeof record.method === 'string'
    && typeof record.note === 'string'
}

function isValidInstallment(value: unknown): value is Installment {
  if (!value || typeof value !== 'object') return false
  const installment = value as Installment
  return typeof installment.id === 'string'
    && Number.isInteger(installment.number)
    && installment.number > 0
    && isValidDate(installment.dueDate)
    && Number.isSafeInteger(installment.amountCents)
    && installment.amountCents > 0
    && Array.isArray(installment.payments)
    && installment.payments.every(isValidPayment)
}

function readData(): AppData {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (!stored) return emptyData()
  return parseAppData(JSON.parse(stored) as unknown)
}

function todayString() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function money(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(`${date}T12:00:00`))
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function dateToString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isValidDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1])
    && date.getMonth() === Number(match[2]) - 1
    && date.getDate() === Number(match[3])
}

function transactionInMonth(transaction: Transaction, month: string) {
  return transaction.date.slice(0, 7) === month
}

function accountBalance(account: Account, transactions: Transaction[]) {
  return transactions.reduce((balance, transaction) => {
    if (transaction.accountId !== account.id) return balance
    return balance + (transaction.type === 'income' || transaction.type === 'transfer-in' ? transaction.amountCents : -transaction.amountCents)
  }, account.openingBalanceCents)
}

function addMonthsWithDay(date: string, monthOffset: number, dueDay?: number) {
  const [year, month] = date.split('-').map(Number)
  const targetMonth = new Date(year, month - 1 + monthOffset, 1)
  const day = Math.min(dueDay ?? Number(date.slice(8, 10)), new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate())
  return dateToString(new Date(targetMonth.getFullYear(), targetMonth.getMonth(), day))
}

function paymentTotal(payments: DebtPayment[]) {
  return payments.reduce((sum, payment) => sum + payment.amountCents, 0)
}

function installmentRemaining(installment: Installment) {
  return Math.max(0, installment.amountCents - paymentTotal(installment.payments))
}

function installmentStatus(installment: Installment, today = todayString()) {
  const remaining = installmentRemaining(installment)
  if (remaining === 0) return 'paid'
  let status: string
  if (installment.dueDate < today) status = 'overdue'
  else if (installment.dueDate === today) status = 'today'
  else {
    const due = new Date(`${installment.dueDate}T12:00:00`)
    const current = new Date(`${today}T12:00:00`)
    const days = Math.round((due.getTime() - current.getTime()) / 86_400_000)
    status = days <= 7 ? 'soon' : 'upcoming'
  }
  return paymentTotal(installment.payments) > 0 ? `partial-${status}` : status
}

function billOccurrenceDates(bill: Bill, month: Date) {
  const occurrences: string[] = []
  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const monthEnd = new Date(month.getFullYear(), month.getMonth(), daysInMonth)
  const start = new Date(`${bill.startDate}T12:00:00`)
  const end = bill.endDate ? new Date(`${bill.endDate}T12:00:00`) : null
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(month.getFullYear(), month.getMonth(), day, 12)
    if (date < start || (end && date > end)) continue
    const monthsSinceStart = (date.getFullYear() - start.getFullYear()) * 12 + date.getMonth() - start.getMonth()
    let matches = false
    if (bill.frequency === 'once') {
      matches = dateToString(date) === bill.startDate
    } else if (bill.frequency === 'weekly') {
      const daysSinceStart = Math.round((date.getTime() - new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12).getTime()) / 86_400_000)
      matches = daysSinceStart >= 0 && daysSinceStart % 7 === 0
    } else if (bill.frequency === 'monthly') {
      matches = monthsSinceStart >= 0 && day === Math.min(bill.dueDay, daysInMonth)
    } else if (bill.frequency === 'quarterly') {
      matches = monthsSinceStart >= 0 && monthsSinceStart % 3 === 0 && day === Math.min(bill.dueDay, daysInMonth)
    } else {
      matches = monthsSinceStart >= 0 && monthsSinceStart % 12 === 0 && day === Math.min(bill.dueDay, daysInMonth)
    }
    if (matches && date >= monthStart && date <= monthEnd) occurrences.push(dateToString(date))
  }
  for (const occurrence of bill.occurrences) {
    if (occurrence.date.slice(0, 7) === monthKey(month) && !occurrences.includes(occurrence.date)) {
      occurrences.push(occurrence.date)
    }
  }
  occurrences.sort()
  return occurrences
}

function getBillOccurrence(bill: Bill, date: string) {
  return bill.occurrences.find((occurrence) => occurrence.date === date)
}

function occurrenceRemaining(bill: Bill, date: string) {
  const occurrence = getBillOccurrence(bill, date)
  return Math.max(0, (occurrence?.amountCents ?? bill.amountCents) - paymentTotal(occurrence?.payments ?? []))
}

function occurrenceStatus(bill: Bill, date: string, today = todayString()) {
  const remaining = occurrenceRemaining(bill, date)
  if (remaining === 0) return 'paid'
  let status: string
  if (date < today) status = 'overdue'
  else if (date === today) status = 'today'
  else {
    const due = new Date(`${date}T12:00:00`)
    const current = new Date(`${today}T12:00:00`)
    status = Math.round((due.getTime() - current.getTime()) / 86_400_000) <= 7 ? 'soon' : 'upcoming'
  }
  return paymentTotal(getBillOccurrence(bill, date)?.payments ?? []) > 0 ? `partial-${status}` : status
}

function downloadFile(filename: string, contents: string, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function FinanceApp({ initialData, cloudUser, cloudLabel, cloudSyncStatus, cloudSyncError, presenceError, adminClient, onCloudPersist, onRetrySync, onSignOut }: FinanceAppProps) {
  const [initial] = useState(() => {
    if (initialData) return { data: initialData, error: '' }
    try {
      return { data: readData(), error: '' }
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Não foi possível ler os dados locais.',
      }
    }
  })
  const [data, setData] = useState<AppData | null>(initial.data)
  const [storageError, setStorageError] = useState(initial.error)
  const [page, setPage] = useState<Page>('dashboard')
  const [transactionModal, setTransactionModal] = useState<Transaction | 'new' | null>(null)
  const [newTransactionDate, setNewTransactionDate] = useState(todayString)
  const [calendarEventModal, setCalendarEventModal] = useState<CalendarEvent | 'new' | null>(null)
  const [newCalendarEventDate, setNewCalendarEventDate] = useState(todayString)
  const [debtModal, setDebtModal] = useState<Debt | 'new' | null>(null)
  const [billModal, setBillModal] = useState<Bill | 'new' | null>(null)
  const [paymentTarget, setPaymentTarget] = useState<PaymentTarget | null>(null)
  const [accountModal, setAccountModal] = useState(false)
  const [query, setQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | TransactionType>('all')
  const [period, setPeriod] = useState('month')
  const [toast, setToast] = useState('')
  const [celebrationGoal, setCelebrationGoal] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Transaction | null>(null)
  const [calendarEventToDelete, setCalendarEventToDelete] = useState<CalendarEvent | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const processedScheduleDates = useRef(new Set<string>())
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2800)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    document.documentElement.dataset.theme = data?.theme ?? 'dark'
  }, [data?.theme])

  const persist = (next: AppData) => {
    setData(next)
    try {
      localStorage.setItem(cloudUser ? `${STORAGE_KEY}:${cloudUser}` : STORAGE_KEY, JSON.stringify(next))
      setStorageError('')
    } catch (error) {
      setStorageError(error instanceof Error ? `Não foi possível salvar neste navegador: ${error.message}` : 'Não foi possível salvar neste navegador.')
    }
    onCloudPersist?.(next)
  }

  useEffect(() => {
      if (!data) return
      const today = savingsDateString(now)
      let goals = data.savingsGoals
      let schedules = data.savingsSchedules
      let transactions = data.transactions
      let changed = false
      let deposited = false
      let completedGoalName: string | null = null

      for (const schedule of schedules) {
        if (!schedule.active || schedule.nextDate > today) continue
        const runKey = `${schedule.id}:${schedule.nextDate}`
        if (processedScheduleDates.current.has(runKey)) continue
        processedScheduleDates.current.add(runKey)

        let scheduledDate = schedule.nextDate
        let steps = 0
        while (scheduledDate < today && steps < 5000) {
          scheduledDate = nextSavingsDate(scheduledDate, schedule.frequency, Number(schedule.startDate.slice(8, 10)))
          steps += 1
        }
        const runDate = scheduledDate <= today ? scheduledDate : schedule.nextDate
        const isDueToday = runDate === today
        const account = data.accounts.find((item) => item.id === schedule.accountId)
        const goal = goals.find((item) => item.id === schedule.goalId)
        let run: SavingsSchedule['runs'][number]
        if (!isDueToday) {
          run = { date: schedule.nextDate, status: 'missed' }
        } else if (!account || !goal) {
          run = { date: runDate, status: 'insufficient-funds' }
        } else {
          const available = accountBalance(account, transactions)
          if (available < schedule.amountCents) {
            run = { date: runDate, status: 'insufficient-funds' }
          } else {
            const movement: SavingsMovement = {
              id: crypto.randomUUID(),
              type: 'deposit',
              amountCents: schedule.amountCents,
              date: runDate,
              createdAt: now.toISOString(),
              description: 'Depósito recorrente',
              accountId: schedule.accountId,
              linkedTransactionId: crypto.randomUUID(),
              scheduleId: schedule.id,
            }
            const balanceBefore = savingsBalance(goal)
            goals = goals.map((item) => item.id === goal.id ? { ...item, movements: [movement, ...item.movements] } : item)
            const updatedGoal = goals.find((item) => item.id === goal.id)
            if (updatedGoal && balanceBefore < goal.targetCents && savingsBalance(updatedGoal) >= goal.targetCents) completedGoalName = goal.name
            transactions = [{
              id: movement.linkedTransactionId,
              description: `${goal.name} · depósito recorrente`,
              amountCents: movement.amountCents,
              type: 'transfer-out',
              category: 'Objetivos financeiros',
              date: movement.date,
              accountId: movement.accountId,
              sourceGoalMovementId: movement.id,
            }, ...transactions]
            deposited = true
            run = { date: runDate, status: 'completed', movementId: movement.id }
          }
        }
        let nextDate = scheduledDate > today
          ? scheduledDate
          : nextSavingsDate(runDate, schedule.frequency, Number(schedule.startDate.slice(8, 10)))
        const isActive = !schedule.endDate || nextDate <= schedule.endDate
        schedules = schedules.map((item) => item.id === schedule.id
          ? { ...item, nextDate, active: isActive, runs: [...item.runs, run] }
          : item)
        changed = true
      }

      if (changed) {
        const newlyUnlocked = unlockedSavingsAchievements(goals, data.savingsAchievements, now)
        persist({
          ...data,
          savingsGoals: goals,
          savingsSchedules: schedules,
          savingsAchievements: [...data.savingsAchievements, ...newlyUnlocked],
          transactions,
        })
        if (deposited) setToast('Depósito recorrente registrado localmente no objetivo.')
        if (completedGoalName) setCelebrationGoal(completedGoalName)
      }
  }, [data, now])

  const openPayment = (target: PaymentTarget) => {
    if (!data) return
    if (data.accounts.length === 0) {
      setToast('Cadastre uma conta bancária antes de registrar pagamentos.')
      setPage('accounts')
      return
    }
    setPaymentTarget(target)
  }

  const currentMonth = monthKey(now)
  const monthTransactions = useMemo(
    () => (data?.transactions ?? []).filter((item) => transactionInMonth(item, currentMonth)),
    [data?.transactions, currentMonth],
  )
  const incomeThisMonth = monthTransactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amountCents : 0), 0)
  const expenseThisMonth = monthTransactions.reduce((sum, item) => sum + (item.type === 'expense' ? item.amountCents : 0), 0)
  const availableBalance = (data?.accounts ?? []).reduce((sum, account) => sum + accountBalance(account, data?.transactions ?? []), 0)
  const savingsRate = incomeThisMonth > 0 ? Math.round(((incomeThisMonth - expenseThisMonth) / incomeThisMonth) * 100) : null
  const visibleTransactions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('pt-BR')
    return [...(data?.transactions ?? [])]
      .filter((item) => typeFilter === 'all' || item.type === typeFilter)
      .filter((item) => !normalizedQuery || `${item.description} ${item.category}`.toLocaleLowerCase('pt-BR').includes(normalizedQuery))
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id))
  }, [data?.transactions, query, typeFilter])

  const saveTransaction = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const description = String(form.get('description') ?? '').trim()
    const amount = Number(String(form.get('amount') ?? '').replace(',', '.'))
    const date = String(form.get('date') ?? '')
    const type = String(form.get('type')) as TransactionType
    const category = String(form.get('category') ?? '')
    const accountId = String(form.get('accountId') ?? '')
    if (!description || !Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      setToast('Informe uma descrição e um valor válido maior que zero.')
      return
    }
    if (!isValidDate(date)) {
      setToast('Informe uma data válida.')
      return
    }
    const existing = transactionModal !== 'new' && transactionModal ? transactionModal : null
    if (existing?.sourcePaymentId || existing?.sourceGoalMovementId) {
      setToast('Movimentações vinculadas devem ser alteradas na tela do objetivo ou da obrigação.')
      return
    }
    const duplicate = data.transactions.some((item) =>
      item.id !== existing?.id
      && item.description.toLocaleLowerCase('pt-BR') === description.toLocaleLowerCase('pt-BR')
      && item.amountCents === Math.round(amount * 100)
      && item.date === date
      && item.type === type,
    )
    if (duplicate && !window.confirm('Já existe um lançamento com a mesma descrição, valor, data e tipo. Deseja salvar mesmo assim?')) return
    const transaction: Transaction = {
      id: existing?.id ?? crypto.randomUUID(),
      description,
      amountCents: Math.round(amount * 100),
      type,
      category,
      date,
      accountId,
    }
    const transactions = existing
      ? data.transactions.map((item) => item.id === existing.id ? transaction : item)
      : [transaction, ...data.transactions]
    persist({ ...data, transactions })
    setTransactionModal(null)
    setToast(existing ? 'Lançamento atualizado.' : 'Lançamento adicionado.')
  }

  const saveCalendarEvent = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const title = String(form.get('title') ?? '').trim()
    const date = String(form.get('date') ?? '')
    const type = String(form.get('type')) as CalendarEventType
    const note = String(form.get('note') ?? '').trim()
    const amountInput = String(form.get('amount') ?? '').trim()
    const amount = amountInput ? Number(amountInput.replace(',', '.')) : undefined
    const amountCents = amount === undefined ? undefined : Math.round(amount * 100)
    if (!title || !isValidDate(date) || (amount !== undefined && (!Number.isFinite(amount) || amount <= 0 || !Number.isSafeInteger(amountCents)))) {
      setToast('Informe um título, uma data válida e, se desejar, um valor maior que zero.')
      return
    }
    const existing = calendarEventModal !== 'new' && calendarEventModal ? calendarEventModal : null
    const duplicate = data.calendarEvents.some((item) =>
      item.id !== existing?.id
      && item.title.toLocaleLowerCase('pt-BR') === title.toLocaleLowerCase('pt-BR')
      && item.date === date
      && item.type === type,
    )
    if (duplicate && !window.confirm('Já existe um compromisso do mesmo tipo com este título e data. Deseja salvar mesmo assim?')) return
    const calendarEvent: CalendarEvent = {
      id: existing?.id ?? crypto.randomUUID(),
      title,
      date,
      type,
      ...(amountCents === undefined ? {} : { amountCents }),
      note,
      done: existing?.done ?? false,
    }
    const calendarEvents = existing
      ? data.calendarEvents.map((item) => item.id === existing.id ? calendarEvent : item)
      : [...data.calendarEvents, calendarEvent]
    persist({ ...data, calendarEvents })
    setCalendarEventModal(null)
    setToast(existing ? 'Compromisso atualizado.' : 'Compromisso adicionado.')
  }

  const savePayment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data || !paymentTarget) return
    const form = new FormData(event.currentTarget)
    const amount = Number(String(form.get('amount') ?? '').replace(',', '.'))
    const amountCents = Math.round(amount * 100)
    const date = String(form.get('date') ?? '')
    const accountId = String(form.get('accountId') ?? '')
    const method = String(form.get('method') ?? '')
    const note = String(form.get('note') ?? '').trim()
    if (!Number.isFinite(amount) || !Number.isSafeInteger(amountCents) || amountCents <= 0 || amountCents > paymentTarget.remainingCents) {
      setToast(`Informe um pagamento entre R$ 0,01 e ${money(paymentTarget.remainingCents)}.`)
      return
    }
    if (!isValidDate(date) || !data.accounts.some((account) => account.id === accountId)) {
      setToast('Selecione uma data e uma conta válidas para registrar o pagamento.')
      return
    }
    const payment: DebtPayment = { id: crypto.randomUUID(), amountCents, date, accountId, method, note }
    const transaction: Transaction = {
      id: crypto.randomUUID(),
      description: paymentTarget.label,
      amountCents,
      type: 'expense',
      category: paymentTarget.kind === 'debt' ? 'Dívidas e empréstimos' : 'Contas a pagar',
      date,
      accountId,
      sourcePaymentId: payment.id,
    }
    let nextData: AppData
    if (paymentTarget.kind === 'debt') {
      const debt = data.debts.find((item) => item.id === paymentTarget.debtId)
      if (!debt) {
        setToast('Esta dívida não foi encontrada. Atualize a página e tente novamente.')
        return
      }
      const installment = debt.installments.find((item) => item.number === paymentTarget.installmentNumber)
      if (!installment || payment.amountCents > installmentRemaining(installment)) {
        setToast('O saldo desta parcela mudou. Reabra o pagamento para usar o valor atualizado.')
        return
      }
      nextData = {
        ...data,
        debts: data.debts.map((item) => item.id === debt.id ? {
          ...item,
          installments: item.installments.map((entry) => entry.number === installment.number ? { ...entry, payments: [...entry.payments, payment] } : entry),
        } : item),
        transactions: [transaction, ...data.transactions],
      }
    } else {
      const bill = data.bills.find((item) => item.id === paymentTarget.billId)
      if (!bill || payment.amountCents > occurrenceRemaining(bill, paymentTarget.date)) {
        setToast('O saldo desta conta mudou. Reabra o pagamento para usar o valor atualizado.')
        return
      }
      const occurrence = getBillOccurrence(bill, paymentTarget.date) ?? { date: paymentTarget.date, amountCents: bill.amountCents, payments: [] }
      const occurrenceWithAmount = { ...occurrence, amountCents: occurrence.amountCents ?? bill.amountCents }
      nextData = {
        ...data,
        bills: data.bills.map((item) => item.id === bill.id ? {
          ...item,
          occurrences: item.occurrences.some((entry) => entry.date === occurrenceWithAmount.date)
            ? item.occurrences.map((entry) => entry.date === occurrenceWithAmount.date ? { ...occurrenceWithAmount, payments: [...entry.payments, payment] } : entry)
            : [...item.occurrences, { ...occurrenceWithAmount, payments: [...occurrenceWithAmount.payments, payment] }],
        } : item),
        transactions: [transaction, ...data.transactions],
      }
    }
    persist(nextData)
    setPaymentTarget(null)
    setToast(amountCents === paymentTarget.remainingCents ? 'Pagamento registrado e compromisso quitado.' : 'Pagamento parcial registrado.')
  }

  const saveDebt = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const type = String(form.get('type')) as DebtType
    const overdueRecord = form.get('entryMode') === 'overdue'
      || (debtModal !== 'new' && debtModal?.overdueRecord === true)
    const creditor = String(form.get('creditor') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const originalAmount = Number(String(form.get('originalAmount') ?? '').replace(',', '.'))
    const installmentCount = overdueRecord ? 1 : Number(form.get('installmentCount'))
    const installmentAmount = installmentCount === 1
      ? originalAmount
      : Number(String(form.get('installmentAmount') ?? '').replace(',', '.'))
    const firstDueDate = String(form.get('firstDueDate') ?? '')
    const dueDay = installmentCount === 1 ? Number(firstDueDate.slice(8, 10)) : Number(form.get('dueDay'))
    const interest = Number(String(form.get('monthlyInterest') ?? '').replace(',', '.'))
    const annualInterestInput = String(form.get('annualInterest') ?? '').trim()
    const annualInterest = annualInterestInput ? Number(annualInterestInput.replace(',', '.')) : undefined
    const cetInput = String(form.get('cet') ?? '').trim()
    const cet = cetInput ? Number(cetInput.replace(',', '.')) : undefined
    const receivedAmountInput = String(form.get('receivedAmount') ?? '').trim()
    const receivedAmount = receivedAmountInput ? Number(receivedAmountInput.replace(',', '.')) : undefined
    const downPayment = Number(String(form.get('downPayment') ?? '0').replace(',', '.'))
    const notes = String(form.get('notes') ?? '').trim()
    const originalAmountCents = Math.round(originalAmount * 100)
    const installmentAmountCents = Math.round(installmentAmount * 100)
    const receivedAmountCents = receivedAmount === undefined ? undefined : Math.round(receivedAmount * 100)
    const monthlyInterestBps = Math.round(interest * 100)
    const annualInterestBps = annualInterest === undefined ? undefined : Math.round(annualInterest * 100)
    const cetBps = cet === undefined ? undefined : Math.round(cet * 100)
    const downPaymentCents = Math.round(downPayment * 100)
    if (
      !name || !debtTypes.some((item) => item.value === type)
      || !Number.isSafeInteger(originalAmountCents) || originalAmountCents <= 0
      || !Number.isSafeInteger(installmentAmountCents) || installmentAmountCents <= 0
      || !Number.isInteger(installmentCount) || installmentCount < 1 || installmentCount > 600
      || !isValidDate(firstDueDate)
      || (overdueRecord && firstDueDate >= todayString())
      || (installmentCount > 1 && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31))
      || !Number.isFinite(interest) || interest < 0 || !Number.isSafeInteger(monthlyInterestBps)
      || (annualInterest !== undefined && (!Number.isFinite(annualInterest) || annualInterest < 0 || !Number.isSafeInteger(annualInterestBps)))
      || (cet !== undefined && (!Number.isFinite(cet) || cet < 0 || !Number.isSafeInteger(cetBps)))
      || (receivedAmount !== undefined && (!Number.isFinite(receivedAmount) || receivedAmountCents === undefined || !Number.isSafeInteger(receivedAmountCents) || receivedAmountCents <= 0))
      || !Number.isSafeInteger(downPaymentCents) || downPaymentCents < 0
    ) {
      setToast('Confira os valores, datas e quantidade de parcelas informados.')
      return
    }
    const editing = debtModal !== 'new' && debtModal ? debtModal : null
    if (!editing && data.debts.some((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      setToast('Já existe uma dívida com esse nome.')
      return
    }
    const id = editing?.id ?? crypto.randomUUID()
    const paidNumbers = editing?.installments.filter((item) => item.payments.length > 0).map((item) => item.number) ?? []
    const highestPaidNumber = Math.max(0, ...paidNumbers)
    if (highestPaidNumber > installmentCount) {
      setToast(`Esta dívida já possui pagamentos até a parcela ${highestPaidNumber}. A quantidade total não pode ser reduzida abaixo desse número.`)
      return
    }
    const installments: Installment[] = Array.from({ length: installmentCount }, (_, index) => {
      const number = index + 1
      const previous = editing?.installments.find((item) => item.number === number)
      const hasPaymentHistory = (previous?.payments.length ?? 0) > 0
      const amountCents = hasPaymentHistory ? previous!.amountCents : installmentAmountCents
      const dueDate = hasPaymentHistory ? previous!.dueDate : addMonthsWithDay(firstDueDate, index, dueDay)
      return {
        id: previous?.id ?? `${id}-${number}`,
        number,
        dueDate,
        amountCents,
        payments: previous?.payments ?? [],
      }
    })
    if (installments.some((item) => paymentTotal(item.payments) > item.amountCents)) {
      setToast('O novo valor de parcela é menor que um valor já pago. Mantenha ou aumente o valor para preservar o histórico.')
      return
    }
    const debt: Debt = {
      id,
      name,
      type,
      creditor,
      description,
      originalAmountCents,
      ...(receivedAmountCents === undefined ? {} : { receivedAmountCents }),
      installmentAmountCents,
      installmentCount,
      startDate: firstDueDate,
      dueDay,
      firstDueDate,
      ...(overdueRecord ? { overdueRecord: true } : {}),
      ...(interest > 0 ? { monthlyInterestBps } : {}),
      ...(annualInterestBps !== undefined && annualInterestBps > 0 ? { annualInterestBps } : {}),
      ...(cetBps !== undefined && cetBps > 0 ? { cetBps } : {}),
      downPaymentCents,
      notes,
      installments,
      reductions: editing?.reductions ?? {},
    }
    persist({
      ...data,
      debts: editing ? data.debts.map((item) => item.id === editing.id ? debt : item) : [...data.debts, debt],
    })
    setDebtModal(null)
    setToast(editing ? 'Contrato atualizado; pagamentos anteriores foram preservados.' : overdueRecord ? 'Dívida em atraso cadastrada. Registre o pagamento quando puder.' : installmentCount === 1 ? 'Dívida de valor único cadastrada.' : `${installmentCount} parcelas foram geradas.`)
  }

  const saveBill = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const category = String(form.get('category') ?? '').trim()
    const amount = Number(String(form.get('amount') ?? '').replace(',', '.'))
    const amountCents = Math.round(amount * 100)
    const editing = billModal !== 'new' && billModal ? billModal : null
    const overdueRecord = form.get('entryMode') === 'overdue'
      || (editing?.overdueRecord === true)
    const frequency = overdueRecord ? 'once' : String(form.get('frequency')) as BillFrequency
    const startDate = String(form.get('startDate') ?? '')
    const endValue = String(form.get('endDate') ?? '')
    const endDate = endValue || undefined
    const dueDay = frequency === 'once' ? Number(startDate.slice(8, 10)) : Number(form.get('dueDay'))
    const accountId = String(form.get('accountId') ?? '')
    const notes = String(form.get('notes') ?? '').trim()
    if (
      !name || !category || !Number.isSafeInteger(amountCents) || amountCents <= 0
      || !['once', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(frequency)
      || !isValidDate(startDate) || (endDate && !isValidDate(endDate))
      || (endDate && endDate < startDate)
      || (overdueRecord && startDate >= todayString())
      || (frequency !== 'once' && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31))
    ) {
      setToast(overdueRecord
        ? 'Confira o nome, categoria, valor e uma data de vencimento anterior a hoje.'
        : 'Confira o nome, valor, frequência e datas do compromisso recorrente.')
      return
    }
    if (!editing && data.bills.some((item) => item.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      setToast('Já existe uma conta ou dívida com esse nome.')
      return
    }
    const bill: Bill = {
      id: editing?.id ?? crypto.randomUUID(),
      name,
      category,
      amountCents,
      frequency,
      startDate,
      ...(overdueRecord ? { overdueRecord: true } : {}),
      ...(endDate ? { endDate } : {}),
      dueDay,
      accountId,
      notes,
      occurrences: editing?.occurrences.map((occurrence) => ({
        ...occurrence,
        amountCents: occurrence.amountCents ?? editing.amountCents,
      })) ?? [],
    }
    persist({ ...data, bills: editing ? data.bills.map((item) => item.id === editing.id ? bill : item) : [...data.bills, bill] })
    setBillModal(null)
    setToast(editing ? (overdueRecord ? 'Dívida atualizada; pagamentos anteriores foram preservados.' : 'Conta atualizada; pagamentos anteriores foram preservados.') : overdueRecord ? 'Dívida atrasada registrada. Você poderá lançar pagamentos quando pagar.' : frequency === 'once' ? 'Conta de valor único cadastrada.' : 'Conta recorrente adicionada.')
  }

  const toggleCalendarEvent = (calendarEvent: CalendarEvent) => {
    if (!data) return
    persist({
      ...data,
      calendarEvents: data.calendarEvents.map((item) => item.id === calendarEvent.id ? { ...item, done: !item.done } : item),
    })
    setToast(calendarEvent.done ? 'Compromisso reaberto.' : 'Compromisso concluído.')
  }

  const createAccount = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!data) return
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const balanceInput = String(form.get('balance') ?? '0').replace(',', '.')
    const openingBalance = Number(balanceInput)
    if (!name || !Number.isFinite(openingBalance) || !Number.isSafeInteger(Math.round(openingBalance * 100))) {
      setToast('Informe um nome e um saldo inicial válido.')
      return
    }
    if (data.accounts.some((account) => account.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))) {
      setToast('Já existe uma conta com esse nome.')
      return
    }
    const account: Account = {
      id: crypto.randomUUID(),
      name,
      type: String(form.get('type')) as AccountType,
      openingBalanceCents: Math.round(openingBalance * 100),
      color: String(form.get('color') ?? '#5ee1a0'),
    }
    persist({ ...data, accounts: [...data.accounts, account] })
    setAccountModal(false)
    setToast('Conta adicionada.')
  }

  const removeTransaction = (transaction: Transaction) => {
    if (!data) return
    if (transaction.sourceGoalMovementId) {
      const matches = data.savingsGoals.flatMap((goal) => goal.movements
        .filter((movement) => movement.id === transaction.sourceGoalMovementId)
        .map((movement) => ({ goal, movement })))
      if (matches.length !== 1) {
        setToast('Não foi possível localizar a movimentação vinculada; o lançamento foi mantido.')
        setDeleteTarget(null)
        return
      }
      if (transaction.type === 'transfer-in') {
        const account = data.accounts.find((item) => item.id === transaction.accountId)
        if (!account || accountBalance(account, data.transactions) < transaction.amountCents) {
          setToast('Não é possível desfazer a retirada: o banco não tem saldo suficiente para restaurar a operação.')
          setDeleteTarget(null)
          return
        }
      }
      const { goal, movement } = matches[0]
      const savingsGoals = data.savingsGoals.map((item) => item.id === goal.id
        ? { ...item, movements: item.movements.filter((entry) => entry.id !== movement.id) }
        : item)
      const savingsSchedules = data.savingsSchedules.map((schedule) => schedule.runs.some((run) => run.movementId === movement.id)
        ? { ...schedule, runs: schedule.runs.map((run) => run.movementId === movement.id ? { ...run, status: 'reverted' as const } : run) }
        : schedule)
      persist({
        ...data,
        savingsGoals,
        savingsSchedules,
        transactions: data.transactions.filter((item) => item.id !== transaction.id),
      })
      setDeleteTarget(null)
      setToast('Movimentação do objetivo removida e saldo atualizado.')
      return
    }
    let debts = data.debts
    let bills = data.bills
    if (transaction.sourcePaymentId) {
      const debtMatches = data.debts.flatMap((debt) => debt.installments.flatMap((installment) =>
        installment.payments.filter((payment) => payment.id === transaction.sourcePaymentId)
          .map((payment) => ({ debtId: debt.id, installmentNumber: installment.number, paymentId: payment.id })),
      ))
      const billMatches = data.bills.flatMap((bill) => bill.occurrences.flatMap((occurrence) =>
        occurrence.payments.filter((payment) => payment.id === transaction.sourcePaymentId)
          .map((payment) => ({ billId: bill.id, date: occurrence.date, paymentId: payment.id })),
      ))
      if (debtMatches.length + billMatches.length !== 1) {
        setToast('Não foi possível localizar o pagamento associado; o lançamento foi mantido para preservar o histórico.')
        setDeleteTarget(null)
        return
      }
      debts = data.debts.map((debt) => ({
        ...debt,
        installments: debt.installments.map((installment) => ({
          ...installment,
          payments: installment.payments.filter((payment) => payment.id !== transaction.sourcePaymentId),
        })),
      }))
      bills = data.bills.map((bill) => ({
        ...bill,
        occurrences: bill.occurrences.map((occurrence) => ({
          ...occurrence,
          payments: occurrence.payments.filter((payment) => payment.id !== transaction.sourcePaymentId),
        })),
      }))
    }
    persist({
      ...data,
      debts,
      bills,
      transactions: data.transactions.filter((item) => item.id !== transaction.id),
    })
    setDeleteTarget(null)
    setToast(transaction.sourcePaymentId ? 'Pagamento e lançamento removidos; o saldo da obrigação foi atualizado.' : 'Lançamento excluído.')
  }

  const removeAccount = (account: Account) => {
    if (!data) return
    if (data.transactions.some((item) => item.accountId === account.id)) {
      setToast('Esta conta possui lançamentos. Mova ou exclua-os antes de remover a conta.')
      return
    }
    if (!window.confirm(`Remover a conta “${account.name}”?`)) return
    persist({ ...data, accounts: data.accounts.filter((item) => item.id !== account.id) })
    setToast('Conta removida.')
  }

  const toggleTheme = () => {
    if (!data) return
    persist({ ...data, theme: data.theme === 'dark' ? 'light' : 'dark' })
  }

  const exportBackup = () => {
    if (!data) return
    downloadFile(`nexus-finance-backup-${todayString()}.json`, JSON.stringify(data, null, 2), 'application/json')
    setToast('Backup JSON exportado.')
  }

  const importBackup = async (file?: File) => {
    if (!file || !data) return
    try {
      const parsed = parseAppData(JSON.parse(await file.text()) as unknown)
      if (!window.confirm(`O backup contém ${parsed.transactions.length} lançamentos e ${parsed.accounts.length} contas. Ele substituirá os dados atuais. Continuar?`)) return
      persist(parsed)
      setToast('Backup restaurado com sucesso.')
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Não foi possível importar o backup.')
    } finally {
      if (importRef.current) importRef.current.value = ''
    }
  }

  const exportCsv = () => {
    const rows = [
      ['Data', 'Descrição', 'Tipo', 'Categoria', 'Conta', 'Valor (R$)'],
      ...visibleTransactions.map((transaction) => [
        transaction.date,
        transaction.description,
        transaction.type === 'income' ? 'Receita' : transaction.type === 'expense' ? 'Despesa' : 'Transferência interna',
        transaction.category,
        data?.accounts.find((account) => account.id === transaction.accountId)?.name ?? '',
        (transaction.amountCents / 100).toFixed(2).replace('.', ','),
      ]),
    ]
    const csv = `\uFEFF${rows.map((row) => row.map((field) => `"${field.replaceAll('"', '""')}"`).join(';')).join('\r\n')}`
    downloadFile(`nexus-finance-lancamentos-${todayString()}.csv`, csv, 'text/csv;charset=utf-8')
    setToast('Relatório CSV exportado.')
  }

  const navItems: { id: Page; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'dashboard', label: 'Visão geral', icon: LayoutDashboard },
    { id: 'transactions', label: 'Lançamentos', icon: ArrowLeftRight },
    { id: 'accounts', label: 'Bancos', icon: Wallet },
    { id: 'calendar', label: 'Calendário', icon: CalendarDays },
    { id: 'obligations', label: 'Dívidas e contas', icon: Banknote },
    { id: 'notes', label: 'Anotações', icon: BookOpen },
    { id: 'savings', label: 'MEUS OBJETIVOS', icon: Target },
    { id: 'reports', label: 'Relatórios', icon: FileText },
  ]
  if (cloudUser && adminClient) navItems.push({ id: 'admin', label: 'Administração', icon: ShieldCheck })

  const pageTitle: Record<Page, string> = {
    dashboard: 'Visão geral',
    transactions: 'Lançamentos',
    accounts: 'Bancos',
    calendar: 'Calendário',
    obligations: 'Dívidas e contas',
    notes: 'Anotações',
    savings: 'MEUS OBJETIVOS',
    reports: 'Relatórios',
    settings: 'Configurações',
    admin: 'Painel administrativo',
  }

  if (!data) {
    return (
      <main className="load-error">
        <div className="brand-mark"><Wallet size={22} /></div>
        <h1>Não foi possível abrir seus dados</h1>
        <p>{storageError}</p>
        <p>Os dados locais não foram sobrescritos. Se você tiver um backup JSON, restaure-o abaixo.</p>
        <label className="button button-primary upload-button">
          <Upload size={16} /> Restaurar backup
          <input type="file" accept="application/json,.json" onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            if (!file) return
            void file.text().then((text) => {
              const parsed = parseAppData(JSON.parse(text) as unknown)
              localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed))
              window.location.reload()
            }).catch((error: unknown) => setStorageError(error instanceof Error ? error.message : 'Não foi possível ler o backup.'))
          }} />
        </label>
      </main>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => setPage('dashboard')} aria-label="Nexus Finance, início">
          <span className="brand-mark"><Wallet size={21} strokeWidth={2.2} /></span>
          <span className="brand-copy"><strong>nexus</strong><small>FINANCE</small></span>
        </button>

        <div className="workspace-label">ESPAÇO PESSOAL</div>
        <nav className="main-nav" aria-label="Navegação principal">
          {navItems.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => setPage(id)}>
              <Icon size={18} strokeWidth={1.8} /><span>{label}</span>
              {id === 'transactions' && data.transactions.length > 0 && <span className="nav-count">{data.transactions.length}</span>}
            </button>
          ))}
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-help">
          <div className="help-icon"><CircleHelp size={17} /></div>
          <div><strong>Seus dados, no seu controle</strong><span>{cloudUser ? 'Sincronizados na sua conta Supabase.' : 'Salvos somente neste navegador.'}</span></div>
        </div>
        <button className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}>
          <Settings size={18} strokeWidth={1.8} /><span>Configurações</span>
        </button>
        <button className="profile-button" onClick={() => setPage('settings')}>
          <span className="avatar">N</span>
          <span className="profile-copy"><strong>{cloudUser ? cloudLabel ?? 'Minha conta' : 'Meu espaço'}</strong><small>{cloudUser ? 'Conta na nuvem' : 'Perfil local'}</small></span>
          <MoreHorizontal size={18} className="profile-more" />
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{pageTitle[page]}</strong></div>
          <div className="topbar-actions">
            <span className="local-badge"><span /> {cloudUser ? cloudSyncStatus ?? 'NUVEM' : 'LOCAL'}</span>
            {cloudUser && <button className="button button-secondary cloud-signout" onClick={onSignOut}>Sair</button>}
            <button className="icon-button" onClick={toggleTheme} title={data.theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'} aria-label="Alternar tema">
              {data.theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button className="avatar top-avatar" onClick={() => setPage('settings')} aria-label="Abrir configurações">N</button>
          </div>
        </header>

        {(storageError || cloudSyncError) && <div className="storage-warning" role="alert">{storageError || cloudSyncError}{cloudSyncError && onRetrySync && <button className="cloud-text-button" onClick={onRetrySync}>Sincronizar agora</button>}</div>}
        {presenceError && <div className="storage-warning" role="alert">{presenceError}</div>}
        <section className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">{dateLabel(todayString(), { weekday: 'long', day: 'numeric', month: 'long' })}</div>
              <h1>{page === 'dashboard' ? 'Seu dinheiro, em perspectiva.' : pageTitle[page]}</h1>
              <p>{page === 'dashboard' ? 'Acompanhe sua vida financeira em um só lugar.' : descriptions[page]}</p>
            </div>
            <div className="heading-actions">
              {page === 'dashboard' && (
                <button className="button button-secondary" onClick={() => setPage('transactions')}><ArrowLeftRight size={16} /> Ver lançamentos</button>
              )}
              {page === 'transactions' && (
                <button className="button button-primary" onClick={() => setTransactionModal('new')}><Plus size={17} /> Novo lançamento</button>
              )}
              {page === 'accounts' && (
                <button className="button button-primary" onClick={() => setAccountModal(true)}><Plus size={17} /> Adicionar banco</button>
              )}
            </div>
          </div>

          {page === 'dashboard' && (
            <Dashboard
              data={data}
              monthTransactions={monthTransactions}
              income={incomeThisMonth}
              expense={expenseThisMonth}
              balance={availableBalance}
              savingsRate={savingsRate}
              onAdd={() => setTransactionModal('new')}
              onNavigate={setPage}
              debts={data.debts}
              bills={data.bills}
              reminderDays={data.reminderDays ?? defaultReminderDays}
              now={now}
              onPay={openPayment}
              onEdit={(transaction) => {
                if (!transaction.sourcePaymentId && !transaction.sourceGoalMovementId) setTransactionModal(transaction)
              }}
            />
          )}

          {page === 'transactions' && (
            <TransactionsPage
              transactions={visibleTransactions}
              accounts={data.accounts}
              query={query}
              onQueryChange={setQuery}
              typeFilter={typeFilter}
              onTypeFilterChange={setTypeFilter}
              onAdd={() => setTransactionModal('new')}
              onEdit={(transaction) => {
                if (!transaction.sourcePaymentId && !transaction.sourceGoalMovementId) setTransactionModal(transaction)
              }}
              onDelete={setDeleteTarget}
            />
          )}

          {page === 'accounts' && (
            <AccountsPage accounts={data.accounts} transactions={data.transactions} onAdd={() => setAccountModal(true)} onDelete={removeAccount} />
          )}

          {page === 'calendar' && (
            <CalendarPage
              transactions={data.transactions}
              calendarEvents={data.calendarEvents}
              debts={data.debts}
              bills={data.bills}
              onPay={openPayment}
              onAdd={(date) => {
                setNewTransactionDate(date)
                setTransactionModal('new')
              }}
              onAddEvent={(date) => {
                setNewCalendarEventDate(date)
                setCalendarEventModal('new')
              }}
              onEdit={(transaction) => {
                if (!transaction.sourcePaymentId && !transaction.sourceGoalMovementId) setTransactionModal(transaction)
              }}
              onDelete={setDeleteTarget}
              onEditEvent={(calendarEvent) => setCalendarEventModal(calendarEvent)}
              onDeleteEvent={setCalendarEventToDelete}
              onToggleEvent={toggleCalendarEvent}
            />
          )}

          {page === 'obligations' && (
            <ObligationsPage
              debts={data.debts}
              bills={data.bills}
              now={now}
              onAddDebt={() => setDebtModal('new')}
              onEditDebt={setDebtModal}
              onAddBill={() => setBillModal('new')}
              onEditBill={setBillModal}
              onPay={openPayment}
              onDeleteDebt={(debt) => {
                if (debt.installments.some((item) => item.payments.length > 0)) {
                  setToast('Esta dívida tem pagamentos registrados; mantenha o histórico e edite o contrato em vez de excluí-lo.')
                  return
                }
                if (!window.confirm(`Excluir “${debt.name}” e suas parcelas não pagas?`)) return
                persist({ ...data, debts: data.debts.filter((item) => item.id !== debt.id) })
                setToast('Dívida excluída.')
              }}
              onDeleteBill={(bill) => {
                if (bill.occurrences.some((item) => item.payments.length > 0)) {
                  setToast('Esta conta recorrente tem pagamentos registrados e não pode ser excluída para preservar o histórico.')
                  return
                }
                if (!window.confirm(`Excluir a conta recorrente “${bill.name}”?`)) return
                persist({ ...data, bills: data.bills.filter((item) => item.id !== bill.id) })
                setToast('Conta recorrente excluída.')
              }}
            />
          )}

          {page === 'savings' && (
            <SavingsGoalsPage
              goals={data.savingsGoals}
              schedules={data.savingsSchedules}
              achievements={data.savingsAchievements}
              accounts={data.accounts}
              transactions={data.transactions}
              now={now}
              onSave={(savings) => persist({
                ...data,
                savingsGoals: savings.goals,
                savingsSchedules: savings.schedules,
                savingsAchievements: savings.achievements,
                transactions: savings.transactions,
              })}
              onToast={setToast}
              onCelebration={setCelebrationGoal}
            />
          )}

          {page === 'reports' && (
            <ReportsPage
              data={data}
              period={period}
              now={now}
              onPeriodChange={setPeriod}
              onExport={exportCsv}
            />
          )}

          {page === 'notes' && (
            <NotesPage
              notes={data.notes ?? []}
              onSave={(notes) => persist({ ...data, notes })}
            />
          )}

          {page === 'settings' && (
            <SettingsPage
              data={data}
              cloudEnabled={Boolean(cloudUser)}
              importRef={importRef}
              onThemeChange={toggleTheme}
              onExport={exportBackup}
              onImport={(file) => void importBackup(file)}
              onReminderDaysChange={(reminderDays) => persist({ ...data, reminderDays })}
            />
          )}
          {page === 'admin' && adminClient && <AdminPanel />}
        </section>
        <footer className="app-footer">Desenvolvido por <strong>Esley Augusto</strong></footer>
      </main>

      {transactionModal && <TransactionDialog transaction={transactionModal === 'new' ? null : transactionModal} initialDate={newTransactionDate} accounts={data.accounts} onClose={() => setTransactionModal(null)} onSubmit={saveTransaction} />}
      {calendarEventModal && <CalendarEventDialog calendarEvent={calendarEventModal === 'new' ? null : calendarEventModal} initialDate={calendarEventModal === 'new' ? newCalendarEventDate : calendarEventModal.date} onClose={() => setCalendarEventModal(null)} onSubmit={saveCalendarEvent} />}
      {debtModal && <DebtDialog debt={debtModal === 'new' ? null : debtModal} onClose={() => setDebtModal(null)} onSubmit={saveDebt} />}
      {billModal && <BillDialog bill={billModal === 'new' ? null : billModal} accounts={data.accounts} onClose={() => setBillModal(null)} onSubmit={saveBill} />}
      {accountModal && <AccountDialog onClose={() => setAccountModal(false)} onSubmit={createAccount} />}
      {deleteTarget && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setDeleteTarget(null) }}>
          <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="dialog-icon danger-icon"><Trash2 size={20} /></div>
            <h2 id="delete-title">Excluir lançamento?</h2>
            <p>{deleteTarget.sourcePaymentId
              ? `“${deleteTarget.description}” será removido do histórico e o pagamento associado será desfeito na obrigação.`
              : `“${deleteTarget.description}” será removido permanentemente deste navegador.`}</p>
            <div className="dialog-actions"><button className="button button-secondary" onClick={() => setDeleteTarget(null)}>Cancelar</button><button className="button button-danger" onClick={() => removeTransaction(deleteTarget)}>{deleteTarget.sourcePaymentId ? 'Excluir pagamento' : 'Excluir lançamento'}</button></div>
          </div>
        </div>
      )}
      {calendarEventToDelete && (
        <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setCalendarEventToDelete(null) }}>
          <div className="confirm-card" role="dialog" aria-modal="true" aria-labelledby="delete-calendar-event-title">
            <div className="dialog-icon danger-icon"><Trash2 size={20} /></div>
            <h2 id="delete-calendar-event-title">Excluir compromisso?</h2>
            <p>“{calendarEventToDelete.title}” será removido permanentemente do calendário.</p>
            <div className="dialog-actions"><button className="button button-secondary" onClick={() => setCalendarEventToDelete(null)}>Cancelar</button><button className="button button-danger" onClick={() => {
              if (!data) return
              persist({ ...data, calendarEvents: data.calendarEvents.filter((item) => item.id !== calendarEventToDelete.id) })
              setCalendarEventToDelete(null)
              setToast('Compromisso excluído.')
            }}>Excluir compromisso</button></div>
          </div>
        </div>
      )}
      {paymentTarget && <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setPaymentTarget(null) }}>
        <form className="form-dialog payment-form" onSubmit={savePayment} role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
          <div className="dialog-header"><div><div className="eyebrow">ATUALIZE O COMPROMISSO</div><h2 id="payment-dialog-title">Registrar pagamento</h2></div><button type="button" className="icon-button" onClick={() => setPaymentTarget(null)} aria-label="Fechar"><X size={18} /></button></div>
          <p className="payment-for">{paymentTarget.label}</p>
          <label className="form-label">Valor pago<div className="amount-input"><span>R$</span><input name="amount" type="number" step="0.01" min="0.01" max={(paymentTarget.remainingCents / 100).toFixed(2)} defaultValue={(paymentTarget.remainingCents / 100).toFixed(2)} required /></div><small className="form-hint">Saldo pendente: {money(paymentTarget.remainingCents)}. Pagamentos parciais são permitidos.</small></label>
          <div className="form-two-columns"><label className="form-label">Data do pagamento<input type="date" name="date" defaultValue={todayString()} required /></label><label className="form-label">Forma de pagamento<select name="method">{paymentMethods.map((method) => <option key={method}>{method}</option>)}</select></label></div>
          <label className="form-label">Conta utilizada<select name="accountId" required defaultValue={paymentTarget.kind === 'bill' && data.accounts.some((account) => account.id === paymentTarget.preferredAccountId) ? paymentTarget.preferredAccountId : data.accounts[0]?.id ?? ''}>{data.accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
          <label className="form-label">Observações (opcional)<textarea name="note" maxLength={240} rows={2} placeholder="Detalhes do pagamento" /></label>
          <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={() => setPaymentTarget(null)}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} /> Confirmar pagamento</button></div>
        </form>
      </div>}
      {celebrationGoal && <div className="savings-celebration-backdrop" role="dialog" aria-modal="true" aria-labelledby="goal-celebration-title"><div className="savings-celebration-card"><div className="celebration-sparkle"><PartyPopper size={32} /></div><span className="eyebrow">UM SONHO CONCLUÍDO</span><h2 id="goal-celebration-title">Você conseguiu!</h2><p>O objetivo <strong>{celebrationGoal}</strong> alcançou a meta. Cada passo valeu a pena.</p><button className="button button-primary" onClick={() => setCelebrationGoal(null)}><Check size={15} /> Comemorar</button></div></div>}
      {toast && <div className="toast" role="status"><Check size={16} />{toast}</div>}
      <nav className="mobile-nav" aria-label="Navegação móvel">
        {navItems.map(({ id, label, icon: Icon }) => <button key={id} className={page === id ? 'active' : ''} onClick={() => setPage(id)}><Icon size={19} /><span>{label}</span></button>)}
      </nav>
    </div>
  )
}

const descriptions: Record<Page, string> = {
  dashboard: '',
  transactions: 'Registre e acompanhe suas entradas e despesas.',
  accounts: 'Acompanhe seus bancos e os saldos das contas cadastradas.',
  calendar: 'Navegue pelas datas e gerencie suas movimentações financeiras.',
  obligations: 'Acompanhe dívidas, empréstimos e contas recorrentes até a quitação.',
  notes: 'Anote lembretes, ideias e informações importantes em seu caderno pessoal.',
  savings: 'Organize seus planos, acompanhe suas reservas e celebre cada conquista.',
  reports: 'Entenda seus movimentos financeiros por período.',
  settings: 'Personalize sua experiência e gerencie seus dados locais.',
  admin: 'Acompanhe acessos registrados e usuários ativos recentemente.',
}

function Dashboard({
  data,
  monthTransactions,
  income,
  expense,
  balance,
  savingsRate,
  onAdd,
  onNavigate,
  debts,
  bills,
  reminderDays,
  now,
  onPay,
  onEdit,
}: {
  data: AppData
  monthTransactions: Transaction[]
  income: number
  expense: number
  balance: number
  savingsRate: number | null
  onAdd: () => void
  onNavigate: (page: Page) => void
  debts: Debt[]
  bills: Bill[]
  reminderDays: number[]
  now: Date
  onPay: (target: PaymentTarget) => void
  onEdit: (transaction: Transaction) => void
}) {
  const recent = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)
  const categories = monthTransactions
    .filter((transaction) => transaction.type === 'expense')
    .reduce<Record<string, number>>((totals, transaction) => {
      totals[transaction.category] = (totals[transaction.category] ?? 0) + transaction.amountCents
      return totals
    }, {})
  const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5)
  const hasData = data.transactions.length > 0 || data.accounts.length > 0 || data.debts.length > 0 || data.bills.length > 0 || data.savingsGoals.length > 0

  return (
    <>
      <div className="summary-grid">
        <SummaryCard icon={Wallet} label="Saldo total nas contas" value={money(balance)} note={`${data.accounts.length} ${data.accounts.length === 1 ? 'conta cadastrada' : 'contas cadastradas'}`} tone="green" />
        <SummaryCard icon={ArrowDownLeft} label="Receitas do mês" value={money(income)} note={`${monthTransactions.filter((item) => item.type === 'income').length} recebimentos`} tone="blue" />
        <SummaryCard icon={ArrowUpRight} label="Despesas do mês" value={money(expense)} note={`${monthTransactions.filter((item) => item.type === 'expense').length} despesas`} tone="red" />
        <SummaryCard icon={TrendingUp} label="Economia do mês" value={savingsRate === null ? '—' : `${savingsRate}%`} note={savingsRate === null ? 'Cadastre receitas para calcular' : money(income - expense)} tone="violet" />
      </div>
      <button className="dashboard-savings-strip panel" onClick={() => onNavigate('savings')}>
        <span className="savings-strip-icon"><Target size={17} /></span>
        <span><small>Disponível nos bancos</small><strong>{money(balance)}</strong></span>
        <span><small>Reservado nos objetivos</small><strong>{money(data.savingsGoals.reduce((sum, goal) => sum + savingsBalance(goal), 0))}</strong></span>
        <span><small>Total acompanhado</small><strong>{money(balance + data.savingsGoals.reduce((sum, goal) => sum + savingsBalance(goal), 0))}</strong></span>
        <span className="text-button">MEUS OBJETIVOS <ArrowUpRight size={14} /></span>
      </button>
      {!hasData && (
        <div className="welcome-card">
          <div className="welcome-visual"><div className="welcome-orbit orbit-one" /><div className="welcome-orbit orbit-two" /><div className="welcome-wallet"><Wallet size={32} /></div><span className="floating-dot dot-a" /><span className="floating-dot dot-b" /></div>
          <div className="welcome-copy">
            <span className="welcome-tag">UM COMEÇO COM CLAREZA</span>
            <h2>Seu próximo passo financeiro começa aqui.</h2>
            <p>Adicione uma conta ou registre sua primeira movimentação. Seus dados ficam salvos apenas neste navegador e você pode exportar um backup a qualquer momento.</p>
            <div className="welcome-actions"><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Registrar lançamento</button><button className="text-button" onClick={() => onNavigate('accounts')}>Adicionar uma conta <ArrowUpRight size={15} /></button></div>
          </div>
        </div>
      )}

      <div className="dashboard-columns">
        <section className="panel cashflow-panel">
          <div className="panel-heading">
            <div><h2>Fluxo de caixa</h2><p>Entradas e saídas deste mês</p></div>
            <button className="subtle-select" onClick={() => onNavigate('reports')}>Detalhes <ArrowUpRight size={13} /></button>
          </div>
          {monthTransactions.length === 0 ? (
            <EmptyChart onClick={onAdd} />
          ) : (
            <CashflowChart transactions={monthTransactions} />
          )}
          <div className="chart-legend"><span><i className="legend-dot income-dot" />Receitas <strong>{money(income)}</strong></span><span><i className="legend-dot expense-dot" />Despesas <strong>{money(expense)}</strong></span></div>
        </section>
        <section className="panel category-panel">
          <div className="panel-heading"><div><h2>Gastos por categoria</h2><p>Distribuição neste mês</p></div><button className="icon-button small-icon" onClick={() => onNavigate('reports')} aria-label="Abrir relatórios"><Ellipsis size={19} /></button></div>
          {topCategories.length === 0 ? <div className="compact-empty"><div className="empty-ring"><CreditCard size={19} /></div><strong>Sem despesas por aqui</strong><span>Os gastos do mês aparecerão nesta lista.</span></div> : (
            <div className="category-list">{topCategories.map(([name, value], index) => {
              const colors = ['#67dfaa', '#6e9cff', '#b48cff', '#f4b85d', '#ef7d7d']
              const max = topCategories[0][1]
              return <div className="category-row" key={name}><span className="category-color" style={{ background: colors[index] }} /><div className="category-detail"><div><strong>{name}</strong><span>{Math.round((value / expense) * 100)}%</span></div><div className="progress-track"><span style={{ width: `${(value / max) * 100}%`, background: colors[index] }} /></div></div><strong className="category-value">{money(value)}</strong></div>
            })}</div>
          )}
          <button className="panel-footer-link" onClick={() => onNavigate('reports')}>Ver relatório completo <ArrowUpRight size={14} /></button>
        </section>
      </div>

      <UpcomingObligations debts={debts} bills={bills} reminderDays={reminderDays} now={now} onPay={onPay} onNavigate={onNavigate} />

      <section className="panel activity-panel">
        <div className="panel-heading"><div><h2>Atividade recente</h2><p>Suas últimas movimentações</p></div><button className="text-button" onClick={() => onNavigate('transactions')}>Ver todas <ArrowUpRight size={14} /></button></div>
        {recent.length === 0 ? <div className="table-empty"><div className="empty-ring"><ArrowLeftRight size={19} /></div><strong>Nenhum lançamento ainda</strong><span>Suas movimentações vão aparecer aqui.</span><button className="button button-secondary" onClick={onAdd}><Plus size={15} /> Adicionar lançamento</button></div> : <TransactionTable transactions={recent} accounts={data.accounts} onEdit={onEdit} onDelete={() => {}} compact />}
      </section>
      <p className="data-disclaimer"><CircleHelp size={14} /> Esta é uma visão baseada somente nos registros que você adicionou. Não há integração bancária ou cotações automáticas.</p>
    </>
  )
}

function UpcomingObligations({ debts, bills, reminderDays, now, onPay, onNavigate }: {
  debts: Debt[]
  bills: Bill[]
  reminderDays: number[]
  now: Date
  onPay: (target: PaymentTarget) => void
  onNavigate: (page: Page) => void
}) {
  const horizon = dateToString(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30))
  const allItems: CalendarObligation[] = [
    ...debts.flatMap((debt) => debt.installments
      .filter((installment) => installment.dueDate <= horizon && installmentRemaining(installment) > 0)
      .map((installment) => {
        const remainingCents = installmentRemaining(installment)
        return {
          key: `debt-${debt.id}-${installment.number}`,
          title: debt.name,
          subtitle: `Parcela ${installment.number}/${debt.installmentCount}`,
          date: installment.dueDate,
          amountCents: installment.amountCents,
          remainingCents,
          status: installmentStatus(installment),
          target: {
            kind: 'debt' as const,
            debtId: debt.id,
            installmentNumber: installment.number,
            label: `${debt.name} · parcela ${installment.number}/${debt.installmentCount}`,
            remainingCents,
          },
        }
      })),
    ...bills.flatMap((bill) => [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 1)]
      .flatMap((month) => billOccurrenceDates(bill, month))
      .filter((date) => date <= horizon && occurrenceRemaining(bill, date) > 0)
      .map((date) => {
        const remainingCents = occurrenceRemaining(bill, date)
        return {
          key: `bill-${bill.id}-${date}`,
          title: bill.name,
          subtitle: bill.category,
          date,
          amountCents: bill.occurrences.find((occurrence) => occurrence.date === date)?.amountCents ?? bill.amountCents,
          remainingCents,
          status: occurrenceStatus(bill, date),
          target: { kind: 'bill' as const, billId: bill.id, date, label: bill.name, remainingCents, preferredAccountId: bill.accountId },
        }
      })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'))
  const today = dateToString(now)
  const dayNumber = (date: string) => {
    const [year, month, day] = date.split('-').map(Number)
    return Date.UTC(year, month - 1, day) / 86_400_000
  }
  const reminders = allItems.filter((item) => {
    const daysUntil = dayNumber(item.date) - dayNumber(today)
    return daysUntil >= 0 && reminderDays.includes(daysUntil)
  })
  const items = allItems.slice(0, 5)

  return <section className="panel dashboard-obligations">
    <div className="panel-heading"><div><h2>Próximos vencimentos</h2><p>Parcelas e contas pendentes nos próximos 30 dias</p></div><button className="text-button" onClick={() => onNavigate('obligations')}>Ver obrigações <ArrowUpRight size={14} /></button></div>
    {reminders.length > 0 && <div className="dashboard-reminders" role="status"><CircleHelp size={15} /><span><strong>{reminders.length === 1 ? 'Lembrete de vencimento' : `${reminders.length} lembretes de vencimento`}</strong>{reminders.slice(0, 3).map((item) => {
      const daysUntil = dayNumber(item.date) - dayNumber(today)
      const dueLabel = daysUntil === 0 ? 'vence hoje' : `vence em ${daysUntil} dia${daysUntil === 1 ? '' : 's'}`
      return <small key={item.key}>{item.title} · {dueLabel}</small>
    })}</span><button className="text-button" onClick={() => onNavigate('obligations')}>Ver <ArrowUpRight size={13} /></button></div>}
    {items.length === 0
      ? <div className="compact-empty"><div className="empty-ring"><CalendarDays size={18} /></div><strong>Nenhum vencimento próximo</strong><span>As parcelas e contas pendentes aparecerão aqui.</span></div>
      : <div className="dashboard-obligation-list">{items.map((item) => <article className="dashboard-obligation-row" key={item.key}>
        <span className="monthly-date"><strong>{dateLabel(item.date, { day: '2-digit' })}</strong><small>{dateLabel(item.date, { month: 'short' })}</small></span>
        <span className="monthly-item-info"><strong>{item.title}</strong><small>{item.subtitle} · {statusLabel(item.status)}</small></span>
        <span className="dashboard-obligation-value"><strong>{money(item.remainingCents)}</strong></span>
        <button className="button button-secondary monthly-pay" onClick={() => onPay(item.target!)}><Banknote size={14} /> Pagar</button>
      </article>)}</div>}
  </section>
}

function SummaryCard({ icon: Icon, label, value, note, tone }: { icon: typeof Wallet; label: string; value: string; note: string; tone: string }) {
  return <article className={`summary-card ${tone}`}><div className="summary-top"><span>{label}</span><span className="summary-icon"><Icon size={17} /></span></div><strong className="summary-value">{value}</strong><span className="summary-note">{note}</span></article>
}

function EmptyChart({ onClick }: { onClick: () => void }) {
  return <div className="chart-empty"><div className="chart-lines"><span /><span /><span /><span /></div><div className="chart-empty-content"><div className="empty-ring"><TrendingUp size={19} /></div><strong>Sem dados para exibir</strong><span>Registre receitas e despesas para visualizar seu fluxo.</span><button className="text-button" onClick={onClick}>Adicionar lançamento <ArrowUpRight size={14} /></button></div></div>
}

function CashflowChart({ transactions }: { transactions: Transaction[] }) {
  const labels = ['1ª sem.', '2ª sem.', '3ª sem.', '4ª sem.']
  const weekTotals = labels.map((_, index) => transactions.reduce((total, transaction) => {
    const week = Math.min(3, Math.floor((Number(transaction.date.slice(8, 10)) - 1) / 7))
    if (week !== index) return total
    if (transaction.type === 'income' || transaction.type === 'expense') total[transaction.type] += transaction.amountCents
    return total
  }, { income: 0, expense: 0 }))
  const maxAmount = Math.max(...weekTotals.flatMap((week) => [week.income, week.expense]), 1)
  const bars = weekTotals.flatMap((week, index) => {
    const x = 33 + index * 108
    const incomeHeight = Math.max(week.income > 0 ? 4 : 0, (week.income / maxAmount) * 88)
    const expenseHeight = Math.max(week.expense > 0 ? 4 : 0, (week.expense / maxAmount) * 88)
    return [
      <rect key={`${labels[index]}-income`} x={x} y={140 - incomeHeight} width="15" height={incomeHeight} rx="4" fill="url(#incomeGradient)" />,
      <rect key={`${labels[index]}-expense`} x={x + 19} y={140 - expenseHeight} width="15" height={expenseHeight} rx="4" fill="url(#expenseGradient)" />,
    ]
  })
  return <div className="cashflow-chart"><svg viewBox="0 0 470 182" role="img" aria-label="Receitas e despesas por semana no mês atual"><defs><linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#69dfa8" stopOpacity=".95" /><stop offset="1" stopColor="#69dfa8" stopOpacity=".3" /></linearGradient><linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1"><stop stopColor="#f08080" stopOpacity=".9" /><stop offset="1" stopColor="#f08080" stopOpacity=".28" /></linearGradient></defs>{[28, 65, 102, 140].map((y) => <line key={y} x1="15" x2="455" y1={y} y2={y} className="chart-grid-line" />)}{bars}{labels.map((label, index) => <text key={label} x={30 + index * 108} y="169" className="chart-label">{label}</text>)}</svg></div>
}

function TransactionsPage({
  transactions, accounts, query, onQueryChange, typeFilter, onTypeFilterChange, onAdd, onEdit, onDelete,
}: {
  transactions: Transaction[]
  accounts: Account[]
  query: string
  onQueryChange: (value: string) => void
  typeFilter: 'all' | TransactionType
  onTypeFilterChange: (value: 'all' | TransactionType) => void
  onAdd: () => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
}) {
  return (
    <section className="panel list-panel">
      <div className="list-toolbar">
        <label className="search-field"><Search size={16} /><input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Buscar por descrição ou categoria" /></label>
        <div className="toolbar-actions"><label className="filter-select"><ListFilter size={15} /><select value={typeFilter} onChange={(event) => onTypeFilterChange(event.target.value as 'all' | TransactionType)} aria-label="Filtrar por tipo"><option value="all">Todos os tipos</option><option value="income">Receitas</option><option value="expense">Despesas</option><option value="transfer-in">Transferências recebidas</option><option value="transfer-out">Transferências enviadas</option></select><ChevronDown size={14} /></label><button className="icon-button" title="Limpar busca e filtros" aria-label="Limpar busca e filtros" onClick={() => { onQueryChange(''); onTypeFilterChange('all') }}><SlidersHorizontal size={16} /></button></div>
      </div>
      <div className="transaction-table-header"><span>DESCRIÇÃO</span><span>CATEGORIA</span><span>DATA</span><span>CONTA</span><span>VALOR</span><span /></div>
      {transactions.length === 0 ? <div className="table-empty"><div className="empty-ring"><Search size={19} /></div><strong>Nenhum lançamento encontrado</strong><span>{query || typeFilter !== 'all' ? 'Tente ajustar a busca ou os filtros.' : 'Comece registrando uma receita ou despesa.'}</span>{!query && typeFilter === 'all' && <button className="button button-primary" onClick={onAdd}><Plus size={15} /> Novo lançamento</button>}</div> : <TransactionTable transactions={transactions} accounts={accounts} onEdit={onEdit} onDelete={onDelete} />}
      <div className="table-bottom"><span>Mostrando <strong>{transactions.length}</strong> {transactions.length === 1 ? 'lançamento' : 'lançamentos'}</span><button className="pagination-button" disabled><ChevronLeft size={15} /></button><button className="pagination-button current-page">1</button><button className="pagination-button" disabled><ChevronRight size={15} /></button></div>
    </section>
  )
}

function TransactionTable({ transactions, accounts, onEdit, onDelete, compact = false }: { transactions: Transaction[]; accounts: Account[]; onEdit: (transaction: Transaction) => void; onDelete: (transaction: Transaction) => void; compact?: boolean }) {
  return <div className={`transaction-rows ${compact ? 'compact-rows' : ''}`}>{transactions.map((transaction) => {
    const internalTransfer = transaction.type === 'transfer-in' || transaction.type === 'transfer-out'
    const incoming = transaction.type === 'income' || transaction.type === 'transfer-in'
    const linked = Boolean(transaction.sourcePaymentId || transaction.sourceGoalMovementId)
    const Icon = internalTransfer ? ArrowLeftRight : incoming ? ArrowDownLeft : ArrowUpRight
    const account = accounts.find((item) => item.id === transaction.accountId)
    return <div className="transaction-row" key={transaction.id}>
      {linked
        ? <span className={`transaction-symbol ${internalTransfer ? 'transfer-symbol' : incoming ? 'income-symbol' : 'expense-symbol'}`} aria-hidden="true"><Icon size={16} /></span>
        : <button className={`transaction-symbol ${internalTransfer ? 'transfer-symbol' : incoming ? 'income-symbol' : 'expense-symbol'}`} onClick={() => onEdit(transaction)} aria-label={`Editar ${transaction.description}`}><Icon size={16} /></button>}
      {linked
        ? <span className="transaction-description"><strong>{transaction.description}</strong><span>{transaction.sourceGoalMovementId ? 'Movimentação vinculada a objetivo' : 'Pagamento vinculado'}</span></span>
        : <button className="transaction-description" onClick={() => onEdit(transaction)}><strong>{transaction.description}</strong><span>{internalTransfer ? 'Transferência interna' : incoming ? 'Receita' : 'Despesa'}</span></button>}
      <span className="transaction-category"><i className={`category-mini ${internalTransfer ? 'transfer-mini' : incoming ? 'income-mini' : 'expense-mini'}`} />{transaction.category}</span>
      <span className="transaction-date">{dateLabel(transaction.date)}</span>
      <span className="transaction-account">{account?.name ?? '—'}</span>
      <strong className={`transaction-amount ${incoming ? 'positive' : internalTransfer ? 'transfer-amount' : ''}`}>{incoming ? '+' : '−'}{money(transaction.amountCents)}</strong>
      <div className="row-actions">
        {!linked && <button className="icon-button small-icon" onClick={() => onEdit(transaction)} title="Editar"><Ellipsis size={17} /></button>}
        {!compact && <button
          className="icon-button small-icon delete-row"
          onClick={() => onDelete(transaction)}
          title={transaction.sourcePaymentId ? 'Excluir pagamento e atualizar obrigação' : 'Excluir lançamento'}
          aria-label={transaction.sourcePaymentId ? `Excluir pagamento de ${transaction.description}` : `Excluir lançamento ${transaction.description}`}
        ><Trash2 size={15} /></button>}
      </div>
    </div>
  })}</div>
}

function AccountsPage({ accounts, transactions, onAdd, onDelete }: { accounts: Account[]; transactions: Transaction[]; onAdd: () => void; onDelete: (account: Account) => void }) {
  return (
    <>
      <div className="account-summary panel"><div><span>Saldo consolidado</span><strong>{money(accounts.reduce((total, account) => total + accountBalance(account, transactions), 0))}</strong><small>Soma dos saldos iniciais e lançamentos vinculados</small></div><div className="account-summary-icon"><Banknote size={22} /></div></div>
      <div className="section-title-row"><div><h2>Bancos cadastrados</h2><p>Os saldos são atualizados conforme os lançamentos.</p></div><button className="button button-secondary" onClick={onAdd}><Plus size={15} /> Adicionar banco</button></div>
      {accounts.length === 0 ? <div className="panel table-empty accounts-empty"><div className="empty-ring"><Wallet size={19} /></div><strong>Nenhum banco cadastrado</strong><span>Adicione seus bancos para acompanhar os saldos consolidados.</span><button className="button button-primary" onClick={onAdd}><Plus size={15} /> Adicionar banco</button></div> : (
        <div className="account-grid">{accounts.map((account) => {
          const typeLabel = accountTypes.find((type) => type.value === account.type)?.label ?? 'Conta'
          const count = transactions.filter((item) => item.accountId === account.id).length
          return <article className="account-card panel" key={account.id}><div className="account-card-top"><span className="account-icon" style={{ color: account.color, background: `${account.color}19` }}><Wallet size={19} /></span><button className="icon-button small-icon" onClick={() => onDelete(account)} title="Remover conta"><Trash2 size={15} /></button></div><span className="account-type">{typeLabel}</span><h3>{account.name}</h3><strong className="account-balance">{money(accountBalance(account, transactions))}</strong><div className="account-card-bottom"><span>Saldo inicial: {money(account.openingBalanceCents)}</span><span>{count} {count === 1 ? 'lançamento' : 'lançamentos'}</span></div></article>
        })}</div>
      )}
      <p className="data-disclaimer"><CircleHelp size={14} /> Transferências entre contas ainda não são suportadas nesta versão. Para evitar distorções, registre somente entradas e saídas reais.</p>
    </>
  )
}

function debtTotals(debt: Debt) {
  const scheduled = debt.installments.reduce((sum, installment) => sum + installment.amountCents, 0)
  const payments = debt.installments.reduce((sum, installment) => sum + paymentTotal(installment.payments), 0)
  const totalContracted = debt.downPaymentCents + scheduled
  const totalPaid = Math.min(totalContracted, debt.downPaymentCents + payments)
  const remaining = Math.max(0, totalContracted - totalPaid)
  const unpaidInstallments = debt.installments.filter((installment) => installmentRemaining(installment) > 0)
  const next = unpaidInstallments.filter((installment) => installment.dueDate >= todayString()).sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0]
  return {
    totalContracted,
    totalPaid,
    remaining,
    progress: totalContracted > 0 ? Math.min(100, Math.round((totalPaid / totalContracted) * 100)) : 0,
    paidCount: debt.installments.filter((installment) => installmentRemaining(installment) === 0).length,
    openCount: unpaidInstallments.length,
    overdueCount: unpaidInstallments.filter((installment) => baseStatus(installmentStatus(installment)) === 'overdue').length,
    dueSoonCount: unpaidInstallments.filter((installment) => ['today', 'soon'].includes(baseStatus(installmentStatus(installment)))).length,
    next,
  }
}

function baseStatus(status: string) {
  return status.startsWith('partial-') ? status.slice('partial-'.length) : status
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    paid: 'Paga',
    overdue: 'Atrasada',
    today: 'Vence hoje',
    soon: 'Vence em breve',
    upcoming: 'Agendada',
    partial: 'Parcial',
  }
  if (status.startsWith('partial-')) return `Parcial · ${labels[baseStatus(status)]?.toLocaleLowerCase('pt-BR') ?? 'pendente'}`
  return labels[status] ?? status
}

function statusClass(status: string) {
  return `status-pill status-${status} status-${baseStatus(status)}`
}

function ObligationsPage({
  debts, bills, now, onAddDebt, onEditDebt, onAddBill, onEditBill, onPay, onDeleteDebt, onDeleteBill,
}: {
  debts: Debt[]
  bills: Bill[]
  now: Date
  onAddDebt: () => void
  onEditDebt: (debt: Debt) => void
  onAddBill: () => void
  onEditBill: (bill: Bill) => void
  onPay: (target: PaymentTarget) => void
  onDeleteDebt: (debt: Debt) => void
  onDeleteBill: (bill: Bill) => void
}) {
  const [tab, setTab] = useState<'debts' | 'bills' | 'monthly'>('debts')
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null)
  const [debtFilter, setDebtFilter] = useState('all')
  const [debtTypeFilter, setDebtTypeFilter] = useState('all')
  const [debtSort, setDebtSort] = useState('next-due')
  const [search, setSearch] = useState('')
  const [selectedMonth, setSelectedMonth] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const debt = debts.find((item) => item.id === selectedDebtId) ?? null
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(selectedMonth)
  const month = monthKey(selectedMonth)
  const monthlyItems: {
    key: string
    title: string
    subtitle: string
    date: string
    amountCents: number
    remainingCents: number
    status: string
    target: PaymentTarget | null
  }[] = []
  for (const item of debts) {
    for (const installment of item.installments) {
      if (installment.dueDate.slice(0, 7) !== month) continue
      const remainingCents = installmentRemaining(installment)
      monthlyItems.push({
        key: `${item.id}-${installment.number}`,
        title: item.name,
        subtitle: `${debtTypes.find((type) => type.value === item.type)?.label ?? 'Dívida'} · Parcela ${String(installment.number).padStart(2, '0')}/${item.installmentCount}`,
        date: installment.dueDate,
        amountCents: installment.amountCents,
        remainingCents,
        status: installmentStatus(installment),
        target: remainingCents > 0 ? { kind: 'debt', debtId: item.id, installmentNumber: installment.number, label: `${item.name} · parcela ${installment.number}/${item.installmentCount}`, remainingCents } : null,
      })
    }
  }
  for (const bill of bills) {
    for (const date of billOccurrenceDates(bill, selectedMonth)) {
      const remainingCents = occurrenceRemaining(bill, date)
      monthlyItems.push({
        key: `${bill.id}-${date}`,
        title: bill.name,
        subtitle: `${bill.category} · ${frequencyLabel(bill.frequency)}`,
        date,
        amountCents: bill.occurrences.find((occurrence) => occurrence.date === date)?.amountCents ?? bill.amountCents,
        remainingCents,
        status: occurrenceStatus(bill, date),
        target: remainingCents > 0 ? { kind: 'bill', billId: bill.id, date, label: bill.name, remainingCents, preferredAccountId: bill.accountId } : null,
      })
    }
  }
  monthlyItems.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, 'pt-BR'))
  const monthlyPaid = monthlyItems.reduce((sum, item) => sum + item.amountCents - item.remainingCents, 0)
  const monthlyPending = monthlyItems.reduce((sum, item) => sum + (baseStatus(item.status) === 'overdue' ? 0 : item.remainingCents), 0)
  const monthlyOverdue = monthlyItems.reduce((sum, item) => sum + (baseStatus(item.status) === 'overdue' ? item.remainingCents : 0), 0)
  const allInstallments = debts.flatMap((item) => item.installments.map((installment) => ({ debt: item, installment })))
  const overdueInstallments = allInstallments.filter(({ installment }) => baseStatus(installmentStatus(installment)) === 'overdue')
  const soonInstallments = allInstallments.filter(({ installment }) => ['today', 'soon'].includes(baseStatus(installmentStatus(installment))))
  const overdueBillRecords = bills.filter((bill) => bill.overdueRecord)
  const overdueBillBalance = (bill: Bill) => occurrenceRemaining(bill, bill.startDate)
  const unpaidOverdueBillRecords = overdueBillRecords.filter((bill) => overdueBillBalance(bill) > 0)
  const paidOverdueBillRecords = overdueBillRecords.filter((bill) => overdueBillBalance(bill) === 0)
  const unpaidInstallmentCount = allInstallments.filter(({ installment }) => installmentRemaining(installment) > 0).length
  const openInstallmentCount = unpaidInstallmentCount + unpaidOverdueBillRecords.length
  const paidInstallmentCount = allInstallments.length - unpaidInstallmentCount + paidOverdueBillRecords.length
  const totalOriginal = debts.reduce((sum, item) => sum + item.originalAmountCents, 0)
    + overdueBillRecords.reduce((sum, bill) => sum + bill.amountCents, 0)
  const totalDebt = debts.reduce((sum, item) => sum + debtTotals(item).remaining, 0)
    + overdueBillRecords.reduce((sum, bill) => sum + overdueBillBalance(bill), 0)
  const totalPaid = debts.reduce((sum, item) => sum + debtTotals(item).totalPaid, 0)
    + overdueBillRecords.reduce((sum, bill) => sum + paymentTotal(getBillOccurrence(bill, bill.startDate)?.payments ?? []), 0)
  const overdueDebtCount = new Set(overdueInstallments.map(({ debt }) => debt.id)).size
  const allOverdueCount = overdueDebtCount + unpaidOverdueBillRecords.length
  const monthlyCommitment = debts.reduce((sum, item) => sum + item.installments.filter((installment) => installment.dueDate.slice(0, 7) === monthKey(now)).reduce((value, installment) => value + installmentRemaining(installment), 0), 0)
    + bills.reduce((sum, bill) => sum + billOccurrenceDates(bill, new Date(now.getFullYear(), now.getMonth(), 1)).reduce((value, date) => value + occurrenceRemaining(bill, date), 0), 0)
  const filteredDebts = debts.filter((item) => {
    const totals = debtTotals(item)
    const matchesSearch = !search || `${item.name} ${item.creditor} ${item.description}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
    const matchesType = debtTypeFilter === 'all' || item.type === debtTypeFilter
    const matchesFilter = debtFilter === 'all'
      || (debtFilter === 'overdue' && totals.overdueCount > 0)
      || (debtFilter === 'soon' && totals.dueSoonCount > 0)
      || (debtFilter === 'settled' && totals.remaining === 0)
      || (debtFilter === 'active' && totals.remaining > 0 && totals.overdueCount === 0)
      || (debtFilter === 'single' && item.installmentCount === 1)
      || (debtFilter === 'installments' && item.installmentCount > 1)
    return matchesSearch && matchesType && matchesFilter
  }).sort((a, b) => {
    if (debtSort === 'balance-desc') return debtTotals(b).remaining - debtTotals(a).remaining
    if (debtSort === 'balance-asc') return debtTotals(a).remaining - debtTotals(b).remaining
    if (debtSort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    const aNext = debtTotals(a).next?.dueDate ?? '9999-12-31'
    const bNext = debtTotals(b).next?.dueDate ?? '9999-12-31'
    return debtSort === 'next-due' ? aNext.localeCompare(bNext) : b.startDate.localeCompare(a.startDate)
  })
  const filteredOverdueBills = overdueBillRecords.filter((bill) => {
    const remaining = overdueBillBalance(bill)
    const matchesSearch = !search || `${bill.name} ${bill.category} ${bill.notes}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
    const matchesType = debtTypeFilter === 'all'
    const matchesFilter = debtFilter === 'all'
      || (debtFilter === 'overdue' && remaining > 0)
      || (debtFilter === 'settled' && remaining === 0)
      || debtFilter === 'single'
    return matchesSearch && matchesType && matchesFilter
  }).sort((a, b) => {
    if (debtSort === 'balance-desc') return overdueBillBalance(b) - overdueBillBalance(a)
    if (debtSort === 'balance-asc') return overdueBillBalance(a) - overdueBillBalance(b)
    if (debtSort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    return debtSort === 'next-due' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)
  })

  if (debt) {
    const ordered = [...debt.installments].sort((a, b) => a.number - b.number)
    return <DebtDetail debt={debt} installments={ordered} onBack={() => setSelectedDebtId(null)} onEdit={() => onEditDebt(debt)} onDelete={() => onDeleteDebt(debt)} onPay={(installment) => onPay({ kind: 'debt', debtId: debt.id, installmentNumber: installment.number, label: `${debt.name} · parcela ${installment.number}/${debt.installmentCount}`, remainingCents: installmentRemaining(installment) })} />
  }

  return <>
    <div className="obligation-tabs" role="tablist" aria-label="Seções de obrigações">
      <button role="tab" aria-selected={tab === 'debts'} className={tab === 'debts' ? 'active' : ''} onClick={() => setTab('debts')}>Dívidas e empréstimos</button>
      <button role="tab" aria-selected={tab === 'bills'} className={tab === 'bills' ? 'active' : ''} onClick={() => setTab('bills')}>Contas e cobranças</button>
      <button role="tab" aria-selected={tab === 'monthly'} className={tab === 'monthly' ? 'active' : ''} onClick={() => setTab('monthly')}>Compromisso mensal</button>
    </div>
    {tab === 'debts' && <>
      <div className="debt-stats">
        <SummaryCard icon={CreditCard} label="Dívidas cadastradas" value={String(debts.length + overdueBillRecords.length)} note={`${allInstallments.length + overdueBillRecords.length} parcelas e cobranças no histórico`} tone="blue" />
        <SummaryCard icon={Banknote} label="Valor original" value={money(totalOriginal)} note="Valores informados nos contratos" tone="violet" />
        <SummaryCard icon={ArrowUpRight} label="Saldo devedor" value={money(totalDebt)} note={`${totalPaid ? money(totalPaid) : 'R$ 0,00'} pagos em contratos e dívidas atrasadas`} tone="red" />
        <SummaryCard icon={CalendarDays} label="Comprometido neste mês" value={money(monthlyCommitment)} note={`${soonInstallments.length} parcelas vencem em até 7 dias`} tone="green" />
      </div>
      <div className="installment-indicators" aria-label="Indicadores de parcelas">
        <div><span>Parcelas em aberto</span><strong>{openInstallmentCount}</strong></div>
        <div><span>Parcelas quitadas</span><strong>{paidInstallmentCount}</strong></div>
        <div className="indicator-overdue"><span>Contas atrasadas</span><strong>{allOverdueCount}</strong></div>
        <div className="indicator-soon"><span>Vencem em até 7 dias</span><strong>{soonInstallments.length}</strong></div>
      </div>
      {(allOverdueCount > 0 || soonInstallments.length > 0) && <div className={`obligation-alert ${allOverdueCount ? 'alert-overdue' : ''}`}><CircleHelp size={17} /><span>{allOverdueCount > 0 ? `${allOverdueCount} conta${allOverdueCount === 1 ? '' : 's'} atrasada${allOverdueCount === 1 ? '' : 's'}` : `${soonInstallments.length} parcela${soonInstallments.length === 1 ? '' : 's'} vence${soonInstallments.length === 1 ? '' : 'm'} nos próximos 7 dias`}. Confira os vencimentos e atualize os pagamentos.</span><button className="text-button" onClick={() => { setTab('monthly'); setSelectedMonth(new Date(now.getFullYear(), now.getMonth(), 1)) }}>Ver agenda <ArrowUpRight size={14} /></button></div>}
      <div className="panel obligation-list-panel">
        <div className="obligation-list-toolbar"><div><h2>Suas dívidas</h2><p>Dívidas em atraso e contratos parcelados ficam reunidos nesta lista.</p></div><button className="button button-primary" onClick={onAddDebt}><Plus size={16} /> Nova dívida</button></div>
        <div className="obligation-controls obligation-controls-expanded"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por dívida, instituição ou descrição" /></label><label className="filter-select"><ListFilter size={14} /><select value={debtFilter} onChange={(event) => setDebtFilter(event.target.value)} aria-label="Filtrar dívidas"><option value="all">Todos os status</option><option value="active">Em dia</option><option value="overdue">Atrasadas</option><option value="soon">Próximos vencimentos</option><option value="settled">Quitadas</option><option value="single">Valor único</option><option value="installments">Parceladas</option></select><ChevronDown size={13} /></label><label className="filter-select"><select value={debtTypeFilter} onChange={(event) => setDebtTypeFilter(event.target.value)} aria-label="Filtrar por tipo"><option value="all">Todos os tipos</option>{debtTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={debtSort} onChange={(event) => setDebtSort(event.target.value)} aria-label="Ordenar dívidas"><option value="next-due">Próximo vencimento</option><option value="balance-desc">Maior saldo</option><option value="balance-asc">Menor saldo</option><option value="name">Nome A–Z</option><option value="recent">Mais recentes</option></select><ChevronDown size={13} /></label></div>
        {filteredDebts.length + filteredOverdueBills.length === 0 ? <div className="table-empty"><div className="empty-ring"><CreditCard size={19} /></div><strong>{debts.length + overdueBillRecords.length ? 'Nenhuma dívida encontrada' : 'Nenhuma dívida cadastrada'}</strong><span>{debts.length + overdueBillRecords.length ? 'Altere os filtros ou a busca.' : 'Cadastre uma dívida para gerar e acompanhar suas parcelas.'}</span>{debts.length + overdueBillRecords.length === 0 && <button className="button button-primary" onClick={onAddDebt}><Plus size={15} /> Cadastrar dívida</button>}</div> : <div className="debt-card-list">{filteredOverdueBills.map((bill) => {
          const remaining = overdueBillBalance(bill)
          const paid = paymentTotal(getBillOccurrence(bill, bill.startDate)?.payments ?? [])
          const paymentTarget = remaining > 0 ? { kind: 'bill' as const, billId: bill.id, date: bill.startDate, label: bill.name, remainingCents: remaining, preferredAccountId: bill.accountId } : null
          return <article className={`bill-card debt-overdue-list-card ${remaining > 0 ? 'bill-card-overdue' : 'bill-card-settled'}`} key={bill.id}>
            <span className={`bill-icon ${remaining > 0 ? 'bill-icon-overdue' : 'bill-icon-settled'}`}>{remaining > 0 ? <CircleAlert size={17} /> : <Check size={17} />}</span>
            <div className="bill-main"><strong>{bill.name}</strong><span>{bill.category} · Dívida atrasada</span><small>{bill.notes || `Valor original ${money(bill.amountCents)}${paid ? ` · Pago ${money(paid)}` : ''}`}</small></div>
            <div className="bill-next"><span>Venceu em</span><strong>{dateLabel(bill.startDate)}</strong></div>
            <div className="bill-amount"><strong>{money(remaining)}</strong><span className={remaining > 0 ? 'bill-overdue-label' : 'bill-settled-label'}>{remaining > 0 ? <><CircleAlert size={12} /> ATRASADA</> : 'QUITADA'}</span></div>
            <div className="bill-actions"><button className="icon-button small-icon" onClick={() => onEditBill(bill)} title="Editar dívida" aria-label={`Editar ${bill.name}`}><Ellipsis size={17} /></button><button className="icon-button small-icon" onClick={() => onDeleteBill(bill)} title="Excluir dívida" aria-label={`Excluir ${bill.name}`}><Trash2 size={15} /></button></div>
            {paymentTarget && <button className="button button-secondary bill-pay" onClick={() => onPay(paymentTarget)}><Banknote size={14} /> Registrar pagamento</button>}
          </article>
        })}{filteredDebts.map((item) => {
          const totals = debtTotals(item)
          const nextInstallment = totals.next
          const typeLabel = debtTypes.find((type) => type.value === item.type)?.label ?? 'Dívida'
          return <article className="debt-card" key={item.id}>
            <button className="debt-card-main" onClick={() => setSelectedDebtId(item.id)}>
              <span className="debt-card-icon"><CreditCard size={18} /></span>
              <span className="debt-card-copy"><strong>{item.name}</strong><small>{typeLabel}{item.creditor ? ` · ${item.creditor}` : ''}</small><span className="debt-progress"><i style={{ width: `${totals.progress}%` }} /></span><small>{item.installmentCount === 1 ? `Valor único · ${totals.paidCount ? 'pago' : 'pendente'}` : `${totals.paidCount} de ${item.installmentCount} parcelas quitadas`}</small></span>
              <span className="debt-card-amount"><strong>{money(totals.remaining)}</strong><small>saldo devedor</small></span>
              <span className={`debt-status ${totals.remaining === 0 ? 'status-paid' : totals.overdueCount ? 'status-overdue' : totals.dueSoonCount ? 'status-soon' : 'status-upcoming'}`}>{totals.remaining === 0 ? 'Quitada' : totals.overdueCount ? `${totals.overdueCount} atrasada${totals.overdueCount > 1 ? 's' : ''}` : nextInstallment ? `Próx. ${dateLabel(nextInstallment.dueDate, { day: '2-digit', month: 'short' })}` : 'Em dia'}</span>
              <ChevronRight className="debt-card-chevron" size={17} />
            </button>
            <button className="debt-card-edit" onClick={() => onEditDebt(item)} aria-label={`Editar ${item.name}`} title="Editar contrato"><Ellipsis size={17} /></button>
          </article>
        })}</div>}
      </div>
      <BillsSection bills={bills} now={now} onAdd={onAddBill} onEdit={onEditBill} onDelete={onDeleteBill} onPay={onPay} embedded />
    </>}
    {tab === 'bills' && <BillsSection bills={bills} now={now} onAdd={onAddBill} onEdit={onEditBill} onDelete={onDeleteBill} onPay={onPay} />}
    {tab === 'monthly' && <MonthlyCommitments month={selectedMonth} monthLabel={monthLabel} items={monthlyItems} paid={monthlyPaid} pending={monthlyPending} overdue={monthlyOverdue} onChangeMonth={(offset) => setSelectedMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))} onPay={onPay} onGoBills={() => setTab('bills')} />}
    <p className="data-disclaimer"><CircleHelp size={14} /> Valores e vencimentos são calculados localmente com base nos dados cadastrados; juros, descontos e condições de contrato devem ser confirmados com o credor.</p>
  </>
}

function frequencyLabel(frequency: BillFrequency) {
  const labels: Record<BillFrequency, string> = { once: 'Valor único', weekly: 'Semanal', monthly: 'Mensal', quarterly: 'Trimestral', yearly: 'Anual' }
  return labels[frequency]
}

function DebtDetail({ debt, installments, onBack, onEdit, onDelete, onPay }: {
  debt: Debt
  installments: Installment[]
  onBack: () => void
  onEdit: () => void
  onDelete: () => void
  onPay: (installment: Installment) => void
}) {
  const totals = debtTotals(debt)
  const typeLabel = debtTypes.find((type) => type.value === debt.type)?.label ?? 'Dívida'
  return <div className="debt-detail">
    <button className="text-button debt-back" onClick={onBack}><ChevronLeft size={16} /> Voltar para dívidas</button>
    <section className="panel debt-detail-hero">
      <div className="debt-detail-top"><span className="debt-card-icon"><CreditCard size={19} /></span><div className="debt-detail-title"><span className="eyebrow">{typeLabel}</span><h2>{debt.name}</h2><p>{debt.creditor || 'Credor não informado'}{debt.description ? ` · ${debt.description}` : ''}</p></div><div className="debt-detail-actions"><button className="button button-secondary" onClick={onEdit}><Ellipsis size={15} /> Editar contrato</button><button className="icon-button" onClick={onDelete} aria-label="Excluir dívida" title="Excluir dívida"><Trash2 size={16} /></button></div></div>
      <div className="debt-progress-large"><div><span>Progresso de quitação</span><strong>{totals.progress}%</strong></div><span className="debt-progress"><i style={{ width: `${totals.progress}%` }} /></span></div>
      <div className="debt-detail-stats"><div><span>Saldo devedor</span><strong>{money(totals.remaining)}</strong></div><div><span>Total pago</span><strong className="positive">{money(totals.totalPaid)}</strong></div><div><span>Valor contratado</span><strong>{money(totals.totalContracted)}</strong></div><div><span>Parcelas restantes</span><strong>{totals.openCount}</strong></div><div><span>Próximo vencimento</span><strong>{totals.next ? dateLabel(totals.next.dueDate) : 'Nenhum'}</strong></div></div>
      <div className="debt-contract-note"><span>Valor original: {money(debt.originalAmountCents)}</span>{debt.receivedAmountCents !== undefined && <span>Valor recebido: {money(debt.receivedAmountCents)}</span>}<span>{debt.installmentCount === 1 ? `Valor único: ${money(debt.installmentAmountCents)}` : `Parcelas: ${money(debt.installmentAmountCents)} × ${debt.installmentCount}`}</span>{debt.monthlyInterestBps ? <span>Juros informados: {(debt.monthlyInterestBps / 100).toLocaleString('pt-BR')}% ao mês</span> : null}{debt.annualInterestBps ? <span>Taxa anual informada: {(debt.annualInterestBps / 100).toLocaleString('pt-BR')}%</span> : null}{debt.cetBps ? <span>CET informado: {(debt.cetBps / 100).toLocaleString('pt-BR')}% ao ano</span> : null}<span>Entrada informada: {money(debt.downPaymentCents)}</span></div>
      {debt.notes && <p className="debt-notes">{debt.notes}</p>}
    </section>
    <section className="panel installment-panel"><div className="obligation-list-toolbar"><div><h2>{debt.installmentCount === 1 ? 'Cobrança e pagamentos' : 'Parcelas e pagamentos'}</h2><p>Selecione para registrar pagamento integral ou parcial.</p></div><span className="installment-count">{installments.length} {debt.installmentCount === 1 ? 'cobrança' : 'parcelas'}</span></div>
      <div className="installment-list">{installments.map((installment) => {
        const remaining = installmentRemaining(installment)
        const status = installmentStatus(installment)
        const paid = paymentTotal(installment.payments)
        return <article className="installment-row" key={installment.id}>
          <span className={`installment-number ${status}`}>{String(installment.number).padStart(2, '0')}</span>
          <div className="installment-info"><strong>{debt.installmentCount === 1 ? 'Valor único' : `Parcela ${String(installment.number).padStart(2, '0')} / ${debt.installmentCount}`}</strong><span>Vencimento {dateLabel(installment.dueDate)}{installment.payments.length ? ` · Pago ${money(paid)}` : ''}</span></div>
          <span className="installment-total"><strong>{money(installment.amountCents)}</strong>{remaining > 0 && paid > 0 && <small>restam {money(remaining)}</small>}</span>
          <span className={statusClass(status)}>{statusLabel(status)}</span>
          {remaining > 0 ? <button className="button button-secondary installment-pay" onClick={() => onPay(installment)}><Banknote size={14} /> Registrar pagamento</button> : <span className="installment-paid-mark"><Check size={16} /> Quitada</span>}
          {installment.payments.length > 0 && <div className="installment-payments">{installment.payments.map((payment) => <span key={payment.id}><Check size={12} /> {dateLabel(payment.date)} · {money(payment.amountCents)} · {payment.method}</span>)}</div>}
        </article>
      })}</div>
    </section>
    <p className="data-disclaimer"><CircleHelp size={14} /> A entrada informada é considerada no progresso, mas não gera movimentação histórica. O sistema não estima juros, descontos nem recalcula o contrato.</p>
  </div>
}

function NotesPage({ notes, onSave }: {
  notes: NotebookNote[]
  onSave: (notes: NotebookNote[]) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(() => notes[0]?.id ?? null)
  const [title, setTitle] = useState(() => notes[0]?.title ?? '')
  const [content, setContent] = useState(() => notes[0]?.content ?? '')
  const [error, setError] = useState('')
  const activeNote = notes.find((note) => note.id === activeId)
  const sortedNotes = [...notes].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

  const startNewNote = () => {
    setActiveId(null)
    setTitle('')
    setContent('')
    setError('')
  }

  const saveNote = () => {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      setError('Dê um título para esta anotação.')
      return
    }
    if (!activeId && notes.length >= 500) {
      setError('O caderno chegou ao limite de 500 anotações.')
      return
    }
    const note: NotebookNote = {
      id: activeId ?? crypto.randomUUID(),
      title: trimmedTitle,
      content,
      updatedAt: new Date().toISOString(),
    }
    onSave(activeId
      ? notes.map((item) => item.id === activeId ? note : item)
      : [note, ...notes])
    setActiveId(note.id)
    setTitle(note.title)
    setError('')
  }

  const deleteNote = () => {
    if (!activeNote || !window.confirm(`Excluir a anotação “${activeNote.title}”?`)) return
    onSave(notes.filter((note) => note.id !== activeNote.id))
    startNewNote()
  }

  return <section className="notebook-layout">
    <aside className="panel notebook-list">
      <div className="notebook-list-heading"><div><BookOpen size={17} /><div><h2>Meu caderno</h2><span>{notes.length} {notes.length === 1 ? 'anotação' : 'anotações'}</span></div></div><button className="button button-primary" onClick={startNewNote}><Plus size={15} /> Nova</button></div>
      {sortedNotes.length === 0
        ? <div className="notebook-empty-list"><BookOpen size={22} /><strong>Seu caderno está vazio</strong><span>Crie uma anotação para guardar lembretes e ideias.</span></div>
        : <div className="notebook-note-list">{sortedNotes.map((note) =>
          <button key={note.id} className={`notebook-note-item ${activeId === note.id ? 'active' : ''}`} onClick={() => {
            setActiveId(note.id)
            setTitle(note.title)
            setContent(note.content)
            setError('')
          }}>
            <strong>{note.title}</strong>
            <span>{note.content || 'Sem conteúdo'}</span>
            <small>{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(note.updatedAt))}</small>
          </button>,
        )}</div>}
    </aside>
    <section className="panel notebook-editor">
      <div className="notebook-editor-heading"><div><span className="eyebrow">ANOTAÇÕES PESSOAIS</span><h2>{activeNote ? 'Editar anotação' : 'Nova anotação'}</h2></div>{activeNote && <button className="icon-button" onClick={deleteNote} aria-label="Excluir anotação" title="Excluir anotação"><Trash2 size={16} /></button>}</div>
      <label className="form-label">Título<input value={title} onChange={(event) => { setTitle(event.target.value); setError('') }} maxLength={120} placeholder="Ex.: Ideias para economizar" /></label>
      <label className="form-label notebook-content-label">Anotação<textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={20_000} placeholder="Escreva aqui..." rows={14} /></label>
      {error && <span className="notebook-error" role="alert">{error}</span>}
      <div className="notebook-editor-footer"><span>Salvo neste espaço e incluído no backup.</span><button className="button button-primary" onClick={saveNote}><Check size={15} /> Salvar anotação</button></div>
    </section>
  </section>
}

function BillsSection({ bills, now, onAdd, onEdit, onDelete, onPay, embedded = false }: {
  bills: Bill[]
  now: Date
  onAdd: () => void
  onEdit: (bill: Bill) => void
  onDelete: (bill: Bill) => void
  onPay: (target: PaymentTarget) => void
  embedded?: boolean
}) {
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [frequencyFilter, setFrequencyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sort, setSort] = useState('next-due')
  const today = todayString()
  const regularBills = bills.filter((bill) => !bill.overdueRecord)
  const pendingDates = (bill: Bill) => {
    const dates = Array.from({ length: 14 }, (_, index) => new Date(now.getFullYear(), now.getMonth() + index, 1))
      .flatMap((month) => billOccurrenceDates(bill, month))
      .filter((date) => occurrenceRemaining(bill, date) > 0)
    if (bill.overdueRecord && occurrenceRemaining(bill, bill.startDate) > 0 && !dates.includes(bill.startDate)) {
      dates.push(bill.startDate)
    }
    return dates.sort()
  }
  const visibleBills = regularBills.filter((bill) => {
    const matchesSearch = !search || `${bill.name} ${bill.category} ${bill.notes}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR'))
    const matchesCategory = categoryFilter === 'all' || bill.category === categoryFilter
    const matchesFrequency = frequencyFilter === 'all' || bill.frequency === frequencyFilter
    const upcoming = pendingDates(bill)[0]
    const status = upcoming ? (upcoming < today ? 'overdue' : 'open')
      : bill.occurrences.some((item) => item.payments.length > 0) ? 'paid' : 'ended'
    const matchesStatus = statusFilter === 'all' || status === statusFilter
    return matchesSearch && matchesCategory && matchesFrequency && matchesStatus
  }).sort((a, b) => {
    if (sort === 'amount-desc') return b.amountCents - a.amountCents
    if (sort === 'amount-asc') return a.amountCents - b.amountCents
    if (sort === 'name') return a.name.localeCompare(b.name, 'pt-BR')
    const nextDate = (bill: Bill) => pendingDates(bill)[0] ?? '9999-12-31'
    return sort === 'next-due' ? nextDate(a).localeCompare(nextDate(b)) : b.startDate.localeCompare(a.startDate)
  })
  return <>
    <div className="panel obligation-list-panel">
      <div className="obligation-list-toolbar"><div><h2>Contas e cobranças</h2><p>{embedded ? 'Contas avulsas e recorrentes também aparecem nesta visão geral.' : 'Registre e acompanhe contas avulsas ou recorrentes.'}</p></div><button className="button button-primary" onClick={onAdd}><Plus size={16} /> Nova conta ou cobrança</button></div>
      {regularBills.length > 0 && <div className="obligation-controls obligation-controls-expanded"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar conta ou categoria" /></label><label className="filter-select"><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>{Array.from(new Set(regularBills.map((bill) => bill.category))).sort((a, b) => a.localeCompare(b, 'pt-BR')).map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={frequencyFilter} onChange={(event) => setFrequencyFilter(event.target.value)} aria-label="Filtrar por frequência"><option value="all">Todos os tipos</option>{(['once', 'weekly', 'monthly', 'quarterly', 'yearly'] as BillFrequency[]).map((frequency) => <option key={frequency} value={frequency}>{frequencyLabel(frequency)}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status"><option value="all">Todos os status</option><option value="open">Em aberto</option><option value="overdue">Atrasadas</option><option value="paid">Pagas</option><option value="ended">Encerradas</option></select><ChevronDown size={13} /></label><label className="filter-select"><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar contas"><option value="next-due">Próximo vencimento</option><option value="amount-desc">Maior valor</option><option value="amount-asc">Menor valor</option><option value="name">Nome A–Z</option><option value="recent">Mais recentes</option></select><ChevronDown size={13} /></label></div>}
      {regularBills.length === 0 ? <div className="table-empty"><div className="empty-ring"><CalendarDays size={19} /></div><strong>Nenhuma conta cadastrada</strong><span>As dívidas atrasadas são exibidas junto com as outras dívidas.</span><button className="button button-primary" onClick={onAdd}><Plus size={15} /> Cadastrar conta</button></div> : visibleBills.length === 0 ? <div className="table-empty"><strong>Nenhuma conta encontrada</strong><span>Altere os filtros ou a busca para ver outros resultados.</span></div> : <div className="bill-card-list">{visibleBills.map((bill) => {
        const nextOccurrences = pendingDates(bill)
        const nextDate = nextOccurrences[0]
        const nextRemaining = nextDate ? occurrenceRemaining(bill, nextDate) : 0
        const nextAmount = nextDate ? bill.occurrences.find((occurrence) => occurrence.date === nextDate)?.amountCents ?? bill.amountCents : bill.amountCents
        const nextStatus = nextDate ? occurrenceStatus(bill, nextDate) : bill.overdueRecord ? 'paid' : 'ended'
        const displayDate = nextDate ?? (bill.overdueRecord ? bill.startDate : undefined)
        const isOverdue = nextStatus === 'overdue' || nextStatus === 'partial-overdue'
        return <article className={`bill-card ${isOverdue ? 'bill-card-overdue' : ''}`} key={bill.id}><span className={`bill-icon ${isOverdue ? 'bill-icon-overdue' : ''}`}>{isOverdue ? <CircleAlert size={17} /> : <CalendarDays size={17} />}</span><div className="bill-main"><strong>{bill.name}</strong><span>{bill.category} · {bill.overdueRecord ? 'Dívida atrasada' : frequencyLabel(bill.frequency)}{bill.endDate ? ` · até ${dateLabel(bill.endDate)}` : ''}</span><small>{bill.notes || (bill.overdueRecord ? 'Dívida registrada para pagamento futuro' : bill.frequency === 'once' ? 'Cobrança avulsa' : 'Conta recorrente')}</small></div><div className="bill-next"><span>{bill.overdueRecord ? 'Venceu em' : 'Próximo vencimento'}</span><strong>{displayDate ? dateLabel(displayDate) : 'Sem data futura'}</strong></div><div className="bill-amount"><strong>{money(nextAmount)}</strong><span className={isOverdue ? 'bill-overdue-label' : ''}>{isOverdue && <CircleAlert size={12} />}{isOverdue ? 'ATRASADA' : statusLabel(nextStatus)}</span></div><div className="bill-actions"><button className="icon-button small-icon" onClick={() => onEdit(bill)} title="Editar conta" aria-label={`Editar ${bill.name}`}><Ellipsis size={17} /></button><button className="icon-button small-icon" onClick={() => onDelete(bill)} title="Excluir conta" aria-label={`Excluir ${bill.name}`}><Trash2 size={15} /></button></div>{nextDate && <button className="button button-secondary bill-pay" onClick={() => onPay({ kind: 'bill', billId: bill.id, date: nextDate, label: bill.name, remainingCents: nextRemaining, preferredAccountId: bill.accountId })}><Banknote size={14} /> Registrar pagamento</button>}</article>
      })}</div>}
    </div>
    <p className="data-disclaimer"><CircleHelp size={14} /> Cobranças avulsas geram apenas um vencimento; contas recorrentes podem ser semanais, mensais, trimestrais ou anuais. O dia é ajustado ao último dia do mês quando necessário.</p>
  </>
}

function MonthlyCommitments({ month, monthLabel, items, paid, pending, overdue, onChangeMonth, onPay, onGoBills }: {
  month: Date
  monthLabel: string
  items: { key: string; title: string; subtitle: string; date: string; amountCents: number; remainingCents: number; status: string; target: PaymentTarget | null }[]
  paid: number
  pending: number
  overdue: number
  onChangeMonth: (offset: number) => void
  onPay: (target: PaymentTarget) => void
  onGoBills: () => void
}) {
  const next = items.filter((item) => item.remainingCents > 0 && item.date >= todayString()).sort((a, b) => a.date.localeCompare(b.date))[0]
  const total = items.reduce((sum, item) => sum + item.amountCents, 0)
  return <>
    <div className="monthly-controls panel"><button className="icon-button" onClick={() => onChangeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button><h2>{monthLabel}</h2><button className="icon-button" onClick={() => onChangeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button><button className="button button-secondary" onClick={() => onChangeMonth((new Date().getFullYear() - month.getFullYear()) * 12 + new Date().getMonth() - month.getMonth())}>Este mês</button><button className="button button-secondary monthly-add" onClick={onGoBills}><Plus size={14} /> Conta recorrente</button></div>
    <div className="monthly-stats"><SummaryCard icon={CalendarDays} label="Total comprometido" value={money(total)} note={`${items.length} vencimentos no mês`} tone="blue" /><SummaryCard icon={Check} label="Total pago" value={money(paid)} note="Pagamentos registrados" tone="green" /><SummaryCard icon={ArrowUpRight} label="Pendente" value={money(pending)} note="Em dia ou a vencer" tone="violet" /><SummaryCard icon={CircleHelp} label="Atrasado" value={money(overdue)} note="Vencimento já passou" tone="red" /></div>
    <section className="panel obligation-list-panel monthly-items-panel"><div className="obligation-list-toolbar"><div><h2>Vencimentos</h2><p>{next ? `Próximo vencimento ${dateLabel(next.date)} · ${next.title}` : 'Vencimentos de dívidas e contas recorrentes neste mês.'}</p></div><strong>{money(total)}</strong></div>{items.length === 0 ? <div className="table-empty"><div className="empty-ring"><CalendarDays size={19} /></div><strong>Nenhum compromisso neste mês</strong><span>As parcelas de dívidas e contas recorrentes aparecerão aqui.</span><button className="button button-secondary" onClick={onGoBills}><Plus size={15} /> Cadastrar conta recorrente</button></div> : <div className="monthly-items">{items.map((item) => <article className="monthly-item" key={item.key}><span className="monthly-date"><strong>{dateLabel(item.date, { day: '2-digit' })}</strong><small>{dateLabel(item.date, { weekday: 'short', month: 'short' })}</small></span><span className="monthly-item-info"><strong>{item.title}</strong><small>{item.subtitle}</small></span><span className="monthly-item-value"><strong>{money(item.amountCents)}</strong>{item.remainingCents > 0 && item.remainingCents < item.amountCents && <small>Restam {money(item.remainingCents)}</small>}</span><span className={statusClass(item.status)}>{statusLabel(item.status)}</span>{item.target ? <button className="button button-secondary monthly-pay" onClick={() => onPay(item.target!)}><Banknote size={14} /> Pagar</button> : <span className="installment-paid-mark"><Check size={15} /> Pago</span>}</article>)}</div>}</section>
  </>
}

function CalendarPage({ transactions, calendarEvents, debts, bills, onPay, onAdd, onAddEvent, onEdit, onDelete, onEditEvent, onDeleteEvent, onToggleEvent }: {
  transactions: Transaction[]
  calendarEvents: CalendarEvent[]
  debts: Debt[]
  bills: Bill[]
  onPay: (target: PaymentTarget) => void
  onAdd: (date: string) => void
  onAddEvent: (date: string) => void
  onEdit: (transaction: Transaction) => void
  onDelete: (transaction: Transaction) => void
  onEditEvent: (calendarEvent: CalendarEvent) => void
  onDeleteEvent: (calendarEvent: CalendarEvent) => void
  onToggleEvent: (calendarEvent: CalendarEvent) => void
}) {
  const [displayMonth, setDisplayMonth] = useState(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth(), 1)
  })
  const [selectedDate, setSelectedDate] = useState(todayString)
  const [filter, setFilter] = useState<'all' | 'transactions' | 'events' | 'obligations'>('all')
  const month = monthKey(displayMonth)
  const firstDay = new Date(displayMonth.getFullYear(), displayMonth.getMonth(), 1)
  const gridStart = new Date(firstDay.getFullYear(), firstDay.getMonth(), 1 - ((firstDay.getDay() + 6) % 7))
  const days = Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
    return { date, key: dateToString(date), isCurrentMonth: date.getMonth() === displayMonth.getMonth() }
  })
  const monthTransactions = transactions.filter((transaction) => transactionInMonth(transaction, month))
  const monthEvents = calendarEvents.filter((calendarEvent) => calendarEvent.date.slice(0, 7) === month)
  const monthObligations: CalendarObligation[] = [
    ...debts.flatMap((debt) => debt.installments
      .filter((installment) => installment.dueDate.slice(0, 7) === month)
      .map((installment) => {
        const remainingCents = installmentRemaining(installment)
        return {
          key: `debt-${debt.id}-${installment.number}`,
          title: debt.name,
          subtitle: `Parcela ${installment.number}/${debt.installmentCount}`,
          date: installment.dueDate,
          amountCents: installment.amountCents,
          remainingCents,
          status: installmentStatus(installment),
          target: remainingCents > 0 ? {
            kind: 'debt' as const,
            debtId: debt.id,
            installmentNumber: installment.number,
            label: `${debt.name} · parcela ${installment.number}/${debt.installmentCount}`,
            remainingCents,
          } : null,
        }
      })),
    ...bills.flatMap((bill) => billOccurrenceDates(bill, displayMonth).map((date) => {
      const remainingCents = occurrenceRemaining(bill, date)
      return {
        key: `bill-${bill.id}-${date}`,
        title: bill.name,
        subtitle: bill.category,
        date,
        amountCents: bill.occurrences.find((occurrence) => occurrence.date === date)?.amountCents ?? bill.amountCents,
        remainingCents,
        status: occurrenceStatus(bill, date),
        target: remainingCents > 0 ? {
          kind: 'bill' as const,
          billId: bill.id,
          date,
          label: bill.name,
          remainingCents,
          preferredAccountId: bill.accountId,
        } : null,
      }
    })),
  ]
  const selectedTransactions = transactions
    .filter((transaction) => transaction.date === selectedDate && (filter === 'all' || filter === 'transactions'))
    .sort((a, b) => a.description.localeCompare(b.description, 'pt-BR'))
  const selectedEvents = calendarEvents
    .filter((calendarEvent) => calendarEvent.date === selectedDate && (filter === 'all' || filter === 'events'))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.title.localeCompare(b.title, 'pt-BR'))
  const selectedObligations = monthObligations.filter((item) => item.date === selectedDate && (filter === 'all' || filter === 'obligations'))
  const selectedItemCount = selectedTransactions.length + selectedEvents.length + selectedObligations.length
  const income = monthTransactions.reduce((sum, transaction) => sum + (transaction.type === 'income' ? transaction.amountCents : 0), 0)
  const expenses = monthTransactions.reduce((sum, transaction) => sum + (transaction.type === 'expense' ? transaction.amountCents : 0), 0)
  const monthLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(displayMonth)
  const selectedLabel = dateLabel(selectedDate, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const changeMonth = (amount: number) => {
    setDisplayMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }
  const goToToday = () => {
    const today = new Date()
    setDisplayMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(dateToString(today))
  }
  const chooseDay = (day: (typeof days)[number]) => {
    setSelectedDate(day.key)
    if (!day.isCurrentMonth) setDisplayMonth(new Date(day.date.getFullYear(), day.date.getMonth(), 1))
  }

  return (
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar">
          <div className="calendar-month-controls">
            <button className="icon-button" onClick={() => changeMonth(-1)} aria-label="Mês anterior"><ChevronLeft size={18} /></button>
            <h2>{monthLabel}</h2>
            <button className="icon-button" onClick={() => changeMonth(1)} aria-label="Próximo mês"><ChevronRight size={18} /></button>
            <button className="button button-secondary calendar-today" onClick={goToToday}>Hoje</button>
          </div>
          <div className="calendar-add-actions">
            <button className="button button-secondary" onClick={() => onAddEvent(selectedDate)}><CalendarPlus size={15} /> Novo compromisso</button>
            <button className="button button-primary calendar-add" onClick={() => onAdd(selectedDate)}><Plus size={16} /> Lançamento</button>
          </div>
        </div>
        <div className="calendar-weekdays" aria-hidden="true">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((day) => <span key={day}>{day}</span>)}
        </div>
        <div className="calendar-grid" role="grid" aria-label={`Calendário de ${monthLabel}`}>
          {days.map((day) => {
            const dayTransactions = transactions.filter((transaction) => transaction.date === day.key)
            const dayEvents = calendarEvents.filter((calendarEvent) => calendarEvent.date === day.key)
            const dayObligations = monthObligations.filter((item) => item.date === day.key)
            const dayItems = [
              ...dayTransactions.map((transaction) => ({ id: transaction.id, title: transaction.description, className: transaction.type, amount: money(transaction.amountCents) })),
              ...dayEvents.map((calendarEvent) => ({ id: calendarEvent.id, title: calendarEvent.title, className: `scheduled ${calendarEvent.type}`, amount: calendarEventTypes.find((type) => type.value === calendarEvent.type)?.label ?? 'Compromisso' })),
              ...dayObligations.map((item) => ({ id: item.key, title: item.title, className: 'scheduled installment', amount: `${money(item.amountCents)} · ${statusLabel(item.status)}` })),
            ]
            const dayIncome = dayTransactions.some((transaction) => transaction.type === 'income')
            const dayExpense = dayTransactions.some((transaction) => transaction.type === 'expense')
            const selected = day.key === selectedDate
            const isToday = day.key === todayString()
            return (
              <button
                key={day.key}
                className={`calendar-day ${day.isCurrentMonth ? '' : 'outside-month'} ${selected ? 'selected-day' : ''} ${isToday ? 'today-day' : ''}`}
                onClick={() => chooseDay(day)}
                role="gridcell"
                aria-selected={selected}
                aria-label={`${dateLabel(day.key, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}${dayItems.length ? `, ${dayItems.length} itens no calendário` : ''}`}
              >
                <span className="calendar-day-number">{day.date.getDate()}</span>
                {dayItems.length > 0 && (
                  <span className="calendar-day-markers">
                    {dayIncome && <i className="income-marker" />}
                    {dayExpense && <i className="expense-marker" />}
                    {dayEvents.length > 0 && <i className="scheduled-marker" />}
                    <small>{dayItems.length}</small>
                  </span>
                )}
                <span className="calendar-day-events">
                  {dayItems.slice(0, 2).map((item) => (
                    <span key={item.id} className={`calendar-event-chip ${item.className}`} title={`${item.title} · ${item.amount}`}>
                      {item.title}
                    </span>
                  ))}
                  {dayItems.length > 2 && <span className="calendar-more">+{dayItems.length - 2} mais</span>}
                </span>
              </button>
            )
          })}
        </div>
        <div className="calendar-legend">
          <span><i className="income-marker" />Receitas</span>
          <span><i className="expense-marker" />Despesas</span>
          <span><i className="scheduled-marker" />Compromissos</span>
          <span className="calendar-legend-note">Lançamentos e compromissos</span>
        </div>
      </section>

      <aside className="calendar-aside">
        <section className="panel calendar-month-summary">
          <div className="calendar-aside-heading"><span className="calendar-aside-icon"><CalendarDays size={17} /></span><div><h2>Resumo do mês</h2><p>{monthLabel}</p></div></div>
          <div className="calendar-summary-row"><span>Itens no calendário</span><strong>{monthTransactions.length + monthEvents.length + monthObligations.length}</strong></div>
          <div className="calendar-summary-row"><span>Compromissos</span><strong>{monthEvents.length}</strong></div>
          <div className="calendar-summary-row"><span>Vencimentos</span><strong>{monthObligations.length}</strong></div>
          <div className="calendar-summary-row"><span>Receitas</span><strong className="positive">{money(income)}</strong></div>
          <div className="calendar-summary-row"><span>Despesas</span><strong className="negative">{money(expenses)}</strong></div>
          <div className="calendar-net"><span>Resultado</span><strong className={income >= expenses ? 'positive' : 'negative'}>{money(income - expenses)}</strong></div>
        </section>
        <section className="panel calendar-day-panel">
          <div className="calendar-selected-heading"><div><span className="eyebrow">DIA SELECIONADO</span><h2>{selectedLabel}</h2></div></div>
          <div className="calendar-day-actions"><button className="button button-secondary" onClick={() => onAddEvent(selectedDate)}><CalendarPlus size={14} /> Compromisso</button><button className="button button-primary" onClick={() => onAdd(selectedDate)}><Plus size={14} /> Lançamento</button></div>
          <label className="calendar-filter"><ListFilter size={14} /><select value={filter} onChange={(event) => setFilter(event.target.value as 'all' | 'transactions' | 'events' | 'obligations')} aria-label="Filtrar itens do dia"><option value="all">Todos os itens</option><option value="transactions">Lançamentos</option><option value="events">Compromissos</option><option value="obligations">Vencimentos</option></select><ChevronDown size={13} /></label>
          {selectedItemCount === 0 ? (
            <div className="calendar-day-empty"><div className="empty-ring"><CalendarDays size={18} /></div><strong>Dia sem itens</strong><span>Adicione um lançamento ou compromisso para esta data.</span></div>
          ) : (
            <div className="calendar-event-list">
              {selectedTransactions.map((transaction) => (
                <article className="calendar-event-card" key={transaction.id}>
                  <span className={`calendar-event-icon ${transaction.type}`} aria-hidden="true">{transaction.type === 'income' ? <ArrowDownLeft size={16} /> : transaction.type === 'expense' ? <ArrowUpRight size={16} /> : <ArrowLeftRight size={16} />}</span>
                  {transaction.sourcePaymentId || transaction.sourceGoalMovementId
                    ? <span className="calendar-event-info"><strong>{transaction.description}</strong><span>{transaction.category} · {transaction.sourceGoalMovementId ? 'Transferência interna vinculada' : 'Pagamento vinculado'}</span></span>
                    : <button className="calendar-event-info" onClick={() => onEdit(transaction)}><strong>{transaction.description}</strong><span>{transaction.category} · {transaction.type === 'income' ? 'Receita' : transaction.type === 'expense' ? 'Despesa' : 'Transferência interna'}</span></button>}
                  <div className="calendar-event-trailing"><strong className={transaction.type === 'income' || transaction.type === 'transfer-in' ? 'positive' : transaction.type === 'expense' ? 'negative' : 'transfer-amount'}>{transaction.type === 'income' || transaction.type === 'transfer-in' ? '+' : '−'}{money(transaction.amountCents)}</strong><button className="icon-button small-icon" onClick={() => onDelete(transaction)} aria-label={`Excluir ${transaction.description}`} title={transaction.sourcePaymentId || transaction.sourceGoalMovementId ? 'Excluir movimentação vinculada' : 'Excluir lançamento'}><Trash2 size={14} /></button></div>
                </article>
              ))}
              {selectedEvents.map((calendarEvent) => {
                const eventType = calendarEventTypes.find((type) => type.value === calendarEvent.type)?.label ?? 'Compromisso'
                return (
                  <article className={`calendar-event-card scheduled-card ${calendarEvent.done ? 'completed-event' : ''}`} key={calendarEvent.id}>
                    <button className={`calendar-event-icon scheduled ${calendarEvent.type}`} aria-label={calendarEvent.done ? 'Reabrir compromisso' : 'Marcar compromisso como concluído'} title={calendarEvent.done ? 'Reabrir compromisso' : 'Marcar como concluído'} onClick={() => onToggleEvent(calendarEvent)}>{calendarEvent.done ? <Check size={16} /> : <CalendarDays size={15} />}</button>
                    <button className="calendar-event-info" onClick={() => onEditEvent(calendarEvent)}><strong>{calendarEvent.title}</strong><span>{eventType}{calendarEvent.note ? ` · ${calendarEvent.note}` : ''}</span></button>
                    <div className="calendar-event-trailing">
                      {calendarEvent.amountCents !== undefined && <strong className="scheduled-value">{money(calendarEvent.amountCents)}</strong>}
                      <button className="icon-button small-icon" onClick={() => onDeleteEvent(calendarEvent)} aria-label={`Excluir ${calendarEvent.title}`} title="Excluir"><Trash2 size={14} /></button>
                    </div>
                  </article>
                )
              })}
              {selectedObligations.map((item) => (
                <article className="calendar-event-card scheduled-card" key={item.key}>
                  <span className="calendar-event-icon scheduled" aria-hidden="true"><CalendarDays size={16} /></span>
                  <span className="calendar-event-info"><strong>{item.title}</strong><span>{item.subtitle} · {statusLabel(item.status)}</span></span>
                  <div className="calendar-event-trailing">
                    <strong className={item.remainingCents > 0 ? 'negative' : 'positive'}>{money(item.remainingCents > 0 ? item.remainingCents : item.amountCents)}</strong>
                    {item.target
                      ? <button className="button button-secondary" onClick={() => onPay(item.target!)}><Banknote size={14} /> Pagar</button>
                      : <span className="installment-paid-mark"><Check size={15} /> Pago</span>}
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
        <p className="data-disclaimer"><CircleHelp size={14} /> Compromissos e vencimentos não alteram saldos até que você registre o pagamento. Os pagamentos registrados aparecem nos lançamentos financeiros.</p>
      </aside>
    </div>
  )
}

function ReportsPage({ data, period, now, onPeriodChange, onExport }: { data: AppData; period: string; now: Date; onPeriodChange: (value: string) => void; onExport: () => void }) {
  const transactions = data.transactions.filter((transaction) => {
    const date = new Date(`${transaction.date}T12:00:00`)
    if (period === 'month') return transaction.date.slice(0, 7) === monthKey(now)
    if (period === '3months') return date >= new Date(now.getFullYear(), now.getMonth() - 2, 1)
    if (period === 'year') return date.getFullYear() === now.getFullYear()
    return true
  })
  const income = transactions.reduce((sum, item) => sum + (item.type === 'income' ? item.amountCents : 0), 0)
  const expense = transactions.reduce((sum, item) => sum + (item.type === 'expense' ? item.amountCents : 0), 0)
  const byCategory = transactions.filter((item) => item.type === 'expense').reduce<Record<string, number>>((totals, item) => {
    totals[item.category] = (totals[item.category] ?? 0) + item.amountCents
    return totals
  }, {})
  const categories = Object.entries(byCategory).sort((a, b) => b[1] - a[1])
  return <>
    <div className="report-toolbar panel"><div><strong>Período do relatório</strong><span>Os totais consideram apenas os lançamentos cadastrados.</span></div><label className="filter-select"><CalendarDays size={15} /><select value={period} onChange={(event) => onPeriodChange(event.target.value)} aria-label="Selecionar período"><option value="month">Este mês</option><option value="3months">Últimos 3 meses</option><option value="year">Este ano</option><option value="all">Todo o período</option></select><ChevronDown size={14} /></label></div>
    <div className="report-stats"><SummaryCard icon={ArrowDownLeft} label="Receitas no período" value={money(income)} note={`${transactions.filter((item) => item.type === 'income').length} registros`} tone="blue" /><SummaryCard icon={ArrowUpRight} label="Despesas no período" value={money(expense)} note={`${transactions.filter((item) => item.type === 'expense').length} registros`} tone="red" /><SummaryCard icon={TrendingUp} label="Resultado do período" value={money(income - expense)} note={income - expense >= 0 ? 'Receitas menos despesas' : 'Despesas acima das receitas'} tone="green" /></div>
    <section className="panel report-category"><div className="panel-heading"><div><h2>Despesas por categoria</h2><p>Ordenadas do maior para o menor valor</p></div><button className="button button-secondary" onClick={onExport}><Download size={15} /> Exportar CSV</button></div>{categories.length === 0 ? <div className="table-empty"><div className="empty-ring"><FileText size={19} /></div><strong>Sem despesas neste período</strong><span>Quando houver registros, o detalhamento aparecerá aqui.</span></div> : <div className="category-report-list">{categories.map(([category, value]) => <div className="category-report-row" key={category}><div><strong>{category}</strong><span>{Math.round((value / expense) * 100)}% do total</span></div><div className="progress-track"><span style={{ width: `${(value / categories[0][1]) * 100}%` }} /></div><strong>{money(value)}</strong></div>)}</div>}</section>
  </>
}

function SettingsPage({ data, cloudEnabled, importRef, onThemeChange, onExport, onImport, onReminderDaysChange }: { data: AppData; cloudEnabled: boolean; importRef: React.RefObject<HTMLInputElement | null>; onThemeChange: () => void; onExport: () => void; onImport: (file?: File) => void; onReminderDaysChange: (days: number[]) => void }) {
  return <div className="settings-grid">
    <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><SlidersHorizontal size={18} /></span><div><h2>Aparência</h2><p>Escolha como você prefere visualizar o Nexus.</p></div></div><div className="setting-row"><div><strong>Tema da interface</strong><span>Alterne entre os modos escuro e claro.</span></div><button className={`theme-switch ${data.theme === 'light' ? 'on' : ''}`} role="switch" aria-checked={data.theme === 'light'} onClick={onThemeChange}><span /></button></div><div className="setting-row"><div><strong>Moeda padrão</strong><span>Os valores são exibidos em Real brasileiro.</span></div><span className="setting-value">BRL · R$</span></div></section>
    <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><CalendarDays size={18} /></span><div><h2>Lembretes locais</h2><p>Exiba alertas de vencimento no dashboard deste navegador.</p></div></div><div className="reminder-settings">{reminderOptions.map((option) => <label key={option.days}><span>{option.label}</span><input type="checkbox" checked={(data.reminderDays ?? defaultReminderDays).includes(option.days)} onChange={(event) => {
      const current = data.reminderDays ?? defaultReminderDays
      const reminderDays = event.target.checked
        ? [...current, option.days].sort((a, b) => b - a)
        : current.filter((day) => day !== option.days)
      onReminderDaysChange(reminderDays)
    }} /></label>)}</div></section>
    <section className="panel settings-card"><div className="settings-card-heading"><span className="settings-icon"><Download size={18} /></span><div><h2>Seus dados</h2><p>Exporte ou restaure seu arquivo de dados.</p></div></div><div className="data-counts"><div><strong>{data.transactions.length}</strong><span>Lançamentos</span></div><div><strong>{data.accounts.length}</strong><span>Contas</span></div><div><strong>{cloudEnabled ? 'Supabase' : 'Neste navegador'}</strong><span>{cloudEnabled ? 'Nuvem sincronizada' : 'Armazenamento local'}</span></div></div><div className="backup-actions"><button className="button button-primary" onClick={onExport}><Download size={15} /> Exportar backup JSON</button><button className="button button-secondary" onClick={() => importRef.current?.click()}><Upload size={15} /> Restaurar backup</button><input ref={importRef} className="visually-hidden" type="file" accept="application/json,.json" onChange={(event) => onImport(event.currentTarget.files?.[0])} /></div><div className="privacy-note"><CircleHelp size={16} /><p>{cloudEnabled ? 'Seus dados são armazenados na nuvem Supabase, vinculados à sua conta e protegidos por políticas de acesso. Mantenha backups JSON como cópia adicional.' : 'Seus dados permanecem neste navegador e não são enviados a um servidor. Eles podem ser perdidos ao limpar os dados do navegador; mantenha backups em local seguro.'}</p></div></section>
  </div>
}

function DebtDialog({ debt, onClose, onSubmit }: {
  debt: Debt | null
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const amount = (cents: number) => (cents / 100).toFixed(2)
  const [entryMode, setEntryMode] = useState<'contract' | 'overdue'>(debt?.overdueRecord ? 'overdue' : 'contract')
  const [firstDueDate, setFirstDueDate] = useState(debt?.firstDueDate ?? addMonthsWithDay(todayString(), 1))
  const [installmentCount, setInstallmentCount] = useState(String(debt?.installmentCount ?? 12))
  const [dueDay, setDueDay] = useState(String(debt?.dueDay ?? 5))
  const parsedCount = Number(installmentCount)
  const isOverdueEntry = entryMode === 'overdue'
  const parsedDueDay = Number(dueDay)
  const hasSchedulePreview = isValidDate(firstDueDate)
    && Number.isInteger(parsedCount) && parsedCount > 0 && parsedCount <= 600
    && Number.isInteger(parsedDueDay) && parsedDueDay >= 1 && parsedDueDay <= 31
  const lastDueDate = hasSchedulePreview ? addMonthsWithDay(firstDueDate, parsedCount - 1, parsedDueDay) : ''
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog contract-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="debt-dialog-title">
    <div className="dialog-header"><div><div className="eyebrow">GESTÃO DE DÍVIDAS</div><h2 id="debt-dialog-title">{debt ? 'Editar contrato' : isOverdueEntry ? 'Registrar dívida em atraso' : 'Cadastrar dívida'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    {!debt && <label className="form-label">Tipo de cadastro<select name="entryMode" value={entryMode} onChange={(event) => {
      const nextMode = event.target.value as 'contract' | 'overdue'
      setEntryMode(nextMode)
      setInstallmentCount(nextMode === 'overdue' ? '1' : '12')
      if (nextMode === 'overdue' && firstDueDate >= todayString()) {
        const now = new Date()
        setFirstDueDate(dateToString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1)))
      }
    }}><option value="contract">Contrato ou dívida comum</option><option value="overdue">Dívida em atraso</option></select></label>}
    <div className="form-two-columns"><label className="form-label">Nome da dívida<input name="name" autoFocus maxLength={80} placeholder="Ex.: Financiamento da moto" defaultValue={debt?.name ?? ''} required /></label><label className="form-label">Tipo<select name="type" defaultValue={debt?.type ?? 'other'}>{debtTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label></div>
    <div className="form-two-columns"><label className="form-label">Instituição ou credor<input name="creditor" maxLength={80} placeholder="Ex.: Banco ou pessoa" defaultValue={debt?.creditor ?? ''} /></label><label className="form-label">{parsedCount === 1 ? 'Valor total a pagar' : 'Valor original'}<input name="originalAmount" type="number" step="0.01" min="0.01" placeholder="0,00" defaultValue={debt ? amount(debt.originalAmountCents) : ''} required /></label></div>
    {!isOverdueEntry && <label className="form-label">Valor efetivamente recebido · opcional<input name="receivedAmount" type="number" step="0.01" min="0.01" placeholder="Não informado" defaultValue={debt?.receivedAmountCents ? amount(debt.receivedAmountCents) : ''} /></label>}
    {!isOverdueEntry && <label className="form-label">Descrição (opcional)<input name="description" maxLength={150} placeholder="Detalhes do contrato" defaultValue={debt?.description ?? ''} /></label>}
    <div className="form-two-columns">{!isOverdueEntry && parsedCount > 1 && <label className="form-label">Valor da parcela<input name="installmentAmount" type="number" step="0.01" min="0.01" placeholder="0,00" defaultValue={debt ? amount(debt.installmentAmountCents) : ''} required /></label>}{!isOverdueEntry && <><label className="form-label">Tipo de cobrança<select value={parsedCount === 1 ? 'single' : 'installments'} onChange={(event) => setInstallmentCount(event.target.value === 'single' ? '1' : String(debt && debt.installmentCount > 1 ? debt.installmentCount : 12))}><option value="single">Valor único</option><option value="installments">Parcelado</option></select></label>{parsedCount === 1 ? <input type="hidden" name="installmentCount" value="1" /> : <label className="form-label">Quantidade de parcelas<input name="installmentCount" type="number" min="2" max="600" step="1" value={installmentCount} onChange={(event) => setInstallmentCount(event.target.value)} required /></label>}</>}{isOverdueEntry && <input type="hidden" name="installmentCount" value="1" />}</div>
    <div className="form-two-columns"><label className="form-label">{isOverdueEntry ? 'Data do vencimento original' : 'Data da primeira parcela'}<input name="firstDueDate" type="date" value={firstDueDate} onChange={(event) => setFirstDueDate(event.target.value)} required /></label>{!isOverdueEntry && <label className="form-label">Data da última parcela<input type="date" value={lastDueDate} readOnly /></label>}</div>
    {!isOverdueEntry && <div className="form-two-columns">{parsedCount > 1 && <label className="form-label">Dia de vencimento mensal<input name="dueDay" type="number" min="1" max="31" value={dueDay} onChange={(event) => setDueDay(event.target.value)} required /></label>}<label className="form-label">Juros ao mês (%) · opcional<input name="monthlyInterest" type="number" min="0" step="0.01" placeholder="Não informado" defaultValue={debt?.monthlyInterestBps ? (debt.monthlyInterestBps / 100).toFixed(2) : ''} /></label></div>}
    {!isOverdueEntry && <div className="form-two-columns"><label className="form-label">Taxa anual (%) · opcional<input name="annualInterest" type="number" min="0" step="0.01" placeholder="Não informada" defaultValue={debt?.annualInterestBps ? (debt.annualInterestBps / 100).toFixed(2) : ''} /></label><label className="form-label">CET anual (%) · opcional<input name="cet" type="number" min="0" step="0.01" placeholder="Não informado" defaultValue={debt?.cetBps ? (debt.cetBps / 100).toFixed(2) : ''} /></label></div>}
    {!isOverdueEntry && hasSchedulePreview && <div className="debt-schedule-preview" role="status">
      <strong>Prévia do cronograma</strong>
      <span>{parsedCount === 1 ? `Vencimento único: ${dateLabel(firstDueDate)}` : `Parcela 1: ${dateLabel(firstDueDate)} · Parcela ${parsedCount}: ${dateLabel(lastDueDate)}`}</span>
    </div>}
    {!isOverdueEntry && <label className="form-label">Valor de entrada · opcional<input name="downPayment" type="number" min="0" step="0.01" placeholder="0,00" defaultValue={debt ? amount(debt.downPaymentCents) : '0'} /></label>}
    {debt?.installments.some((installment) => installment.payments.length > 0) && <p className="form-hint contract-preserve-note">Pagamentos já registrados e os valores das parcelas pagas serão preservados. Alterações serão aplicadas às parcelas sem histórico de pagamento.</p>}
    <label className="form-label">Observações<textarea name="notes" maxLength={500} rows={2} placeholder="Anotações do contrato" defaultValue={debt?.notes ?? ''} /></label>
    <p className="form-hint">{isOverdueEntry ? 'A dívida ficará registrada como atrasada. Você poderá registrar pagamentos parciais ou quitar o saldo quando pagar.' : 'Escolha valor único para uma dívida com um só vencimento ou parcelado para gerar o cronograma. Taxas e valor recebido são informativos: o sistema não recalcula o contrato.'}</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{debt ? 'Salvar dívida' : isOverdueEntry ? 'Registrar dívida atrasada' : parsedCount === 1 ? 'Cadastrar dívida' : 'Gerar parcelas'}</button></div>
  </form></div>
}

function BillDialog({ bill, accounts, onClose, onSubmit }: {
  bill: Bill | null
  accounts: Account[]
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const amount = (cents: number) => (cents / 100).toFixed(2)
  const [entryMode, setEntryMode] = useState<'overdue' | 'bill'>(bill?.overdueRecord ? 'overdue' : 'bill')
  const [frequency, setFrequency] = useState<BillFrequency>(bill?.frequency ?? (bill ? 'monthly' : 'once'))
  const yesterday = () => {
    const now = new Date()
    return dateToString(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))
  }
  const [startDate, setStartDate] = useState(bill?.startDate ?? yesterday())
  const isOverdueEntry = entryMode === 'overdue'
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog contract-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="bill-dialog-title">
    <div className="dialog-header"><div><div className="eyebrow">CONTAS E COBRANÇAS</div><h2 id="bill-dialog-title">{bill ? (bill.overdueRecord ? 'Editar dívida atrasada' : 'Editar conta') : 'Registrar dívida ou conta'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    {!bill && <label className="form-label">Tipo de cadastro<select name="entryMode" value={entryMode} onChange={(event) => {
      const nextMode = event.target.value as 'overdue' | 'bill'
      setEntryMode(nextMode)
      setFrequency(nextMode === 'overdue' ? 'once' : 'monthly')
      setStartDate(nextMode === 'overdue' ? yesterday() : todayString())
    }}><option value="overdue">Dívida atrasada</option><option value="bill">Conta ou cobrança</option></select></label>}
    {bill && <input type="hidden" name="entryMode" value={bill.overdueRecord ? 'overdue' : 'bill'} />}
    <label className="form-label">Nome da conta<input name="name" autoFocus maxLength={80} placeholder={isOverdueEntry ? 'Ex.: Dívida do cartão' : 'Ex.: Internet, aluguel, energia'} defaultValue={bill?.name ?? ''} required /></label>
    <div className="form-two-columns"><label className="form-label">Categoria<select name="category" defaultValue={bill?.category ?? 'Contas domésticas'}>{expenseCategories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-label">{isOverdueEntry || frequency === 'once' ? 'Valor da dívida' : 'Valor por vencimento'}<input name="amount" type="number" min="0.01" step="0.01" placeholder="0,00" defaultValue={bill ? amount(bill.amountCents) : ''} required /></label></div>
    {isOverdueEntry
      ? <input type="hidden" name="frequency" value="once" />
      : <div className="form-two-columns"><label className="form-label">Tipo de cobrança<select name="frequency" value={frequency} onChange={(event) => setFrequency(event.target.value as BillFrequency)}><option value="once">Valor único</option><option value="weekly">Semanal</option><option value="monthly">Mensal</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>{frequency !== 'once' && <label className="form-label">Dia do vencimento<input name="dueDay" type="number" min="1" max="31" defaultValue={bill?.dueDay ?? 10} required /></label>}</div>}
    <div className="form-two-columns"><label className="form-label">{isOverdueEntry ? 'Data que venceu' : frequency === 'once' ? 'Data do vencimento' : 'Data de início'}<input name="startDate" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} required /></label>{!isOverdueEntry && frequency !== 'once' && <label className="form-label">Data de término · opcional<input name="endDate" type="date" defaultValue={bill?.endDate ?? ''} /></label>}</div>
    <label className="form-label">Conta preferida para pagamento<select name="accountId" defaultValue={bill?.accountId ?? accounts[0]?.id ?? ''}><option value="">Escolher ao pagar</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></label>
    <label className="form-label">Observações<textarea name="notes" maxLength={300} rows={2} placeholder="Observações sobre a conta ou dívida" defaultValue={bill?.notes ?? ''} /></label>
    {isOverdueEntry && <p className="form-hint bill-overdue-hint"><CircleAlert size={14} /> A dívida será registrada como atrasada. Depois, use “Registrar pagamento” para quitar o valor.</p>}
    {bill?.occurrences.some((occurrence) => occurrence.payments.length > 0) && <p className="form-hint contract-preserve-note">Pagamentos anteriores serão mantidos mesmo que você altere o valor ou a frequência.</p>}
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{bill ? (bill.overdueRecord ? 'Salvar dívida' : 'Salvar conta') : isOverdueEntry ? 'Registrar dívida atrasada' : frequency === 'once' ? 'Cadastrar cobrança' : 'Criar vencimentos'}</button></div>
  </form></div>
}

function CalendarEventDialog({ calendarEvent, initialDate, onClose, onSubmit }: {
  calendarEvent: CalendarEvent | null
  initialDate: string
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog calendar-event-form" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="calendar-event-dialog-title">
    <div className="dialog-header"><div><div className="eyebrow">ORGANIZE SEUS COMPROMISSOS</div><h2 id="calendar-event-dialog-title">{calendarEvent ? 'Editar compromisso' : 'Novo compromisso'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <label className="form-label">Título<input name="title" autoFocus maxLength={100} placeholder="Ex.: Vencimento da conta de luz" defaultValue={calendarEvent?.title ?? ''} required /></label>
    <div className="form-two-columns"><label className="form-label">Tipo<select name="type" defaultValue={calendarEvent?.type ?? 'reminder'}>{calendarEventTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="form-label">Data<input name="date" type="date" defaultValue={calendarEvent?.date ?? initialDate} required /></label></div>
    <label className="form-label">Valor estimado (opcional)<div className="amount-input"><span>R$</span><input name="amount" type="number" step="0.01" min="0.01" placeholder="Deixe vazio se não se aplicar" defaultValue={calendarEvent?.amountCents === undefined ? '' : (calendarEvent.amountCents / 100).toFixed(2)} /></div></label>
    <label className="form-label">Observações (opcional)<textarea name="note" maxLength={240} rows={3} placeholder="Adicione um detalhe para lembrar depois" defaultValue={calendarEvent?.note ?? ''} /></label>
    <p className="form-hint">O compromisso aparece no calendário, mas não movimenta o saldo da conta. Registre a transação quando o valor for efetivamente recebido ou pago.</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{calendarEvent ? 'Salvar alterações' : 'Criar compromisso'}</button></div>
  </form></div>
}

function TransactionDialog({ transaction, initialDate, accounts, onClose, onSubmit }: { transaction: Transaction | null; initialDate: string; accounts: Account[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [type, setType] = useState<TransactionType>(transaction?.type ?? 'expense')
  const categories = type === 'income' ? incomeCategories : expenseCategories
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="transaction-dialog-title">
    <div className="dialog-header"><div><div className="eyebrow">{transaction ? 'ATUALIZE SEUS REGISTROS' : 'NOVA MOVIMENTAÇÃO'}</div><h2 id="transaction-dialog-title">{transaction ? 'Editar lançamento' : 'Adicionar lançamento'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <div className="type-toggle"><button type="button" className={type === 'expense' ? 'selected expense-selected' : ''} onClick={() => setType('expense')}><ArrowUpRight size={16} /> Despesa</button><button type="button" className={type === 'income' ? 'selected income-selected' : ''} onClick={() => setType('income')}><ArrowDownLeft size={16} /> Receita</button><input type="hidden" name="type" value={type} /></div>
    <label className="form-label">Descrição<input name="description" autoFocus maxLength={100} placeholder="Ex.: Conta de energia" defaultValue={transaction?.description ?? ''} required /></label>
    <label className="form-label">Valor<div className="amount-input"><span>R$</span><input name="amount" type="number" step="0.01" min="0.01" placeholder="0,00" defaultValue={transaction ? (transaction.amountCents / 100).toFixed(2) : ''} required /></div></label>
    <div className="form-two-columns"><label className="form-label">Categoria<select name="category" defaultValue={transaction?.category ?? categories[0]}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="form-label">Data<input name="date" type="date" defaultValue={transaction?.date ?? initialDate} required /></label></div>
    <label className="form-label">Conta<select name="accountId" defaultValue={transaction?.accountId ?? accounts[0]?.id ?? ''}><option value="">Não vinculada</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select>{accounts.length === 0 && <small className="form-hint">Cadastre uma conta para acompanhar os saldos.</small>}</label>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} />{transaction ? 'Salvar alterações' : 'Adicionar lançamento'}</button></div>
  </form></div>
}

function AccountDialog({ onClose, onSubmit }: { onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="dialog-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog account-form" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="account-dialog-title">
    <div className="dialog-header"><div><div className="eyebrow">ORGANIZE SEU DINHEIRO</div><h2 id="account-dialog-title">Nova conta</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <label className="form-label">Nome da conta<input name="name" autoFocus maxLength={50} placeholder="Ex.: Conta principal" required /></label>
    <div className="form-two-columns"><label className="form-label">Tipo<select name="type">{accountTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}</select></label><label className="form-label">Saldo inicial<input name="balance" type="number" step="0.01" placeholder="0,00" defaultValue="0" required /></label></div>
    <label className="form-label">Cor de identificação<input name="color" type="color" className="color-input" defaultValue="#5ee1a0" /></label>
    <p className="form-hint">O saldo inicial é combinado com os lançamentos vinculados a esta conta. Informe valores reais; não conectamos automaticamente a bancos.</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={16} /> Criar conta</button></div>
  </form></div>
}

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? ''
const supabaseKey = (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY)?.trim() ?? ''
let supabaseClientPromise: Promise<SupabaseClient> | null = null

async function callAdminMonitoring<T>(action: string, payload: Record<string, unknown> = {}, token = supabaseKey): Promise<T> {
  const response = await fetch(`${supabaseUrl}/functions/v1/admin-monitoring`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseKey,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action, ...payload }),
  })
  let result: unknown
  try {
    result = await response.json()
  } catch {
    throw new Error('O serviço administrativo retornou uma resposta inválida.')
  }
  if (!response.ok) {
    const message = result && typeof result === 'object' && 'error' in result && typeof result.error === 'string'
      ? result.error
      : 'Não foi possível concluir a solicitação administrativa.'
    throw new Error(message)
  }
  return result as T
}

type AdminPresenceUser = {
  userId: string
  email: string
  lastLoginAt: string | null
  lastSeenAt: string
  online: boolean
}

type AdminDashboardData = {
  users: AdminPresenceUser[]
  onlineCount: number
  trackedCount: number
  generatedAt: string
}

function loadSupabaseClient(url: string, keyValue: string) {
  if (!supabaseClientPromise) {
    supabaseClientPromise = import('@supabase/supabase-js').then(({ createClient }) => createClient(url, keyValue))
  }
  return supabaseClientPromise
}

function AdminPanel() {
  const [adminToken, setAdminToken] = useState('')
  const [dashboard, setDashboard] = useState<AdminDashboardData | null>(null)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!adminToken) return
    let active = true
    const refresh = async () => {
      setRefreshing(true)
      try {
        const result = await callAdminMonitoring<AdminDashboardData>('dashboard', {}, adminToken)
        if (active) {
          setDashboard(result)
          setError('')
        }
      } catch (issue) {
        if (!active) return
        const message = issue instanceof Error ? issue.message : 'Não foi possível atualizar o painel.'
        setError(message)
        if (message.includes('expirou')) setAdminToken('')
      } finally {
        if (active) setRefreshing(false)
      }
    }
    void refresh()
    const interval = window.setInterval(() => void refresh(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [adminToken, refreshNonce])

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const username = String(form.get('username') ?? '').trim()
    const password = String(form.get('password') ?? '')
    if (!username || !password) {
      setError('Informe o usuário e a senha administrativa.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const session = await callAdminMonitoring<{ token: string; expiresAt: string }>('login', { username, password })
      setAdminToken(session.token)
      setDashboard(null)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Não foi possível entrar no painel.')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    const token = adminToken
    setAdminToken('')
    setDashboard(null)
    setError('')
    try {
      await callAdminMonitoring<{ loggedOut: boolean }>('logout', {}, token)
    } catch (issue) {
      setError(issue instanceof Error ? issue.message : 'Não foi possível encerrar a sessão administrativa.')
    }
  }

  const dateTime = (value: string | null) => value
    ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value))
    : 'Não registrado desde a ativação'

  if (!adminToken) return <section className="panel admin-login-card">
    <div className="admin-heading"><span className="admin-icon"><ShieldCheck size={19} /></span><div><h2>Acesso administrativo</h2><p>Entre com as credenciais configuradas nos secrets do Supabase.</p></div></div>
    <form className="admin-login-form" onSubmit={(event) => void signIn(event)}>
      <label className="form-label">Usuário<input name="username" autoComplete="username" maxLength={100} required /></label>
      <label className="form-label">Senha<input name="password" type="password" autoComplete="current-password" required /></label>
      {error && <p className="cloud-error" role="alert">{error}</p>}
      <button className="button button-primary" type="submit" disabled={busy}><ShieldCheck size={15} />{busy ? 'Validando…' : 'Entrar no painel'}</button>
    </form>
    <p className="admin-footnote">As credenciais são validadas no servidor. O navegador não salva a senha e a sessão administrativa expira em duas horas.</p>
  </section>

  return <div className="admin-dashboard">
    <section className="admin-header panel">
      <div className="admin-heading"><span className="admin-icon"><ShieldCheck size={19} /></span><div><h2>Monitoramento de acessos</h2><p>Presença atualizada automaticamente a cada 30 segundos.</p></div></div>
      <div className="admin-actions"><button className="button button-secondary" disabled={refreshing} onClick={() => setRefreshNonce((value) => value + 1)}><RefreshCw size={14} className={refreshing ? 'admin-spinning' : ''} /> Atualizar</button><button className="button button-secondary" onClick={() => void signOut()}><LogOut size={14} /> Sair do painel</button></div>
    </section>
    {error && <p className="cloud-error admin-error" role="alert">{error}</p>}
    <div className="admin-stats">
      <article className="panel admin-stat"><span className="admin-stat-icon online"><Users size={16} /></span><div><small>Ativos agora</small><strong>{dashboard?.onlineCount ?? '—'}</strong></div><span>Atividade nos últimos 2 min</span></article>
      <article className="panel admin-stat"><span className="admin-stat-icon"><Users size={16} /></span><div><small>Usuários monitorados</small><strong>{dashboard?.trackedCount ?? '—'}</strong></div><span>Desde a ativação do monitoramento</span></article>
    </div>
    <section className="panel admin-users-panel">
      <div className="admin-users-heading"><div><h2>Usuários com atividade registrada</h2><p>E-mail, horário do último login e atividade recente.</p></div><span>{dashboard ? `Atualizado ${dateTime(dashboard.generatedAt)}` : 'Carregando…'}</span></div>
      {!dashboard ? <div className="admin-empty">Carregando acessos…</div> : dashboard.users.length === 0 ? <div className="admin-empty">Ainda não há acessos registrados desde a ativação do monitoramento.</div> : <div className="admin-user-list">
        {dashboard.users.map((user) => <article className="admin-user-row" key={user.userId}>
          <span className={`admin-presence-dot ${user.online ? 'online' : ''}`} aria-label={user.online ? 'Ativo' : 'Inativo'} />
          <strong>{user.email}</strong>
          <span className="admin-user-login"><small>Último login</small>{dateTime(user.lastLoginAt)}</span>
          <span className="admin-user-login"><small>Última atividade</small>{dateTime(user.lastSeenAt)}</span>
          <span className={`admin-user-status ${user.online ? 'online' : ''}`}>{user.online ? 'Ativo' : 'Inativo'}</span>
        </article>)}
      </div>}
    </section>
    <p className="admin-footnote">“Ativo” significa que houve interação com o site nos últimos 2 minutos. O histórico começa quando o monitoramento é ativado; acessos anteriores não são recuperados. Senhas dos usuários não são coletadas nem exibidas.</p>
  </div>
}

function CloudApp({ client }: { client: SupabaseClient }) {
  const [user, setUser] = useState<User | null>(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [presenceError, setPresenceError] = useState('')
  const [cloudData, setCloudData] = useState<AppData | null>(null)
  const [cloudLoading, setCloudLoading] = useState(false)
  const [cloudError, setCloudError] = useState('')
  const [syncError, setSyncError] = useState('')
  const [syncStatus, setSyncStatus] = useState('NUVEM')
  const [pendingImport, setPendingImport] = useState<AppData | null>(null)
  const [migrationBusy, setMigrationBusy] = useState(false)
  const saveQueue = useRef<Promise<void>>(Promise.resolve())

  useEffect(() => {
    let active = true
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      if (active) {
        setUser(session?.user ?? null)
        setAuthReady(true)
        if (event === 'SIGNED_IN' && session) {
          window.setTimeout(() => {
            if (!active) return
            void callAdminMonitoring<{ recorded: boolean }>('presence', { event: 'login' }, session.access_token)
              .then(() => setPresenceError(''))
              .catch(() => setPresenceError('Não foi possível registrar seu acesso no monitoramento. Tente atualizar a página.'))
          }, 0)
        }
      }
    })
    void client.auth.getSession().then(({ data, error }) => {
      if (!active) return
      if (error) setAuthError(`Não foi possível verificar a sessão: ${error.message}`)
      setUser(data.session?.user ?? null)
      setAuthReady(true)
    })
    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [client])

  useEffect(() => {
    if (!user) {
      setPresenceError('')
      return
    }
    let active = true
    let lastInteraction = Date.now()
    const markInteraction = () => { lastInteraction = Date.now() }
    const sendHeartbeat = async (force = false) => {
      if (!active || document.visibilityState !== 'visible' || (!force && Date.now() - lastInteraction > 90_000)) return
      try {
        const { data, error } = await client.auth.getSession()
        if (error) throw error
        const session = data.session
        if (!session || session.user.id !== user.id) return
        await callAdminMonitoring<{ recorded: boolean }>('presence', { event: 'heartbeat' }, session.access_token)
        if (active) setPresenceError('')
      } catch {
        if (active) setPresenceError('Não foi possível atualizar seu status de atividade.')
      }
    }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markInteraction()
        void sendHeartbeat(true)
      }
    }
    window.addEventListener('pointerdown', markInteraction, { passive: true })
    window.addEventListener('keydown', markInteraction)
    document.addEventListener('visibilitychange', onVisibilityChange)
    void sendHeartbeat(true)
    const interval = window.setInterval(() => void sendHeartbeat(), 30_000)
    return () => {
      active = false
      window.clearInterval(interval)
      window.removeEventListener('pointerdown', markInteraction)
      window.removeEventListener('keydown', markInteraction)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [client, user])

  const writeCloudData = async (userId: string, value: AppData) => {
    const { error } = await client.from('user_finance_data').upsert({
      user_id: userId,
      data: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })
    if (error) throw new Error(error.message)
  }

  useEffect(() => {
    if (!authReady || !user) {
      setCloudData(null)
      setPendingImport(null)
      setCloudLoading(false)
      return
    }

    let active = true
    const userId = user.id
    const userCacheKey = `${STORAGE_KEY}:${userId}`
    setCloudLoading(true)
    setCloudError('')
    setCloudData(null)
    setPendingImport(null)

    const initialize = async () => {
      try {
        const { data: row, error } = await client
          .from('user_finance_data')
          .select('data')
          .eq('user_id', userId)
          .maybeSingle()
        if (error) throw new Error(error.message)
        if (!active) return
        if (row) {
          const parsed = parseAppData(row.data)
          localStorage.setItem(userCacheKey, JSON.stringify(parsed))
          localStorage.setItem(`${STORAGE_KEY}:migration-reviewed`, 'true')
          setCloudData(parsed)
          setCloudLoading(false)
          setSyncStatus('NUVEM')
          return
        }

        const cached = localStorage.getItem(userCacheKey)
        if (cached) {
          const parsed = parseAppData(JSON.parse(cached) as unknown)
          await writeCloudData(userId, parsed)
          if (!active) return
          localStorage.setItem(`${STORAGE_KEY}:migration-reviewed`, 'true')
          setCloudData(parsed)
          setCloudLoading(false)
          setSyncStatus('NUVEM')
          return
        }

        const legacy = localStorage.getItem(STORAGE_KEY)
        const alreadyReviewedLocalData = localStorage.getItem(`${STORAGE_KEY}:migration-reviewed`) === 'true'
        if (legacy && !alreadyReviewedLocalData) {
          const parsed = parseAppData(JSON.parse(legacy) as unknown)
          const hasFinancialData = parsed.accounts.length > 0
            || parsed.transactions.length > 0
            || parsed.debts.length > 0
            || parsed.bills.length > 0
            || parsed.calendarEvents.length > 0
            || parsed.savingsGoals.length > 0
          if (hasFinancialData) {
            setPendingImport(parsed)
            setCloudLoading(false)
            return
          }
        }

        const fresh = emptyData()
        await writeCloudData(userId, fresh)
        if (!active) return
        localStorage.setItem(`${STORAGE_KEY}:migration-reviewed`, 'true')
        setCloudData(fresh)
        setCloudLoading(false)
        setSyncStatus('NUVEM')
      } catch (error) {
        if (!active) return
        const rawMessage = error instanceof Error ? error.message : 'Não foi possível carregar os dados da nuvem.'
        const message = rawMessage.includes('PGRST205') || rawMessage.includes("Could not find the table 'public.user_finance_data'")
          ? 'A tabela user_finance_data não foi encontrada no projeto configurado. Execute supabase/schema.sql no SQL Editor deste mesmo projeto.'
          : rawMessage
        try {
          const cached = localStorage.getItem(userCacheKey)
          if (cached) {
            setCloudData(parseAppData(JSON.parse(cached) as unknown))
            setSyncError(`Sem conexão com a nuvem. As alterações ficarão neste dispositivo até a conexão voltar. ${message}`)
            setSyncStatus('OFFLINE')
          } else {
            setCloudError(message)
          }
        } catch (cacheError) {
          setCloudError(cacheError instanceof Error ? `${message} Cache local inválido: ${cacheError.message}` : message)
        }
        setCloudLoading(false)
      }
    }

    void initialize()
    return () => { active = false }
  }, [authReady, client, user])

  const finishLocalImport = async (value: AppData) => {
    if (!user) return
    setMigrationBusy(true)
    setCloudError('')
    try {
      await writeCloudData(user.id, value)
      localStorage.setItem(`${STORAGE_KEY}:${user.id}`, JSON.stringify(value))
      localStorage.setItem(`${STORAGE_KEY}:migration-reviewed`, 'true')
      setCloudData(value)
      setPendingImport(null)
      setSyncStatus('NUVEM')
    } catch (error) {
      setCloudError(error instanceof Error ? `Não foi possível concluir a migração: ${error.message}` : 'Não foi possível concluir a migração.')
    } finally {
      setMigrationBusy(false)
    }
  }

  const queueCloudSave = (userId: string, value: AppData) => {
    setSyncStatus('SALVANDO')
    saveQueue.current = saveQueue.current
      .catch(() => undefined)
      .then(() => writeCloudData(userId, value))
      .then(() => {
        setSyncError('')
        setSyncStatus('NUVEM')
      })
      .catch((error: unknown) => {
        setSyncStatus('ERRO NA NUVEM')
        setSyncError(error instanceof Error
          ? `Falha ao sincronizar. Os dados permanecem neste dispositivo; tente novamente. ${error.message}`
          : 'Falha ao sincronizar. Os dados permanecem neste dispositivo.')
      })
  }

  const handleCloudPersist = (next: AppData) => {
    if (!user) return
    setCloudData(next)
    try {
      localStorage.setItem(`${STORAGE_KEY}:${user.id}`, JSON.stringify(next))
    } catch (error) {
      setSyncError(error instanceof Error ? `O cache local não pôde ser atualizado: ${error.message}` : 'O cache local não pôde ser atualizado.')
    }
    queueCloudSave(user.id, next)
  }

  const retryCloudSync = () => {
    if (!user || !cloudData) return
    setSyncError('')
    queueCloudSave(user.id, cloudData)
  }

  const signOut = async () => {
    setCloudData(null)
    setPendingImport(null)
    setSyncError('')
    const { error } = await client.auth.signOut()
    if (error) setAuthError(`Não foi possível sair da conta: ${error.message}`)
  }

  if (!authReady) return <CloudStatusScreen message="Verificando sua sessão segura…" />
  if (!user) return <CloudAuthScreen client={client} error={authError} onError={setAuthError} />
  if (cloudLoading) return <CloudStatusScreen message="Carregando seus dados da nuvem…" />
  if (pendingImport) {
    return <section className="cloud-gate">
      <div className="cloud-card">
        <div className="brand-mark"><Wallet size={22} /></div>
        <div className="eyebrow">MIGRAÇÃO SEGURA</div>
        <h1>Encontramos dados neste navegador</h1>
        <p>Há {pendingImport.accounts.length} bancos, {pendingImport.transactions.length} lançamentos e {pendingImport.savingsGoals.length} objetivos locais. Eles ainda não foram enviados.</p>
        {cloudError && <p className="cloud-error" role="alert">{cloudError}</p>}
        <button className="button button-primary cloud-submit" disabled={migrationBusy} onClick={() => void finishLocalImport(pendingImport)}>
          {migrationBusy ? 'Enviando com segurança…' : 'Migrar estes dados para minha conta'}
        </button>
        <button className="button button-secondary cloud-submit" disabled={migrationBusy} onClick={() => void finishLocalImport(emptyData())}>
          Começar com uma conta vazia
        </button>
        <p className="cloud-footnote">A migração só acontece após sua escolha. Se optar por começar vazio, os dados antigos deste navegador não serão enviados.</p>
        <button className="cloud-text-button" onClick={() => void signOut()}>Sair da conta</button>
      </div>
    </section>
  }
  if (cloudError && !cloudData) {
    return <CloudStatusScreen message={`Não foi possível abrir os dados da nuvem: ${cloudError}`} action="Tentar novamente" onAction={() => {
      setCloudError('')
      setAuthReady(false)
      void client.auth.getSession().then(({ data }) => {
        setUser(data.session?.user ?? null)
        setAuthReady(true)
      })
    }} secondaryAction="Sair da conta" onSecondaryAction={() => void signOut()} />
  }
  if (!cloudData) return <CloudStatusScreen message="Preparando seu espaço financeiro…" />
  return <FinanceApp
    key={user.id}
    initialData={cloudData}
    cloudUser={user.id}
    cloudLabel={user.email ?? 'Minha conta'}
    cloudSyncStatus={syncStatus}
    cloudSyncError={syncError}
    presenceError={presenceError}
    adminClient={client}
    onCloudPersist={handleCloudPersist}
    onRetrySync={retryCloudSync}
    onSignOut={() => void signOut()}
  />
}

function CloudAuthScreen({ client, error, onError }: { client: SupabaseClient; error: string; onError: (message: string) => void }) {
  const [signUp, setSignUp] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '').trim()
    const password = String(form.get('password') ?? '')
    onError('')
    setMessage('')
    if (signUp && password.length < 8) {
      onError('A senha deve ter pelo menos 8 caracteres.')
      return
    }
    setBusy(true)
    try {
      if (signUp) {
        const { data, error: signUpError } = await client.auth.signUp({ email, password })
        if (signUpError) throw signUpError
        if (!data.session) setMessage('Conta criada. Verifique seu e-mail para confirmar o cadastro e depois entre.')
      } else {
        const { error: signInError } = await client.auth.signInWithPassword({ email, password })
        if (signInError) throw signInError
      }
    } catch (authIssue) {
      onError(authIssue instanceof Error ? authIssue.message : 'Não foi possível concluir a autenticação.')
    } finally {
      setBusy(false)
    }
  }

  return <section className="cloud-gate">
    <div className="cloud-auth-layout">
      <div className="cloud-intro">
        <div className="cloud-brand"><span className="brand-mark"><Wallet size={22} /></span><span><strong>nexus</strong><small>FINANCE</small></span></div>
        <div className="cloud-intro-copy">
          <div className="cloud-intro-eyebrow"><span /> SUA VIDA FINANCEIRA, EM EQUILÍBRIO</div>
          <h1>Organize sua vida financeira.<br /><em>Viva seus planos.</em></h1>
          <p>Tenha clareza sobre seu dinheiro, acompanhe suas contas e transforme objetivos em próximos passos.</p>
        </div>
        <div className="cloud-feature-list">
          <div><span className="cloud-feature-icon"><Wallet size={17} /></span><span><strong>Contas em ordem</strong><small>Veja seus saldos e movimentações em um só lugar.</small></span></div>
          <div><span className="cloud-feature-icon"><Target size={17} /></span><span><strong>Objetivos que avançam</strong><small>Organize suas reservas no seu ritmo.</small></span></div>
          <div><span className="cloud-feature-icon"><TrendingUp size={17} /></span><span><strong>Mais clareza, sempre</strong><small>Acompanhe sua jornada financeira com confiança.</small></span></div>
        </div>
        <div className="cloud-visual" aria-hidden="true">
          <div className="cloud-orbit cloud-orbit-one" />
          <div className="cloud-orbit cloud-orbit-two" />
          <div className="cloud-visual-glow" />
          <div className="cloud-visual-card cloud-visual-main">
            <div className="cloud-visual-card-top"><span className="cloud-mini-mark"><Wallet size={15} /></span><span>SEU ESPAÇO FINANCEIRO</span><span className="cloud-live-dot" /></div>
            <div className="cloud-visual-heading">Tudo no seu ritmo.</div>
            <div className="cloud-visual-bars"><span /><span /><span /><span /><span /><span /><span /></div>
            <div className="cloud-visual-legend"><i /><span>Organização</span><i /><span>Objetivos</span></div>
          </div>
          <div className="cloud-visual-card cloud-visual-note"><span className="cloud-feature-icon"><Target size={16} /></span><span><strong>Planos com propósito</strong><small>Um passo de cada vez</small></span><Check size={16} /></div>
        </div>
        <div className="cloud-privacy-line"><span><Check size={13} /></span> Seus dados protegidos e sincronizados com segurança.</div>
      </div>
      <form className="cloud-card" onSubmit={(event) => void submit(event)}>
        <div className="cloud-form-heading">
          <div className="cloud-form-icon"><Wallet size={19} /></div>
          <div className="eyebrow">NEXUS FINANCE · ACESSO SEGURO</div>
          <h2>{signUp ? 'Comece por você.' : 'Bom ter você de volta.'}</h2>
          <p>{signUp ? 'Crie sua conta e comece a organizar seus planos.' : 'Entre para continuar sua jornada financeira.'}</p>
        </div>
        <label className="form-label">E-mail<input type="email" name="email" autoComplete="email" placeholder="voce@email.com" required /></label>
        <label className="form-label">Senha<input type="password" name="password" autoComplete={signUp ? 'new-password' : 'current-password'} minLength={signUp ? 8 : 1} placeholder={signUp ? 'Pelo menos 8 caracteres' : 'Sua senha'} required /></label>
        {message && <p className="cloud-success" role="status">{message}</p>}
        {error && <p className="cloud-error" role="alert">{error}</p>}
        <button className="button button-primary cloud-submit" type="submit" disabled={busy}>
          {busy ? 'Aguarde…' : signUp ? 'Criar minha conta' : 'Entrar na minha conta'}
        </button>
        <button className="cloud-text-button" type="button" onClick={() => { setSignUp((value) => !value); onError(''); setMessage('') }}>
          {signUp ? 'Já tenho uma conta · Entrar' : 'Ainda não tenho conta · Criar cadastro'}
        </button>
        <div className="cloud-form-secure"><span><Check size={12} /></span> Acesso privado, protegido e sincronizado.</div>
        <p className="cloud-monitoring-notice">Para segurança e administração, registramos o e-mail da conta, o horário do último login e a atividade recente no site. Esses dados ficam protegidos e são visíveis somente no painel administrativo autorizado. Nunca coletamos nem exibimos sua senha.</p>
      </form>
    </div>
  </section>
}

function CloudStatusScreen({ message, action, onAction, secondaryAction, onSecondaryAction }: { message: string; action?: string; onAction?: () => void; secondaryAction?: string; onSecondaryAction?: () => void }) {
  return <main className="cloud-gate"><div className="cloud-card"><div className="brand-mark"><Wallet size={22} /></div><h1>Nexus Finance</h1><p>{message}</p>{action && onAction && <button className="button button-primary cloud-submit" onClick={onAction}>{action}</button>}{secondaryAction && onSecondaryAction && <button className="cloud-text-button" onClick={onSecondaryAction}>{secondaryAction}</button>}</div></main>
}

function CloudLoader({ url, keyValue }: { url: string; keyValue: string }) {
  const [client, setClient] = useState<SupabaseClient | null>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let active = true
    void loadSupabaseClient(url, keyValue).then((loadedClient) => {
      if (active) setClient(loadedClient)
    }).catch((loadError: unknown) => {
      if (active) setError(loadError instanceof Error ? loadError.message : 'Não foi possível iniciar o cliente Supabase.')
    })
    return () => { active = false }
  }, [url, keyValue])
  if (error) return <CloudStatusScreen message={`Não foi possível iniciar a conexão Supabase: ${error}`} />
  return client ? <CloudApp client={client} /> : <CloudStatusScreen message="Iniciando conexão segura com a nuvem…" />
}

function App() {
  const hasCloudConfig = Boolean(supabaseUrl || supabaseKey)
  if (hasCloudConfig && (!supabaseUrl || !supabaseKey)) {
    return <CloudStatusScreen message="A configuração do Supabase está incompleta. Defina VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY (ou VITE_SUPABASE_ANON_KEY) e reinicie o servidor." />
  }
  return supabaseUrl && supabaseKey ? <CloudLoader url={supabaseUrl} keyValue={supabaseKey} /> : <FinanceApp />
}

export default App
