export interface Point {
  x: number
  y: number
}

export function smoothPath(points: Point[]): string {
  if (points.length === 0) return ''
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`

  let path = `M ${points[0].x} ${points[0].y}`

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[index - 1] ?? points[index]
    const p1 = points[index]
    const p2 = points[index + 1]
    const p3 = points[index + 2] ?? p2

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`
  }

  return path
}

export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 10

  const rough = value / 4
  const power = 10 ** Math.floor(Math.log10(rough))
  const normalized = rough / power
  const stepFactor =
    normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = stepFactor * power

  return Math.ceil(value / step) * step
}

export function axisTicks(max: number, count = 4): number[] {
  return Array.from({ length: count + 1 }, (_, index) => (max / count) * index)
}

export function clampIndex(index: number, length: number): number {
  return Math.min(Math.max(index, 0), Math.max(length - 1, 0))
}

export function formatAxisValue(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')} jt`
  if (value >= 10_000) return `${Math.round(value / 1_000)} rb`
  return new Intl.NumberFormat('id-ID').format(value)
}
