type ShiftNumber = 1 | 2

function jakartaDateKey(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${values.year}-${values.month}-${values.day}`
}

function mondayOf(dateKey: string): Date {
  const date = new Date(`${dateKey}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7))
  return date
}

export function currentUserShift(
  user: {
    shiftMode: string
    shiftBase: number
    shiftAnchorDate: Date | null
  },
  now = new Date(),
): ShiftNumber | null {
  if (
    user.shiftMode !== 'rotating' ||
    (user.shiftBase !== 1 && user.shiftBase !== 2) ||
    !user.shiftAnchorDate
  ) {
    return null
  }

  const anchor = mondayOf(user.shiftAnchorDate.toISOString().slice(0, 10))
  const current = mondayOf(jakartaDateKey(now))
  const weeks = Math.floor((current.getTime() - anchor.getTime()) / 604_800_000)
  const shift = ((user.shiftBase - 1 + ((weeks % 2) + 2) % 2) % 2) + 1
  return shift as ShiftNumber
}

export function currentJakartaWeekStart(now = new Date()): string {
  return mondayOf(jakartaDateKey(now)).toISOString().slice(0, 10)
}
