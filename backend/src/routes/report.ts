import { Router } from 'express'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const router = Router()

router.use(authenticate)

function dateFilter(from?: string, to?: string) {
  const gte = from ? new Date(from) : undefined
  const lte = to ? new Date(to) : undefined
  if (!gte && !lte) return undefined
  return {
    ...(gte && !Number.isNaN(gte.getTime()) ? { gte } : {}),
    ...(lte && !Number.isNaN(lte.getTime()) ? { lte } : {}),
  }
}

router.get('/audit', requireRole('admin', 'management', 'leader'), async (_req, res, next) => {
  try {
    const items = await prisma.auditLog.findMany({ orderBy: { time: 'desc' }, take: 200 })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

router.get('/production', async (req, res, next) => {
  try {
    const { from, to, line, partNumber } = req.query
    const items = await prisma.productionShiftRecord.findMany({
      where: {
        ...(typeof from === 'string' || typeof to === 'string'
          ? { date: { ...(typeof from === 'string' ? { gte: from } : {}), ...(typeof to === 'string' ? { lte: to } : {}) } }
          : {}),
        ...(typeof line === 'string' ? { line } : {}),
        ...(typeof partNumber === 'string' ? { partNumber: partNumber.toUpperCase() } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    })
    res.json({
      records: items,
      summary: {
        ok: items.reduce((sum, item) => sum + item.ok, 0),
        ng: items.reduce((sum, item) => sum + item.ng, 0),
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/ng', async (req, res, next) => {
  try {
    const { from, to, line } = req.query
    const items = await prisma.ngShiftRecord.findMany({
      where: {
        ...(typeof from === 'string' || typeof to === 'string'
          ? { date: { ...(typeof from === 'string' ? { gte: from } : {}), ...(typeof to === 'string' ? { lte: to } : {}) } }
          : {}),
        ...(typeof line === 'string' ? { line } : {}),
      },
      orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      take: 500,
    })
    const totals = new Map<string, number>()
    for (const item of items) {
      totals.set(item.partNumber, (totals.get(item.partNumber) ?? 0) + item.ng)
    }
    res.json({
      records: items,
      pareto: Array.from(totals.entries())
        .map(([partNumber, ng]) => ({ partNumber, ng }))
        .sort((a, b) => b.ng - a.ng),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/completed-boxes', async (req, res, next) => {
  try {
    const { line, partNumber } = req.query
    const items = await prisma.completedBox.findMany({
      where: {
        ...(typeof line === 'string' ? { line } : {}),
        ...(typeof partNumber === 'string' ? { partNumber: partNumber.toUpperCase() } : {}),
      },
      orderBy: { completedAt: 'desc' },
      take: 500,
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

router.get('/inventory', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({ orderBy: { partNumber: 'asc' } })
    const byCategory = new Map<string, { parts: number; store: number }>()
    for (const item of items) {
      const current = byCategory.get(item.category) ?? { parts: 0, store: 0 }
      current.parts += 1
      current.store += item.store
      byCategory.set(item.category, current)
    }
    res.json({
      items,
      summary: {
        totalParts: items.length,
        totalStore: items.reduce((sum, item) => sum + item.store, 0),
        low: items.filter((item) => item.status === 'low').length,
        empty: items.filter((item) => item.status === 'empty').length,
        byCategory: Array.from(byCategory.entries()).map(([category, value]) => ({
          category,
          ...value,
        })),
      },
    })
  } catch (error) {
    next(error)
  }
})

router.get('/material-usage', async (req, res, next) => {
  try {
    const time = dateFilter(
      typeof req.query.from === 'string' ? req.query.from : undefined,
      typeof req.query.to === 'string' ? req.query.to : undefined,
    )
    const usage = await prisma.ledgerEntry.groupBy({
      by: ['partNumber', 'type'],
      where: time ? { time } : undefined,
      _sum: { qty: true },
      _count: { _all: true },
      orderBy: { partNumber: 'asc' },
    })
    res.json(
      usage.map((row) => ({
        partNumber: row.partNumber,
        type: row.type,
        qty: row._sum.qty ?? 0,
        transactions: row._count._all,
      })),
    )
  } catch (error) {
    next(error)
  }
})

router.get('/transactions', async (req, res, next) => {
  try {
    const time = dateFilter(
      typeof req.query.from === 'string' ? req.query.from : undefined,
      typeof req.query.to === 'string' ? req.query.to : undefined,
    )
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const partNumber = typeof req.query.partNumber === 'string' ? req.query.partNumber.toUpperCase() : undefined
    const items = await prisma.ledgerEntry.findMany({
      where: {
        ...(time ? { time } : {}),
        ...(type ? { type } : {}),
        ...(partNumber ? { partNumber } : {}),
      },
      orderBy: { time: 'desc' },
      take: 500,
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

export default router
