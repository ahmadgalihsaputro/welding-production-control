import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

router.get('/', async (req, res, next) => {
  try {
    const line = typeof req.query.line === 'string' && req.query.line !== 'all' ? req.query.line : undefined
    const today = new Date()
    const startOfDay = new Date(`${dateKey(today)}T00:00:00.000Z`)
    const sevenDaysAgo = new Date(startOfDay)
    sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6)

    const lineFilter = line ? { line } : {}

    const [
      queue,
      schedules,
      productionRecords,
      ngRecords,
      completedBoxes,
      stockItems,
      machines,
      activities,
      materialRequests,
      bufferItems,
    ] = await Promise.all([
      prisma.queueItem.findMany({
        where: { status: { not: 'complete' }, ...lineFilter },
        orderBy: { no: 'asc' },
        take: 10,
      }),
      prisma.scheduleItem.findMany({ where: lineFilter }),
      prisma.productionShiftRecord.findMany({
        where: { date: { gte: dateKey(sevenDaysAgo) }, ...lineFilter },
        orderBy: { date: 'asc' },
      }),
      prisma.ngShiftRecord.findMany({
        where: { date: { gte: dateKey(sevenDaysAgo) }, ...lineFilter },
      }),
      prisma.completedBox.findMany({
        where: { completedAt: { gte: startOfDay }, ...(line ? { line } : {}) },
      }),
      prisma.stockItem.findMany({ orderBy: { partNumber: 'asc' } }),
      prisma.machine.findMany({ ...(line ? { where: { line } } : {}), orderBy: { code: 'asc' } }),
      prisma.auditLog.findMany({ orderBy: { time: 'desc' }, take: 8 }),
      prisma.materialRequest.findMany({ where: { status: { in: ['waiting', 'partial'] } }, take: 10 }),
      prisma.bufferItem.findMany({ where: { status: 'pending' }, take: 10 }),
    ])

    const target = schedules.reduce((sum, item) => sum + item.target, 0)
    const actual = schedules.reduce((sum, item) => sum + item.actual, 0)
    const okToday = productionRecords
      .filter((record) => record.date === dateKey(today))
      .reduce((sum, record) => sum + record.ok, 0)
    const ngToday = productionRecords
      .filter((record) => record.date === dateKey(today))
      .reduce((sum, record) => sum + record.ng, 0)
    const completedToday = completedBoxes.reduce((sum, box) => sum + box.qty, 0)

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date(sevenDaysAgo)
      date.setUTCDate(date.getUTCDate() + index)
      return dateKey(date)
    })

    const daily = days.map((date) => {
      const records = productionRecords.filter((record) => record.date === date)
      const schedule = schedules.filter((item) => item.status !== 'complete')
      return {
        date,
        ok: records.reduce((sum, record) => sum + record.ok, 0),
        ng: records.reduce((sum, record) => sum + record.ng, 0),
        target: schedule.reduce((sum, item) => sum + item.target, 0),
      }
    })

    const ngPareto = new Map<string, number>()
    for (const record of ngRecords) {
      ngPareto.set(record.partNumber, (ngPareto.get(record.partNumber) ?? 0) + record.ng)
    }

    res.json({
      generatedAt: new Date().toISOString(),
      line: line ?? 'all',
      kpi: {
        target,
        actual,
        achievement: target > 0 ? Math.round((actual / target) * 1000) / 10 : 0,
        okToday,
        ngToday,
        completedToday,
        queueWaiting: queue.filter((item) => item.status === 'waiting').length,
        queueRunning: queue.filter((item) => item.status === 'running').length,
        stockLow: stockItems.filter((item) => item.status === 'low').length,
        stockEmpty: stockItems.filter((item) => item.status === 'empty').length,
        materialWaiting: materialRequests.length,
        bufferPending: bufferItems.length,
      },
      daily,
      ngPareto: Array.from(ngPareto.entries())
        .map(([partNumber, ng]) => ({ partNumber, ng }))
        .sort((a, b) => b.ng - a.ng)
        .slice(0, 8),
      queue,
      machines,
      stockAlerts: stockItems
        .filter((item) => item.status === 'low' || item.status === 'empty')
        .slice(0, 10),
      materialRequests,
      activities,
    })
  } catch (error) {
    next(error)
  }
})

export default router
