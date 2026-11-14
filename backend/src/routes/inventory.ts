import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, type AuthenticatedRequest, requireRole } from '../middleware/auth.js'
import { applyStockMovement, stockStatus } from '../lib/stock.js'

const router = Router()

router.use(authenticate)

router.get('/stock', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const location = typeof req.query.location === 'string' ? req.query.location : undefined
    const items = await prisma.stockItem.findMany({
      where: {
        ...(category ? { category } : {}),
        ...(status ? { status: status as 'safe' | 'low' | 'full' | 'empty' } : {}),
        ...(location ? { location } : {}),
      },
      orderBy: { partNumber: 'asc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

router.get('/overview', async (_req, res, next) => {
  try {
    const [items, bufferCount, ledgerToday] = await Promise.all([
      prisma.stockItem.findMany(),
      prisma.bufferItem.count({ where: { status: 'pending' } }),
      prisma.ledgerEntry.count({
        where: { time: { gte: new Date(new Date().toISOString().slice(0, 10)) } },
      }),
    ])

    const categories = new Map<string, { parts: number; store: number; low: number; empty: number }>()
    for (const item of items) {
      const summary = categories.get(item.category) ?? { parts: 0, store: 0, low: 0, empty: 0 }
      summary.parts += 1
      summary.store += item.store
      if (item.status === 'low') summary.low += 1
      if (item.status === 'empty') summary.empty += 1
      categories.set(item.category, summary)
    }

    res.json({
      totalParts: items.length,
      totalStore: items.reduce((sum, item) => sum + item.store, 0),
      totalBuffer: items.reduce((sum, item) => sum + item.buffer, 0),
      low: items.filter((item) => item.status === 'low').length,
      empty: items.filter((item) => item.status === 'empty').length,
      full: items.filter((item) => item.status === 'full').length,
      bufferPending: bufferCount,
      ledgerToday,
      categories: Array.from(categories.entries()).map(([category, summary]) => ({
        category,
        ...summary,
      })),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/stock/:partNumber', async (req, res, next) => {
  try {
    const item = await prisma.stockItem.findUnique({
      where: { partNumber: String(req.params.partNumber).toUpperCase() },
    })
    if (!item) return res.status(404).json({ message: 'Stock item not found.' })
    res.json(item)
  } catch (error) {
    next(error)
  }
})

router.get('/ledger', async (req, res, next) => {
  try {
    const partNumber = typeof req.query.partNumber === 'string' ? req.query.partNumber : undefined
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const from = typeof req.query.from === 'string' ? new Date(req.query.from) : undefined
    const to = typeof req.query.to === 'string' ? new Date(req.query.to) : undefined
    const take = Math.min(Number(req.query.take) || 200, 1000)
    const items = await prisma.ledgerEntry.findMany({
      where: {
        ...(partNumber ? { partNumber: partNumber.toUpperCase() } : {}),
        ...(type ? { type } : {}),
        ...(from || to
          ? {
              time: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: { time: 'desc' },
      take,
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const adjustmentSchema = z
  .object({
    partNumber: z.string().min(1),
    newStore: z.number().int().nonnegative().optional(),
    qty: z.number().int().optional(),
    reason: z.string().min(1),
    location: z.string().optional(),
  })
  .refine((body) => body.newStore !== undefined || body.qty !== undefined, {
    message: 'Isi newStore atau qty.',
  })

router.post(
  '/adjustment',
  requireRole('admin', 'leader'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = adjustmentSchema.parse(req.body)
      const partNumber = body.partNumber.trim().toUpperCase()
      const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
      if (!stock) return res.status(404).json({ message: 'Stock item not found.' })

      const delta = body.newStore !== undefined ? body.newStore - stock.store : body.qty!
      if (delta === 0) {
        return res.status(400).json({ message: 'Tidak ada perubahan stok.' })
      }

      const result = await prisma.$transaction(async (tx) => {
        const movement = await applyStockMovement(tx, {
          partNumber,
          delta,
          type: 'Adjustment',
          reference: body.reason,
          location: body.location,
          user: req.user!.name,
        })
        await tx.auditLog.create({
          data: {
            title: `Stock adjustment ${partNumber}`,
            detail: `${delta > 0 ? '+' : ''}${delta} pcs · ${body.reason}`,
            type: 'inventory',
          },
        })
        return movement
      })

      res.json(result)
    } catch (error) {
      next(error)
    }
  },
)

router.get('/buffer', async (_req, res, next) => {
  try {
    const items = await prisma.bufferItem.findMany({ orderBy: { completedAt: 'desc' } })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const bufferSchema = z.object({
  partNumber: z.string().min(1),
  qty: z.number().int().positive(),
  kanban: z.string().min(1),
  operator: z.string().min(1).optional(),
})

router.post('/buffer', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = bufferSchema.parse(req.body)
    const partNumber = body.partNumber.trim().toUpperCase()
    const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
    if (!stock) return res.status(400).json({ message: 'Part number is not registered.' })

    const item = await prisma.bufferItem.create({
      data: {
        partNumber,
        qty: body.qty,
        kanban: body.kanban.trim(),
        operator: body.operator ?? req.user!.name,
        waitingMinutes: 0,
        status: 'pending',
      },
    })
    res.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

const bufferStatusSchema = z.object({
  status: z.enum(['pending', 'stored']),
})

router.patch('/buffer/:id/status', async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = bufferStatusSchema.parse(req.body)
    const item = await prisma.bufferItem.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!item) return res.status(404).json({ message: 'Buffer item not found.' })
    if (item.status === body.status) return res.json(item)
    if (item.status === 'stored' && body.status === 'pending') {
      return res.status(400).json({ message: 'Item yang sudah masuk store tidak dapat dikembalikan.' })
    }

    const updated = await prisma.$transaction(async (tx) => {
      if (body.status === 'stored') {
        await applyStockMovement(tx, {
          partNumber: item.partNumber,
          delta: item.qty,
          type: 'Store In',
          reference: item.kanban,
          user: req.user!.name,
        })
        await tx.auditLog.create({
          data: {
            title: `Buffer ${item.kanban} masuk store`,
            detail: `${item.partNumber} · ${item.qty} pcs`,
            type: 'inventory',
          },
        })
      }
      return tx.bufferItem.update({
        where: { id: item.id },
        data: {
          status: body.status,
          waitingMinutes: Math.max(
            0,
            Math.round((Date.now() - item.completedAt.getTime()) / 60000),
          ),
        },
      })
    })

    res.json(updated)
  } catch (error) {
    next(error)
  }
})

router.get('/status/:partNumber', async (req, res, next) => {
  try {
    const stock = await prisma.stockItem.findUnique({
      where: { partNumber: String(req.params.partNumber).toUpperCase() },
    })
    if (!stock) return res.status(404).json({ message: 'Stock item not found.' })
    res.json({ ...stock, recomputedStatus: stockStatus(stock.store, stock.safetyStock, stock.maxStore) })
  } catch (error) {
    next(error)
  }
})

export default router
