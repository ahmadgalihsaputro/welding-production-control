export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value)
}

export function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (value >= 1_000) return `${(value / 1_000).toFixed(1).replace('.', ',')} rb`
  return formatNumber(value)
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits).replace('.', ',')}%`
}

export function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max)
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 11) return 'Selamat pagi'
  if (hour < 15) return 'Selamat siang'
  if (hour < 18) return 'Selamat sore'
  return 'Selamat malam'
}

export function todayLabel(date = new Date()): string {
  return new Intl.DateTimeFormat('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date)
}
