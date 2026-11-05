import { useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import {
  Archive,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Award,
  Banknote,
  Bike,
  BookOpen,
  CalendarDays,
  CarFront,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Coffee,
  Compass,
  GraduationCap,
  Heart,
  House,
  Laptop,
  Lightbulb,
  ListFilter,
  LockKeyhole,
  PartyPopper,
  PiggyBank,
  Plane,
  Plus,
  Search,
  Shield,
  Sparkles,
  Target,
  Trophy,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react'
import type {
  SavingsAchievement,
  SavingsCategory,
  SavingsFrequency,
  SavingsGoal,
  SavingsMovement,
  SavingsMovementType,
  SavingsSchedule,
} from './savingsModel'
import { savingsBalance, savingsCategories, savingsFrequencies, savingsDateString } from './savingsModel'

type AccountOption = { id: string; name: string; color: string; openingBalanceCents: number }
type GoalPageData = {
  goals: SavingsGoal[]
  schedules: SavingsSchedule[]
  achievements: SavingsAchievement[]
  transactions: {
    id: string
    description: string
    amountCents: number
    type: 'income' | 'expense' | 'transfer-in' | 'transfer-out'
    category: string
    date: string
    accountId: string
    sourceGoalMovementId?: string
  }[]
}

const iconOptions = [
  { value: 'target', label: 'Alvo', Icon: Target },
  { value: 'plane', label: 'Avião', Icon: Plane },
  { value: 'bike', label: 'Moto', Icon: Bike },
  { value: 'car', label: 'Carro', Icon: CarFront },
  { value: 'house', label: 'Casa', Icon: House },
  { value: 'shield', label: 'Proteção', Icon: Shield },
  { value: 'book', label: 'Livro', Icon: BookOpen },
  { value: 'graduation', label: 'Estudos', Icon: GraduationCap },
  { value: 'laptop', label: 'Tecnologia', Icon: Laptop },
  { value: 'heart', label: 'Bem-estar', Icon: Heart },
  { value: 'compass', label: 'Aventura', Icon: Compass },
  { value: 'sparkles', label: 'Sonho', Icon: Sparkles },
  { value: 'piggy', label: 'Cofrinho', Icon: PiggyBank },
  { value: 'coffee', label: 'Lazer', Icon: Coffee },
  { value: 'lightbulb', label: 'Ideia', Icon: Lightbulb },
  { value: 'wallet', label: 'Carteira', Icon: Wallet },
]
const colorOptions = ['#55d6a2', '#8f7cf6', '#f3ae5b', '#64a6ff', '#f07586', '#42c7c4', '#d982df', '#8dbf57']
const achievementDefinitions = [
  { id: 'first-deposit', title: 'O primeiro passo', description: 'Fez seu primeiro depósito.', Icon: PiggyBank },
  { id: 'saved-100', title: 'Ritmo constante', description: 'Guardou R$ 100 em depósitos.', Icon: Banknote },
  { id: 'saved-1000', title: 'Mil em movimento', description: 'Guardou R$ 1.000 em depósitos.', Icon: TrendingUp },
  { id: 'first-complete', title: 'Sonho realizado', description: 'Concluiu seu primeiro objetivo.', Icon: Trophy },
  { id: 'streak-30', title: 'Constância que inspira', description: 'Economizou por 30 dias consecutivos.', Icon: Award },
]

function currency(cents: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100)
}

function dateLabel(date: string, options: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' }) {
  const [year, month, day] = date.split('-').map(Number)
  return new Intl.DateTimeFormat('pt-BR', options).format(new Date(year, month - 1, day, 12))
}

function dayDifference(from: string, to: string) {
  const [fy, fm, fd] = from.split('-').map(Number)
  const [ty, tm, td] = to.split('-').map(Number)
  return Math.round((Date.UTC(ty, tm - 1, td) - Date.UTC(fy, fm - 1, fd)) / 86_400_000)
}

function amountCents(value: number) {
  return Math.round(value * 100)
}

function parseCurrencyAmount(value: string) {
  const normalized = value.trim().replace(/^R\$\s*/i, '').replace(/\s/g, '')
  if (!normalized) return Number.NaN

  if (normalized.includes(',')) {
    if (!/^(?:\d+|\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?$/.test(normalized)) return Number.NaN
    return Number(normalized.replace(/\./g, '').replace(',', '.'))
  }

  if (/^\d{1,3}(?:\.\d{3})+$/.test(normalized)) return Number(normalized.replace(/\./g, ''))
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return Number.NaN
  return Number(normalized)
}

function currencyInputValue(cents: number) {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100)
}

function safeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) return Promise.reject(new Error('Selecione um arquivo de imagem válido.'))
  if (file.size > 500 * 1024) return Promise.reject(new Error('A imagem deve ter no máximo 500 KB para manter o armazenamento local leve.'))
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Não foi possível ler a imagem.'))
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'))
    reader.readAsDataURL(file)
  })
}

function getIcon(name: string) {
  return iconOptions.find((option) => option.value === name)?.Icon ?? Target
}

function goalProgress(goal: SavingsGoal) {
  return goal.targetCents > 0 ? Math.min(100, Math.round((savingsBalance(goal) / goal.targetCents) * 100)) : 0
}

export function unlockedFor(goals: SavingsGoal[], current: SavingsAchievement[], now: Date): SavingsAchievement[] {
  const existing = new Set(current.map((item) => item.id))
  const deposits = goals.flatMap((goal) => goal.movements.filter((movement) => movement.type === 'deposit'))
  const totalDeposited = deposits.reduce((sum, movement) => sum + movement.amountCents, 0)
  const completeGoals = goals.filter((goal) => savingsBalance(goal) >= goal.targetCents)
  const candidates: SavingsAchievement[] = []
  const add = (id: string, goalId?: string) => {
    if (!existing.has(id)) candidates.push({ id, achievedAt: now.toISOString(), ...(goalId ? { goalId } : {}) })
  }
  if (deposits.length) add('first-deposit')
  if (totalDeposited >= 10_000) add('saved-100')
  if (totalDeposited >= 100_000) add('saved-1000')
  if (completeGoals.length) add('first-complete')
  const depositDates = [...new Set(deposits.map((movement) => movement.date))].sort()
  let streak = 0
  let previousDate = ''
  for (const date of depositDates) {
    streak = previousDate && dayDifference(previousDate, date) === 1 ? streak + 1 : 1
    if (streak >= 30) break
    previousDate = date
  }
  if (streak >= 30) add('streak-30')
  for (const goal of goals) {
    const balance = savingsBalance(goal)
    if (balance >= goal.targetCents * 0.25) add(`${goal.id}:25`, goal.id)
    if (balance >= goal.targetCents * 0.5) add(`${goal.id}:50`, goal.id)
    if (balance >= goal.targetCents * 0.75) add(`${goal.id}:75`, goal.id)
  }
  return candidates
}

function monthlyRate(goal: SavingsGoal) {
  const rate = (goal.yieldRateBps ?? 0) / 10_000
  if (!rate) return 0
  return goal.yieldPeriod === 'yearly' ? Math.pow(1 + rate, 1 / 12) - 1 : rate
}

function monthlyScheduleAmount(schedules: SavingsSchedule[], goalId: string) {
  return schedules.filter((item) => item.goalId === goalId && item.active).reduce((sum, item) => {
    const multiplier = item.frequency === 'daily' ? 30.4375 : item.frequency === 'weekly' ? 4.348 : item.frequency === 'biweekly' ? 2.174 : 1
    return sum + item.amountCents * multiplier
  }, 0)
}

function projection(goal: SavingsGoal, schedules: SavingsSchedule[], today: string) {
  const balance = savingsBalance(goal)
  const scheduledMonthlyDeposit = monthlyScheduleAmount(schedules, goal.id)
  const elapsedMonths = Math.max(1, Math.ceil(dayDifference(goal.startDate, today) / 30.4375))
  const historicalMonthlyDeposit = goal.movements
    .filter((movement) => movement.type === 'deposit')
    .reduce((sum, movement) => sum + movement.amountCents, 0) / elapsedMonths
  const monthlyDeposit = scheduledMonthlyDeposit || historicalMonthlyDeposit
  const months = Math.max(0, Math.ceil(dayDifference(today, goal.targetDate) / 30.4375))
  const rate = monthlyRate(goal)
  let withYield = balance
  for (let month = 0; month < months; month += 1) withYield = (withYield + monthlyDeposit) * (1 + rate)
  const withoutYield = balance + monthlyDeposit * months
  let estimatedMonths: number | null = null
  if (balance >= goal.targetCents) estimatedMonths = 0
  else if (monthlyDeposit > 0 || rate > 0) {
    let projected = balance
    for (let month = 1; month <= 600; month += 1) {
      projected = (projected + monthlyDeposit) * (1 + rate)
      if (projected >= goal.targetCents) {
        estimatedMonths = month
        break
      }
    }
  }
  return { withYield: Math.round(withYield), withoutYield: Math.round(withoutYield), estimatedMonths, usesHistory: scheduledMonthlyDeposit === 0 && historicalMonthlyDeposit > 0 }
}

function evolutionPoints(goal: SavingsGoal) {
  const movements = [...goal.movements].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
  const points = [{ date: goal.startDate, balance: 0 }, ...movements.map((movement) => ({
    date: movement.date,
    balance: 0,
  }))]
  let balance = 0
  for (let index = 1; index < points.length; index += 1) {
    const movement = movements[index - 1]
    balance += movement.type === 'deposit' ? movement.amountCents : -movement.amountCents
    points[index].balance = balance
  }
  return points
}

export default function SavingsGoalsPage({
  goals,
  schedules,
  achievements,
  accounts,
  transactions,
  now,
  onSave,
  onToast,
  onCelebration,
}: {
  goals: SavingsGoal[]
  schedules: SavingsSchedule[]
  achievements: SavingsAchievement[]
  accounts: AccountOption[]
  transactions: GoalPageData['transactions']
  now: Date
  onSave: (data: GoalPageData) => void
  onToast: (message: string) => void
  onCelebration: (goalName: string) => void
}) {
  const today = savingsDateString(now)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [goalDialog, setGoalDialog] = useState<SavingsGoal | 'new' | null>(null)
  const [movementDialog, setMovementDialog] = useState<{ goal: SavingsGoal; type: SavingsMovementType; movement?: SavingsMovement } | null>(null)
  const [scheduleDialog, setScheduleDialog] = useState<SavingsGoal | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('active')
  const [sort, setSort] = useState('recent')
  const [historyFilter, setHistoryFilter] = useState('all')
  const [goalToast, setGoalToast] = useState('')
  const selectedGoal = goals.find((goal) => goal.id === selectedId) ?? null
  const allBalance = goals.reduce((sum, goal) => sum + savingsBalance(goal), 0)
  const totalTarget = goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + goal.targetCents, 0)
  const activeGoals = goals.filter((goal) => !goal.archived && savingsBalance(goal) < goal.targetCents).length
  const completedGoals = goals.filter((goal) => savingsBalance(goal) >= goal.targetCents).length
  const generalProgress = totalTarget ? Math.min(100, Math.round((goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + Math.min(goal.targetCents, savingsBalance(goal)), 0) / totalTarget) * 100)) : 0
  const remainingTotal = goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + Math.max(0, goal.targetCents - savingsBalance(goal)), 0)
  const orderedGoals = useMemo(() => {
    const normalized = search.trim().toLocaleLowerCase('pt-BR')
    const result = goals.filter((goal) => {
      const progress = goalProgress(goal)
      const matchesSearch = !normalized || `${goal.name} ${goal.description} ${goal.category} ${goal.customCategory ?? ''}`.toLocaleLowerCase('pt-BR').includes(normalized)
      const matchesCategory = categoryFilter === 'all' || goal.category === categoryFilter
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && !goal.archived && progress < 100)
        || (statusFilter === 'completed' && progress >= 100)
        || (statusFilter === 'archived' && goal.archived)
      return matchesSearch && matchesCategory && matchesStatus
    })
    return result.sort((a, b) => {
      if (sort === 'balance') return savingsBalance(b) - savingsBalance(a)
      if (sort === 'progress') return goalProgress(b) - goalProgress(a)
      if (sort === 'least-progress') return goalProgress(a) - goalProgress(b)
      if (sort === 'near') return goalProgress(b) - goalProgress(a) || a.targetDate.localeCompare(b.targetDate)
      if (sort === 'completed') return Number(savingsBalance(b) >= b.targetCents) - Number(savingsBalance(a) >= a.targetCents)
      return b.createdAt.localeCompare(a.createdAt)
    })
  }, [goals, search, categoryFilter, statusFilter, sort])

  const persist = (nextGoals: SavingsGoal[], nextSchedules: SavingsSchedule[], nextTransactions = transactions, nextAchievements = achievements) => {
    onSave({ goals: nextGoals, schedules: nextSchedules, transactions: nextTransactions, achievements: nextAchievements })
  }

  const withNewAchievements = (nextGoals: SavingsGoal[], nextSchedules: SavingsSchedule[], nextTransactions: GoalPageData['transactions'], completionName?: string) => {
    const newlyUnlocked = unlockedFor(nextGoals, achievements, now)
    persist(nextGoals, nextSchedules, nextTransactions, [...achievements, ...newlyUnlocked])
    if (newlyUnlocked.length) {
      const labels = newlyUnlocked.map((item) => achievementDefinitions.find((definition) => definition.id === item.id)?.title ?? 'Marco de objetivo')
      setGoalToast(`Conquista${labels.length > 1 ? 's' : ''} desbloqueada${labels.length > 1 ? 's' : ''}: ${labels.join(', ')}.`)
      window.setTimeout(() => setGoalToast(''), 5000)
    }
    if (completionName) onCelebration(completionName)
  }

  const saveGoal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const name = String(form.get('name') ?? '').trim()
    const description = String(form.get('description') ?? '').trim()
    const category = String(form.get('category')) as SavingsCategory
    const customCategory = String(form.get('customCategory') ?? '').trim()
    const target = parseCurrencyAmount(String(form.get('target') ?? ''))
    const initialValue = String(form.get('initial') ?? '').trim()
    const initial = initialValue ? parseCurrencyAmount(initialValue) : 0
    const startDate = String(form.get('startDate') ?? '')
    const targetDate = String(form.get('targetDate') ?? '')
    const accountId = String(form.get('accountId') ?? '')
    const icon = String(form.get('icon') ?? 'target')
    const color = String(form.get('color') ?? colorOptions[0])
    const rate = String(form.get('yieldRate') ?? '').trim()
    const yieldRate = rate ? Number(rate.replace(',', '.')) : undefined
    const yieldPeriod = String(form.get('yieldPeriod') ?? 'monthly') as 'monthly' | 'yearly'
    const targetAmount = amountCents(target)
    const initialCents = amountCents(initial)
    const duplicate = goals.some((goal) => goal.id !== (goalDialog !== 'new' && goalDialog ? goalDialog.id : '') && goal.name.toLocaleLowerCase('pt-BR') === name.toLocaleLowerCase('pt-BR'))
    if (!name || !savingsCategories.includes(category) || (category === 'Personalizado' && !customCategory)
      || !Number.isSafeInteger(targetAmount) || targetAmount <= 0
      || !Number.isFinite(initial) || !Number.isSafeInteger(initialCents) || initialCents < 0
      || !isDate(startDate) || !isDate(targetDate) || targetDate < startDate
      || (initialCents > 0 && !accounts.some((account) => account.id === accountId))
      || (yieldRate !== undefined && (!Number.isFinite(yieldRate) || yieldRate < 0 || yieldRate > 1000))
      || !['monthly', 'yearly'].includes(yieldPeriod)) {
      onToast('Confira o nome, categoria, valores e datas do objetivo.')
      return
    }
    if (duplicate) {
      onToast('Já existe um objetivo com esse nome.')
      return
    }
    const editing = goalDialog !== 'new' && goalDialog ? goalDialog : null
    if (initialCents > 0 && !editing) {
      const account = accounts.find((item) => item.id === accountId)!
      const available = transactions.reduce((balance, transaction) => {
        if (transaction.accountId !== account.id) return balance
        return balance + (transaction.type === 'income' || transaction.type === 'transfer-in' ? transaction.amountCents : -transaction.amountCents)
      }, account.openingBalanceCents)
      if (available < initialCents) {
        onToast(`Saldo insuficiente em ${account.name}. Disponível: ${currency(available)}.`)
        return
      }
    }
    let coverImage = editing?.coverImage
    const imageFile = form.get('coverImage')
    if (imageFile instanceof File && imageFile.size > 0) {
      try {
        coverImage = await safeImage(imageFile)
      } catch (error) {
        onToast(error instanceof Error ? error.message : 'Não foi possível adicionar a imagem.')
        return
      }
    }
    if (form.get('removeCover') === 'on') coverImage = undefined
    const goalId = editing?.id ?? crypto.randomUUID()
    const createdAt = editing?.createdAt ?? now.toISOString()
    const initialMovement: SavingsMovement | null = !editing && initialCents > 0 ? {
      id: crypto.randomUUID(),
      type: 'deposit',
      amountCents: initialCents,
      date: startDate,
      createdAt,
      description: 'Depósito inicial',
      accountId,
      linkedTransactionId: crypto.randomUUID(),
    } : null
    const goal: SavingsGoal = {
      id: goalId,
      name,
      description,
      category,
      ...(category === 'Personalizado' ? { customCategory } : {}),
      icon,
      color,
      ...(coverImage ? { coverImage } : {}),
      targetCents: targetAmount,
      startDate,
      targetDate,
      archived: editing?.archived ?? false,
      createdAt,
      ...(yieldRate !== undefined && yieldRate > 0 ? { yieldRateBps: Math.round(yieldRate * 100), yieldPeriod } : {}),
      movements: initialMovement ? [initialMovement, ...(editing?.movements ?? [])] : editing?.movements ?? [],
    }
    let nextTransactions = transactions
    if (initialMovement) nextTransactions = [{
      id: initialMovement.linkedTransactionId,
      description: `${name} · depósito inicial`,
      amountCents: initialCents,
      type: 'transfer-out',
      category: 'Objetivos financeiros',
      date: startDate,
      accountId,
      sourceGoalMovementId: initialMovement.id,
    }, ...transactions]
    const nextGoals = editing ? goals.map((item) => item.id === editing.id ? goal : item) : [goal, ...goals]
    withNewAchievements(nextGoals, schedules, nextTransactions, initialMovement && initialCents >= targetAmount ? name : undefined)
    setGoalDialog(null)
    setSelectedId(goalId)
    onToast(editing ? 'Objetivo atualizado.' : 'Objetivo criado e saldo inicial transferido.')
  }

  const saveMovement = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!movementDialog) return
    const form = new FormData(event.currentTarget)
    const amount = parseCurrencyAmount(String(form.get('amount') ?? ''))
    const cents = amountCents(amount)
    const date = String(form.get('date') ?? '')
    const description = String(form.get('description') ?? '').trim()
    const accountId = String(form.get('accountId') ?? '')
    const { goal, type, movement: editing } = movementDialog
    const account = accounts.find((item) => item.id === (editing?.accountId ?? accountId))
    if (!Number.isFinite(amount) || !Number.isSafeInteger(cents) || cents <= 0 || !isDate(date) || !description || !account) {
      onToast('Informe um valor, data, descrição e banco válidos.')
      return
    }
    if (!editing && type === 'deposit') {
      const available = getAccountBalance(account.id)
      if (available < cents) {
        onToast(`Saldo insuficiente em ${account.name}. Disponível: ${currency(available)}.`)
        return
      }
    }
    if (editing && type === 'deposit' && cents > editing.amountCents && getAccountBalance(editing.accountId) < cents - editing.amountCents) {
      onToast(`Saldo insuficiente para aumentar este depósito. Disponível: ${currency(getAccountBalance(editing.accountId))}.`)
      return
    }
    const balanceWithoutEditing = savingsBalance(goal) + (editing ? (editing.type === 'deposit' ? -editing.amountCents : editing.amountCents) : 0)
    if (type === 'withdrawal' && cents > balanceWithoutEditing) {
      onToast(`O objetivo tem ${currency(balanceWithoutEditing)} disponíveis para retirada.`)
      return
    }
    if (editing && type === 'withdrawal' && cents < editing.amountCents && getAccountBalance(editing.accountId) < editing.amountCents - cents) {
      onToast(`Saldo bancário insuficiente para reduzir esta retirada. Disponível: ${currency(getAccountBalance(editing.accountId))}.`)
      return
    }
    const movement: SavingsMovement = editing
      ? { ...editing, amountCents: cents, date, description }
      : {
        id: crypto.randomUUID(),
        type,
        amountCents: cents,
        date,
        createdAt: now.toISOString(),
        description,
        accountId: account.id,
        linkedTransactionId: crypto.randomUUID(),
      }
    const updatedGoal = { ...goal, movements: editing ? goal.movements.map((item) => item.id === editing.id ? movement : item) : [movement, ...goal.movements] }
    const transaction = {
      id: movement.linkedTransactionId,
      description: `${goal.name} · ${description}`,
      amountCents: cents,
      type: (type === 'deposit' ? 'transfer-out' : 'transfer-in') as 'transfer-out' | 'transfer-in',
      category: 'Objetivos financeiros',
      date,
      accountId: movement.accountId,
      sourceGoalMovementId: movement.id,
    }
    const nextTransactions = editing
      ? transactions.map((item) => item.id === editing.linkedTransactionId ? transaction : item)
      : [transaction, ...transactions]
    const nextGoals = goals.map((item) => item.id === goal.id ? updatedGoal : item)
    const completedNow = savingsBalance(updatedGoal) >= updatedGoal.targetCents && savingsBalance(goal) < goal.targetCents
    withNewAchievements(nextGoals, schedules, nextTransactions, completedNow ? goal.name : undefined)
    setMovementDialog(null)
    onToast(editing ? 'Movimentação atualizada e saldo sincronizado.' : type === 'deposit' ? 'Depósito transferido para o objetivo.' : 'Retirada transferida para o banco.')
  }

  const removeMovement = (goal: SavingsGoal, movement: SavingsMovement) => {
    const account = accounts.find((item) => item.id === movement.accountId)
    if (!account) {
      onToast('O banco associado não existe; a movimentação foi mantida.')
      return
    }
    if (movement.type === 'withdrawal' && getAccountBalance(account.id) < movement.amountCents) {
      onToast(`Não é possível desfazer a retirada: ${account.name} tem apenas ${currency(getAccountBalance(account.id))} disponíveis.`)
      return
    }
    if (!window.confirm(`Excluir “${movement.description}” de ${currency(movement.amountCents)}? O saldo bancário vinculado também será atualizado.`)) return
    const updatedGoal = { ...goal, movements: goal.movements.filter((item) => item.id !== movement.id) }
    const nextGoals = goals.map((item) => item.id === goal.id ? updatedGoal : item)
    const nextSchedules = schedules.map((item) => item.runs.some((run) => run.movementId === movement.id)
      ? { ...item, runs: item.runs.map((run) => run.movementId === movement.id ? { ...run, status: 'reverted' as const } : run) }
      : item)
    const nextTransactions = transactions.filter((item) => item.id !== movement.linkedTransactionId)
    withNewAchievements(nextGoals, nextSchedules, nextTransactions, undefined)
    onToast('Movimentação excluída e saldos sincronizados.')
  }

  const saveSchedule = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!scheduleDialog) return
    const form = new FormData(event.currentTarget)
    const amount = parseCurrencyAmount(String(form.get('amount') ?? ''))
    const cents = amountCents(amount)
    const frequency = String(form.get('frequency')) as SavingsFrequency
    const startDate = String(form.get('startDate') ?? '')
    const endDate = String(form.get('endDate') ?? '')
    const accountId = String(form.get('accountId') ?? '')
    if (!Number.isSafeInteger(cents) || cents <= 0 || !savingsFrequencies.some((item) => item.value === frequency)
      || !isDate(startDate) || (endDate && (!isDate(endDate) || endDate < startDate))
      || startDate < today || !accounts.some((item) => item.id === accountId)) {
      onToast('Confira valor, frequência, banco e período do depósito programado. A data inicial precisa ser hoje ou futura.')
      return
    }
    const schedule: SavingsSchedule = {
      id: crypto.randomUUID(),
      goalId: scheduleDialog.id,
      amountCents: cents,
      frequency,
      startDate,
      ...(endDate ? { endDate } : {}),
      nextDate: startDate,
      accountId,
      active: true,
      runs: [],
    }
    persist(goals, [schedule, ...schedules])
    setScheduleDialog(null)
    onToast('Depósito recorrente programado. Os registros são locais, não transferências bancárias.')
  }

  const getAccountBalance = (accountId: string) => {
    const account = accounts.find((item) => item.id === accountId)
    if (!account) return 0
    return transactions.reduce((balance, transaction) => {
      if (transaction.accountId !== accountId) return balance
      return balance + (transaction.type === 'income' || transaction.type === 'transfer-in' ? transaction.amountCents : -transaction.amountCents)
    }, account.openingBalanceCents)
  }

  const toggleSchedule = (schedule: SavingsSchedule) => {
    persist(goals, schedules.map((item) => item.id === schedule.id ? { ...item, active: !item.active } : item))
    onToast(schedule.active ? 'Depósito recorrente pausado.' : 'Depósito recorrente reativado.')
  }

  const archiveGoal = (goal: SavingsGoal) => {
    if (!goal.archived && !window.confirm(`Arquivar “${goal.name}”? O histórico e o saldo reservado serão preservados.`)) return
    const nextGoals = goals.map((item) => item.id === goal.id ? { ...item, archived: !item.archived } : item)
    const nextSchedules = schedules.map((item) => item.goalId === goal.id ? { ...item, active: goal.archived ? item.active : false } : item)
    persist(nextGoals, nextSchedules)
    setSelectedId(null)
    onToast(goal.archived ? 'Objetivo reativado.' : 'Objetivo arquivado. O saldo continua reservado.')
  }

  const deleteEmptyGoal = (goal: SavingsGoal) => {
    if (goal.movements.length || savingsBalance(goal) !== 0 || schedules.some((item) => item.goalId === goal.id)) {
      onToast('Para preservar o histórico, arquive objetivos com movimentações ou depósitos programados.')
      return
    }
    if (!window.confirm(`Excluir o objetivo vazio “${goal.name}”?`)) return
    persist(goals.filter((item) => item.id !== goal.id), schedules, transactions, achievements.filter((item) => item.goalId !== goal.id))
    setSelectedId(null)
    onToast('Objetivo excluído.')
  }

  const openNewGoal = () => setGoalDialog('new')

  return <div className="savings-page">
    {selectedGoal ? <GoalDetail
      goal={selectedGoal}
      accounts={accounts}
      schedules={schedules.filter((item) => item.goalId === selectedGoal.id)}
      achievements={achievements}
      now={now}
      historyFilter={historyFilter}
      onHistoryFilter={setHistoryFilter}
      onBack={() => setSelectedId(null)}
      onEdit={() => setGoalDialog(selectedGoal)}
      onMovement={(type) => setMovementDialog({ goal: selectedGoal, type })}
      onEditMovement={(movement) => setMovementDialog({ goal: selectedGoal, type: movement.type, movement })}
      onDeleteMovement={(movement) => removeMovement(selectedGoal, movement)}
      onNewSchedule={() => setScheduleDialog(selectedGoal)}
      onToggleSchedule={toggleSchedule}
      onArchive={() => archiveGoal(selectedGoal)}
      onDelete={() => deleteEmptyGoal(selectedGoal)}
    /> : <>
      <section className="savings-hero">
        <div className="savings-hero-copy"><span className="savings-eyebrow"><Sparkles size={14} /> PLANOS COM PROPÓSITO</span><h2>Um passo de cada vez.<br /><em>Mais perto do que importa.</em></h2><p>Separe seu dinheiro por objetivo e acompanhe cada conquista no seu ritmo.</p><button className="button button-primary" onClick={openNewGoal}><Plus size={16} /> Criar meu objetivo</button></div>
        <div className="savings-hero-art" aria-hidden="true"><div className="savings-orbit savings-orbit-a" /><div className="savings-orbit savings-orbit-b" /><div className="savings-art-coin coin-a">R$</div><div className="savings-art-coin coin-b"><Sparkles size={18} /></div><div className="savings-art-vault"><PiggyBank size={62} strokeWidth={1.35} /></div></div>
      </section>
      <section className="savings-summary-grid" aria-label="Resumo dos objetivos">
        <article className="savings-summary-card"><span>Guardado nos objetivos</span><strong>{currency(allBalance)}</strong><small>Dinheiro reservado, fora do saldo disponível nos bancos</small><span className="savings-summary-icon"><Wallet size={17} /></span></article>
        <article className="savings-summary-card"><span>Objetivos ativos</span><strong>{activeGoals}</strong><small>{goals.filter((goal) => !goal.archived).length} no total, incluindo os concluídos</small><span className="savings-summary-icon"><Target size={17} /></span></article>
        <article className="savings-summary-card"><span>Metas concluídas</span><strong>{completedGoals}</strong><small>Objetivos que já alcançaram a meta</small><span className="savings-summary-icon"><Trophy size={17} /></span></article>
        <article className="savings-summary-card"><span>Falta para suas metas</span><strong>{currency(remainingTotal)}</strong><small>Progresso geral de {generalProgress}%</small><span className="savings-summary-icon"><TrendingUp size={17} /></span></article>
      </section>
      <section className="savings-overall panel"><div><div className="savings-section-title"><span className="savings-section-icon"><CircleDollarSign size={17} /></span><div><h2>Sua jornada</h2><p>O progresso combinado dos objetivos não arquivados</p></div></div><strong>{generalProgress}%</strong></div><div className="savings-progress-track"><i style={{ width: `${generalProgress}%` }} /></div><div className="savings-overall-foot"><span>{currency(goals.filter((goal) => !goal.archived).reduce((sum, goal) => sum + Math.min(goal.targetCents, savingsBalance(goal)), 0))} guardados</span><span>Meta combinada: {currency(totalTarget)}</span></div></section>
      <section className="savings-achievements panel"><div className="savings-section-title"><span className="savings-section-icon"><Award size={17} /></span><div><h2>Conquistas</h2><p>Pequenos passos que merecem ser celebrados</p></div><span className="achievement-count">{achievements.filter((item) => achievementDefinitions.some((entry) => entry.id === item.id)).length}/{achievementDefinitions.length}</span></div><div className="achievement-list">{achievementDefinitions.map(({ id, title, description, Icon }) => {
        const unlocked = achievements.some((item) => item.id === id)
        return <article className={`achievement-badge ${unlocked ? 'unlocked' : ''}`} key={id}><span><Icon size={18} /></span><div><strong>{title}</strong><small>{unlocked ? 'Conquista desbloqueada' : description}</small></div>{unlocked && <Check size={15} />}</article>
      })}</div></section>
      <div className="savings-list-heading"><div><h2>Meus cofrinhos</h2><p>Organize planos e acompanhe cada avanço.</p></div><button className="button button-primary" onClick={openNewGoal}><Plus size={15} /> Novo objetivo</button></div>
      <section className="savings-filters panel"><label className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar objetivo" /></label><label className="filter-select"><ListFilter size={14} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} aria-label="Filtrar por categoria"><option value="all">Todas as categorias</option>{savingsCategories.map((category) => <option key={category}>{category}</option>)}</select><ChevronDown size={13} /></label><label className="filter-select"><ListFilter size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="Filtrar por status"><option value="active">Ativos</option><option value="completed">Concluídos</option><option value="archived">Arquivados</option><option value="all">Todos os status</option></select><ChevronDown size={13} /></label><label className="filter-select"><TrendingUp size={14} /><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Ordenar objetivos"><option value="recent">Mais recentes</option><option value="balance">Maior saldo</option><option value="progress">Maior progresso</option><option value="least-progress">Menor progresso</option><option value="near">Mais próximos da meta</option><option value="completed">Metas concluídas</option></select><ChevronDown size={13} /></label></section>
      {orderedGoals.length === 0 ? <div className="savings-empty panel"><span><PiggyBank size={24} /></span><h3>{goals.length ? 'Nenhum objetivo encontrado' : 'Seu próximo plano começa aqui'}</h3><p>{goals.length ? 'Tente ajustar os filtros ou a busca.' : 'Crie um cofrinho para dar forma aos planos que importam para você.'}</p>{!goals.length && <button className="button button-primary" onClick={openNewGoal}><Plus size={15} /> Criar meu primeiro objetivo</button>}</div> : <div className="savings-goal-grid">{orderedGoals.map((goal) => <GoalCard key={goal.id} goal={goal} schedules={schedules.filter((item) => item.goalId === goal.id && item.active)} onDetail={() => setSelectedId(goal.id)} onEdit={() => setGoalDialog(goal)} onDeposit={() => setMovementDialog({ goal, type: 'deposit' })} onWithdraw={() => setMovementDialog({ goal, type: 'withdrawal' })} />)}</div>}
      {schedules.some((schedule) => schedule.active) && <section className="savings-scheduled panel"><div className="savings-section-title"><span className="savings-section-icon"><CalendarDays size={17} /></span><div><h2>Próximos depósitos</h2><p>Programações locais para seus objetivos</p></div></div><div className="scheduled-deposit-list">{schedules.filter((item) => item.active).sort((a, b) => a.nextDate.localeCompare(b.nextDate)).slice(0, 5).map((schedule) => {
        const goal = goals.find((item) => item.id === schedule.goalId)
        const frequency = savingsFrequencies.find((item) => item.value === schedule.frequency)?.label ?? ''
        return <div className="scheduled-deposit-row" key={schedule.id}><span className="scheduled-deposit-icon"><Clock3 size={15} /></span><span><strong>{goal?.name ?? 'Objetivo'}</strong><small>{frequency} · próximo em {dateLabel(schedule.nextDate)}</small></span><strong>{currency(schedule.amountCents)}</strong></div>
      })}</div><p className="savings-local-note"><LockKeyhole size={13} /> Os depósitos programados são registros internos executados com o app aberto e saldo bancário suficiente. Não realizam transferências bancárias.</p></section>}
    </>}
    {goalDialog && <GoalForm goal={goalDialog === 'new' ? null : goalDialog} accounts={accounts} onClose={() => setGoalDialog(null)} onSubmit={saveGoal} />}
    {movementDialog && <MovementForm key={`${movementDialog.goal.id}-${movementDialog.type}-${movementDialog.movement?.id ?? 'new'}`} goal={movementDialog.goal} type={movementDialog.type} movement={movementDialog.movement} accounts={accounts} goalBalance={savingsBalance(movementDialog.goal)} onClose={() => setMovementDialog(null)} onSubmit={saveMovement} />}
    {scheduleDialog && <ScheduleForm goal={scheduleDialog} accounts={accounts} onClose={() => setScheduleDialog(null)} onSubmit={saveSchedule} />}
    {goalToast && <div className="savings-achievement-toast" role="status"><PartyPopper size={17} />{goalToast}</div>}
  </div>
}

function isDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return date.getFullYear() === Number(match[1]) && date.getMonth() === Number(match[2]) - 1 && date.getDate() === Number(match[3])
}

function GoalCard({ goal, schedules, onDetail, onEdit, onDeposit, onWithdraw }: { goal: SavingsGoal; schedules: SavingsSchedule[]; onDetail: () => void; onEdit: () => void; onDeposit: () => void; onWithdraw: () => void }) {
  const Icon = getIcon(goal.icon)
  const balance = savingsBalance(goal)
  const progress = goalProgress(goal)
  const remaining = Math.max(0, goal.targetCents - balance)
  return <article className={`savings-goal-card ${goal.archived ? 'goal-archived' : ''}`} style={{ '--goal-color': goal.color } as CSSProperties}>
    <button className="goal-card-main" onClick={onDetail} aria-label={`Ver detalhes de ${goal.name}`}>
      {goal.coverImage ? <span className="goal-cover" style={{ backgroundImage: `linear-gradient(180deg,transparent 28%,#090d18dc 100%),url("${goal.coverImage}")` }} /> : <span className="goal-cover goal-cover-pattern" />}
      <span className="goal-card-heading"><span className="goal-card-icon"><Icon size={20} /></span><span className="goal-category">{goal.category === 'Personalizado' ? goal.customCategory : goal.category}</span></span>
      <span className="goal-card-name">{goal.name}</span>
      {goal.description && <span className="goal-card-description">{goal.description}</span>}
      <span className="goal-card-balance">{currency(balance)}<small>de {currency(goal.targetCents)}</small></span>
      <span className="goal-progress-track"><i style={{ width: `${progress}%` }} /></span>
      <span className="goal-progress-foot"><span>{progress}% concluído</span><span>{remaining ? `Faltam ${currency(remaining)}` : 'Meta alcançada!'}</span></span>
      <span className="goal-card-date">{goal.archived ? 'Arquivado' : remaining ? `Meta para ${dateLabel(goal.targetDate)}` : 'Objetivo concluído'}{schedules.length > 0 && <span><CalendarDays size={12} /> Depósito programado</span>}</span>
    </button>
    <div className="goal-card-actions"><button className="button button-secondary" onClick={onDeposit}><Plus size={14} /> Guardar</button><button className="button button-secondary" onClick={onWithdraw} disabled={balance <= 0}><ArrowUpRight size={14} /> Retirar</button><button className="goal-more-button" onClick={onEdit} aria-label={`Editar ${goal.name}`} title="Editar objetivo"><ChevronRight size={17} /></button></div>
  </article>
}

function GoalDetail({ goal, accounts, schedules, achievements, now, historyFilter, onHistoryFilter, onBack, onEdit, onMovement, onEditMovement, onDeleteMovement, onNewSchedule, onToggleSchedule, onArchive, onDelete }: {
  goal: SavingsGoal
  accounts: AccountOption[]
  schedules: SavingsSchedule[]
  achievements: SavingsAchievement[]
  now: Date
  historyFilter: string
  onHistoryFilter: (filter: string) => void
  onBack: () => void
  onEdit: () => void
  onMovement: (type: SavingsMovementType) => void
  onEditMovement: (movement: SavingsMovement) => void
  onDeleteMovement: (movement: SavingsMovement) => void
  onNewSchedule: () => void
  onToggleSchedule: (schedule: SavingsSchedule) => void
  onArchive: () => void
  onDelete: () => void
}) {
  const balance = savingsBalance(goal)
  const progress = goalProgress(goal)
  const remaining = Math.max(0, goal.targetCents - balance)
  const forecast = projection(goal, schedules, savingsDateString(now))
  const points = evolutionPoints(goal)
  const max = Math.max(goal.targetCents, ...points.map((point) => point.balance), 1)
  const chartPoints = points.map((point, index) => `${points.length === 1 ? 50 : 8 + (index / (points.length - 1)) * 84},${82 - (Math.max(0, point.balance) / max) * 66}`).join(' ')
  const filteredMovements = [...goal.movements].filter((movement) => historyFilter === 'all' || movement.type === historyFilter).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))
  const Icon = getIcon(goal.icon)
  const milestones = achievements.filter((item) => item.goalId === goal.id)
  const achievementPercentages = [25, 50, 75].filter((percentage) => milestones.some((item) => item.id.endsWith(`:${percentage}`)))
  return <div className="goal-detail-page">
    <button className="text-button goal-back" onClick={onBack}><ChevronLeft size={16} /> Voltar para meus objetivos</button>
    <section className="goal-detail-hero" style={{ '--goal-color': goal.color } as CSSProperties}>
      {goal.coverImage && <div className="goal-detail-cover" style={{ backgroundImage: `linear-gradient(180deg,transparent,#0b0e18eb),url("${goal.coverImage}")` }} />}
      <div className="goal-detail-title-row"><span className="goal-detail-icon"><Icon size={25} /></span><div><span className="goal-category">{goal.category === 'Personalizado' ? goal.customCategory : goal.category}</span><h2>{goal.name}</h2><p>{goal.description || 'Um objetivo construído com cada passo.'}</p></div><div className="goal-detail-actions"><button className="button button-secondary" onClick={onEdit}><Lightbulb size={14} /> Editar</button><button className="icon-button" onClick={onArchive} title={goal.archived ? 'Reativar' : 'Arquivar'} aria-label={goal.archived ? 'Reativar objetivo' : 'Arquivar objetivo'}><Archive size={16} /></button><button className="icon-button" onClick={onDelete} title="Excluir objetivo vazio" aria-label="Excluir objetivo vazio"><X size={16} /></button></div></div>
      <div className="goal-detail-balance"><span>Você já guardou</span><strong>{currency(balance)}</strong><span>Meta de {currency(goal.targetCents)} · faltam {currency(remaining)}</span></div>
      <div className="goal-progress-track goal-progress-large"><i style={{ width: `${progress}%` }} /></div>
      <div className="goal-progress-foot"><span>{progress}% concluído</span><span>Meta para {dateLabel(goal.targetDate)}</span></div>
      <div className="goal-detail-buttons"><button className="button button-primary" onClick={() => onMovement('deposit')}><Plus size={15} /> Guardar dinheiro</button><button className="button button-secondary" onClick={() => onMovement('withdrawal')} disabled={balance <= 0}><ArrowUpRight size={15} /> Retirar dinheiro</button><button className="button button-secondary" onClick={onNewSchedule}><CalendarDays size={15} /> Programar depósito</button></div>
    </section>
    <section className="goal-detail-stat-grid"><article><span>Início</span><strong>{dateLabel(goal.startDate)}</strong></article><article><span>Previsão cadastrada</span><strong>{dateLabel(goal.targetDate)}</strong></article><article><span>Meta restante</span><strong>{currency(remaining)}</strong></article><article><span>Rendimento simulado</span><strong>{goal.yieldRateBps ? `${(goal.yieldRateBps / 100).toLocaleString('pt-BR')}% ${goal.yieldPeriod === 'yearly' ? 'ao ano' : 'ao mês'}` : 'Desativado'}</strong></article></section>
    <div className="goal-detail-columns">
      <section className="panel goal-chart-panel"><div className="savings-section-title"><span className="savings-section-icon"><TrendingUp size={17} /></span><div><h2>Evolução do objetivo</h2><p>Saldo após cada movimentação registrada</p></div></div>{goal.movements.length ? <div className="goal-evolution-chart"><svg viewBox="0 0 100 92" preserveAspectRatio="none" role="img" aria-label={`Evolução do saldo de ${goal.name}`}><defs><linearGradient id={`goal-fill-${goal.id}`} x1="0" x2="0" y1="0" y2="1"><stop stopColor={goal.color} stopOpacity=".35" /><stop offset="1" stopColor={goal.color} stopOpacity="0" /></linearGradient></defs><line x1="0" x2="100" y1="82" y2="82" className="goal-chart-grid" /><line x1="0" x2="100" y1="49" y2="49" className="goal-chart-grid" /><line x1="0" x2="100" y1="16" y2="16" className="goal-chart-grid" /><polygon points={`0,82 ${chartPoints} 100,82`} fill={`url(#goal-fill-${goal.id})`} /><polyline points={chartPoints} fill="none" stroke={goal.color} strokeWidth="1.7" vectorEffect="non-scaling-stroke" /></svg><div className="goal-chart-labels"><span>Início · {dateLabel(goal.startDate)}</span><span>Atual · {dateLabel(savingsDateString(now))}</span></div></div> : <div className="goal-chart-empty"><TrendingUp size={19} /><span>O gráfico começa a ganhar forma com sua primeira movimentação.</span></div>}
        <div className="projection-box"><div><span>Projeção no prazo da meta</span><small>Simulação estimada; não representa rentabilidade garantida.</small></div><div className="projection-values"><span>Sem rendimento<strong>{currency(forecast.withoutYield)}</strong></span><span>Com rendimento<strong>{currency(forecast.withYield)}</strong></span></div>{forecast.estimatedMonths !== null && <small className="projection-estimate">{forecast.estimatedMonths === 0 ? 'Meta já alcançada' : `No ritmo atual, estimativa de ${forecast.estimatedMonths} ${forecast.estimatedMonths === 1 ? 'mês' : 'meses'} para atingir a meta.`}{forecast.usesHistory ? ' Estimativa baseada nos depósitos já registrados.' : ''}</small>}{forecast.estimatedMonths === null && <small className="projection-estimate">Programe depósitos recorrentes para estimar quando a meta será alcançada.</small>}</div>
      </section>
      <section className="panel goal-schedule-panel"><div className="savings-section-title"><span className="savings-section-icon"><CalendarDays size={17} /></span><div><h2>Depósitos programados</h2><p>Agendamentos e registros realizados</p></div><button className="button button-secondary" onClick={onNewSchedule}><Plus size={13} /> Novo</button></div>{schedules.length === 0 ? <div className="goal-chart-empty"><span>Nenhum depósito recorrente para este objetivo.</span></div> : <div className="goal-schedule-list">{schedules.map((schedule) => {
        const frequency = savingsFrequencies.find((item) => item.value === schedule.frequency)?.label ?? ''
        const runLabel = schedule.runs.length ? `${schedule.runs.filter((run) => run.status === 'completed').length} depósito(s) realizado(s) · ${schedule.runs.filter((run) => run.status !== 'completed').length} não realizado(s)` : 'Ainda não houve execuções'
        return <article className="goal-schedule-card" key={schedule.id}><div><strong>{currency(schedule.amountCents)} · {frequency.toLocaleLowerCase('pt-BR')}</strong><span>Próximo: {schedule.active ? dateLabel(schedule.nextDate) : 'Pausado'}{schedule.endDate ? ` · até ${dateLabel(schedule.endDate)}` : ''}</span><small>{runLabel}</small></div><button className="schedule-toggle" onClick={() => onToggleSchedule(schedule)} aria-label={schedule.active ? 'Pausar depósito recorrente' : 'Reativar depósito recorrente'}>{schedule.active ? 'Pausar' : 'Ativar'}</button></article>
      })}</div>}<p className="savings-local-note"><LockKeyhole size={13} /> Programações locais: são processadas quando o app está aberto e a conta tem saldo. Nenhum banco é acessado.</p></section>
    </div>
    <section className="panel goal-history-panel"><div className="savings-section-title"><span className="savings-section-icon"><ArrowLeftRight size={17} /></span><div><h2>Histórico de movimentações</h2><p>Depósitos e retiradas vinculados ao saldo bancário</p></div><label className="filter-select"><ListFilter size={13} /><select value={historyFilter} onChange={(event) => onHistoryFilter(event.target.value)} aria-label="Filtrar movimentações"><option value="all">Todas</option><option value="deposit">Depósitos</option><option value="withdrawal">Retiradas</option></select><ChevronDown size={13} /></label></div>{filteredMovements.length === 0 ? <div className="goal-chart-empty"><span>Nenhuma movimentação neste filtro.</span></div> : <div className="goal-history-list">{filteredMovements.map((movement) => {
      const account = accounts.find((item) => item.id === movement.accountId)
      const deposit = movement.type === 'deposit'
      const scheduled = Boolean(movement.scheduleId)
      return <article className="goal-history-row" key={movement.id}><span className={`history-type-icon ${deposit ? 'history-deposit' : 'history-withdrawal'}`}>{deposit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}</span><div><strong>{movement.description}</strong><small>{deposit ? 'Depósito' : 'Retirada'} · {dateLabel(movement.date)} · {account?.name ?? 'Banco removido'}</small><small>{new Date(movement.createdAt).toLocaleString('pt-BR')}{scheduled ? ' · recorrente' : ''}</small></div><strong className={deposit ? 'positive' : 'negative'}>{deposit ? '+' : '−'}{currency(movement.amountCents)}</strong><span className="movement-actions">{!scheduled && <button className="icon-button" onClick={() => onEditMovement(movement)} title="Editar movimentação" aria-label={`Editar ${movement.description}`}><Lightbulb size={14} /></button>}<button className="icon-button" onClick={() => onDeleteMovement(movement)} title="Excluir movimentação" aria-label={`Excluir ${movement.description}`}><X size={15} /></button></span></article>
    })}</div>}</section>
    {achievementPercentages.length > 0 && <div className="goal-milestone-note"><PartyPopper size={16} /> Marcos alcançados neste objetivo: {achievementPercentages.map((value) => `${value}%`).join(', ')}.</div>}
  </div>
}

function GoalForm({ goal, accounts, onClose, onSubmit }: { goal: SavingsGoal | null; accounts: AccountOption[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [category, setCategory] = useState<SavingsCategory>(goal?.category ?? 'Viagem')
  const [initialBalance] = useState(goal ? savingsBalance(goal) : 0)
  return <div className="dialog-backdrop savings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog savings-form-dialog" onSubmit={(event) => void onSubmit(event)} role="dialog" aria-modal="true" aria-labelledby="savings-goal-form-title">
    <div className="dialog-header"><div><div className="eyebrow">MEUS OBJETIVOS</div><h2 id="savings-goal-form-title">{goal ? 'Editar objetivo' : 'Criar seu cofrinho'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <label className="form-label">Nome do objetivo<input name="name" autoFocus maxLength={70} placeholder="Ex.: Minha próxima viagem" defaultValue={goal?.name ?? ''} required /></label>
    <label className="form-label">Descrição ou finalidade<input name="description" maxLength={150} placeholder="O que este plano representa para você?" defaultValue={goal?.description ?? ''} /></label>
    <div className="form-two-columns"><label className="form-label">Categoria<select name="category" value={category} onChange={(event) => setCategory(event.target.value as SavingsCategory)}>{savingsCategories.map((item) => <option key={item}>{item}</option>)}</select></label>{category === 'Personalizado' && <label className="form-label">Nome da categoria<input name="customCategory" maxLength={40} placeholder="Ex.: Casamento" defaultValue={goal?.customCategory ?? ''} required /></label>}</div>
    <label className="form-label">Ícone do cofrinho<select name="icon" defaultValue={goal?.icon ?? 'target'}>{iconOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}</select></label>
    <div className="form-two-columns"><label className="form-label">Cor de identificação<input name="color" type="color" className="color-input" defaultValue={goal?.color ?? colorOptions[0]} /></label><label className="form-label">Imagem de capa · opcional<input name="coverImage" type="file" accept="image/*" />{goal?.coverImage && <span className="form-hint">Já existe uma capa. Envie outra ou marque para removê-la.</span>}</label></div>
    {goal?.coverImage && <label className="remove-cover-option"><input name="removeCover" type="checkbox" /> Remover imagem atual</label>}
    <div className="form-two-columns"><label className="form-label">Meta financeira<input name="target" type="text" inputMode="decimal" maxLength={18} placeholder="Ex.: 10.000,00" defaultValue={goal ? currencyInputValue(goal.targetCents) : ''} required /></label>{!goal && <label className="form-label">Valor inicial que deseja guardar<input name="initial" type="text" inputMode="decimal" maxLength={18} placeholder="Ex.: 500,00" defaultValue="0,00" /></label>}{goal && <label className="form-label">Já guardado<input type="text" readOnly value={currency(initialBalance)} /></label>}</div>
    {!goal && <label className="form-label">Banco de origem do valor inicial<select name="accountId" defaultValue={accounts[0]?.id ?? ''}><option value="">Selecione se informar valor inicial</option>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>}
    <div className="form-two-columns"><label className="form-label">Data de início<input name="startDate" type="date" defaultValue={goal?.startDate ?? savingsDateString(new Date())} required /></label><label className="form-label">Data prevista para alcançar<input name="targetDate" type="date" defaultValue={goal?.targetDate ?? ''} required /></label></div>
    <div className="form-two-columns"><label className="form-label">Taxa estimada de rendimento · opcional<input name="yieldRate" type="number" min="0" max="1000" step="0.01" placeholder="Não informado" defaultValue={goal?.yieldRateBps ? (goal.yieldRateBps / 100).toFixed(2) : ''} /></label><label className="form-label">Periodicidade<select name="yieldPeriod" defaultValue={goal?.yieldPeriod ?? 'monthly'}><option value="monthly">Ao mês</option><option value="yearly">Ao ano</option></select></label></div>
    <p className="form-hint">A taxa serve apenas para uma simulação matemática e não representa rentabilidade garantida. Imagens devem ter até 500 KB e ficam armazenadas neste navegador.</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={15} />{goal ? 'Salvar alterações' : 'Criar objetivo'}</button></div>
  </form></div>
}

function MovementForm({ goal, type, movement, accounts, goalBalance, onClose, onSubmit }: { goal: SavingsGoal; type: SavingsMovementType; movement?: SavingsMovement; accounts: AccountOption[]; goalBalance: number; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const isDeposit = type === 'deposit'
  const accountId = movement?.accountId ?? accounts[0]?.id ?? ''
  const balance = movement ? (movement.type === 'deposit' ? goalBalance - movement.amountCents : goalBalance + movement.amountCents) : goalBalance
  return <div className="dialog-backdrop savings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog savings-form-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="savings-movement-title">
    <div className="dialog-header"><div><div className="eyebrow">{goal.name}</div><h2 id="savings-movement-title">{movement ? 'Editar movimentação' : isDeposit ? 'Guardar dinheiro' : 'Retirar dinheiro'}</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <label className="form-label">Valor<input name="amount" type="text" inputMode="decimal" maxLength={18} defaultValue={movement ? currencyInputValue(movement.amountCents) : ''} placeholder="Ex.: 10.000,00" required /></label>
    <label className="form-label">Banco {isDeposit ? 'de origem' : 'para receber'}<select name="accountId" defaultValue={accountId} disabled={Boolean(movement)} required>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
    <label className="form-label">Data<input name="date" type="date" defaultValue={movement?.date ?? savingsDateString(new Date())} required /></label>
    <label className="form-label">Descrição<input name="description" maxLength={100} defaultValue={movement?.description ?? ''} placeholder={isDeposit ? 'Ex.: Depósito mensal' : 'Ex.: Compra planejada'} required /></label>
    <div className="movement-balance-note"><Wallet size={15} /><span>{isDeposit ? 'O saldo disponível no banco será validado antes de confirmar.' : `Disponível neste objetivo: ${currency(balance)}`}</span></div>
    <p className="form-hint">Esta operação movimenta o saldo entre o banco e o objetivo. Não é classificada como receita nem como despesa.</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={15} /> Confirmar {isDeposit ? 'depósito' : 'retirada'}</button></div>
  </form></div>
}

function ScheduleForm({ goal, accounts, onClose, onSubmit }: { goal: SavingsGoal; accounts: AccountOption[]; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  return <div className="dialog-backdrop savings-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><form className="form-dialog savings-form-dialog" onSubmit={onSubmit} role="dialog" aria-modal="true" aria-labelledby="savings-schedule-title">
    <div className="dialog-header"><div><div className="eyebrow">{goal.name}</div><h2 id="savings-schedule-title">Programar depósitos</h2></div><button type="button" className="icon-button" onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
    <label className="form-label">Valor de cada depósito<input name="amount" type="text" inputMode="decimal" maxLength={18} placeholder="Ex.: 100,00" required /></label>
    <label className="form-label">Frequência<select name="frequency">{savingsFrequencies.map((item) => <option value={item.value} key={item.value}>{item.label}</option>)}</select></label>
    <label className="form-label">Banco de origem<select name="accountId" defaultValue={accounts[0]?.id ?? ''} required>{accounts.map((account) => <option value={account.id} key={account.id}>{account.name}</option>)}</select></label>
    <div className="form-two-columns"><label className="form-label">Data de início<input name="startDate" type="date" defaultValue={savingsDateString(new Date())} required /></label><label className="form-label">Data de encerramento · opcional<input name="endDate" type="date" /></label></div>
    <div className="movement-balance-note"><LockKeyhole size={15} /><span>O depósito é registrado localmente quando o app está aberto e há saldo suficiente no banco selecionado.</span></div>
    <p className="form-hint">Não há integração bancária ou transferência automática real. Programações vencidas enquanto o app estava fechado serão marcadas como não realizadas, sem cobrança retroativa.</p>
    <div className="dialog-actions"><button type="button" className="button button-secondary" onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary"><Check size={15} /> Programar</button></div>
  </form></div>
}
