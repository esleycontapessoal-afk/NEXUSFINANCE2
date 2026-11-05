export type SavingsCategory =
  | 'Viagem'
  | 'Moto'
  | 'Carro'
  | 'Casa'
  | 'Emergência'
  | 'Estudos'
  | 'Tecnologia'
  | 'Lazer'
  | 'Personalizado'

export type SavingsMovementType = 'deposit' | 'withdrawal'
export type SavingsFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly'

export type SavingsMovement = {
  id: string
  type: SavingsMovementType
  amountCents: number
  date: string
  createdAt: string
  description: string
  accountId: string
  linkedTransactionId: string
  scheduleId?: string
}

export type SavingsGoal = {
  id: string
  name: string
  description: string
  category: SavingsCategory
  customCategory?: string
  icon: string
  color: string
  coverImage?: string
  targetCents: number
  startDate: string
  targetDate: string
  archived: boolean
  createdAt: string
  yieldRateBps?: number
  yieldPeriod?: 'monthly' | 'yearly'
  movements: SavingsMovement[]
}

export type SavingsScheduleRun = {
  date: string
  status: 'completed' | 'insufficient-funds' | 'missed' | 'reverted'
  movementId?: string
}

export type SavingsSchedule = {
  id: string
  goalId: string
  amountCents: number
  frequency: SavingsFrequency
  startDate: string
  endDate?: string
  nextDate: string
  accountId: string
  active: boolean
  runs: SavingsScheduleRun[]
}

export type SavingsAchievement = {
  id: string
  achievedAt: string
  goalId?: string
}

export const savingsCategories: SavingsCategory[] = [
  'Viagem',
  'Moto',
  'Carro',
  'Casa',
  'Emergência',
  'Estudos',
  'Tecnologia',
  'Lazer',
  'Personalizado',
]

export const savingsFrequencies: { value: SavingsFrequency; label: string }[] = [
  { value: 'daily', label: 'Diário' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'monthly', label: 'Mensal' },
]

export function savingsBalance(goal: SavingsGoal) {
  return goal.movements.reduce(
    (balance, movement) => balance + (movement.type === 'deposit' ? movement.amountCents : -movement.amountCents),
    0,
  )
}

export function nextSavingsDate(date: string, frequency: SavingsFrequency, anchorDay?: number) {
  const [year, month, day] = date.split('-').map(Number)
  const next = new Date(year, month - 1, day, 12)
  if (frequency === 'daily') next.setDate(next.getDate() + 1)
  else if (frequency === 'weekly') next.setDate(next.getDate() + 7)
  else if (frequency === 'biweekly') next.setDate(next.getDate() + 14)
  else {
    const targetMonth = new Date(year, month, 1, 12)
    const lastDay = new Date(targetMonth.getFullYear(), targetMonth.getMonth() + 1, 0).getDate()
    targetMonth.setDate(Math.min(anchorDay ?? day, lastDay))
    return savingsDateString(targetMonth)
  }
  return savingsDateString(next)
}

export function savingsDateString(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
