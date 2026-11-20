import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, type AuthenticatedRequest, requireRole } from '../middleware/auth.js'
import { applyStockMovement } from '../lib/stock.js'
import { jakartaDateKey } from '../lib/userShift.js'

const router = Router()

router.use(authenticate)

const kindSchema = z.enum(['request', 'pickup', 'return', 'receiving', 'external'])
type MaterialKind = z.infer<typeof kindSchema>

const codePrefix: Record<MaterialKind, string> = {
  request: 'MR',
  pickup: 'PU',
  return: 'RT',
  receiving: 'RC',
  external: 'EX',
}

const movementType: Record<
  MaterialKind,
  'Store In' | 'Supply Issue' | 'Collect Pickup' | 'Return Accepted'
> = {
  request: 'Supply Issue',
  pickup: 'Collect Pickup',
  return: 'Return Accepted',
  receiving: 'Store In',
  external: 'Store In',
}

const movementDirection: Record<MaterialKind, 1 | -1> = {
  request: -1,
  pickup: -1,
  return: 1,
  receiving: 1,
  external: 1,
}

router.get('/requests', async (req, res, next) => {
  try {
    const kind = typeof req.query.kind === 'string' ? req.query.kind : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const partNumber = typeof req.query.partNumber === 'string' ? req.query.partNumber : undefined
    const items = await prisma.materialRequest.findMany({
      where: {
        ...(kind ? { kind } : {}),
        ...(status ? { status } : {}),
        ...(partNumber ? { partNumber: partNumber.toUpperCase() } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const createRequestSchema = z.object({
  code: z.string().min(1).optional(),
  kind: kindSchema.default('request'),
  partNumber: z.string().min(1),
  boxes: z.number().int().positive(),
  pcsPerBox: z.number().int().positive(),
  destination: z.string().min(1),
  requester: z.string().min(1).optional(),
  note: z.string().optional(),
})

router.post('/requests', requireRole('admin', 'leader'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = createRequestSchema.parse(req.body)
    const partNumber = body.partNumber.trim().toUpperCase()
    const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
    if (!stock) return res.status(400).json({ message: `Part ${partNumber} tidak terdaftar di stock.` })

    const code =
      body.code?.trim().toUpperCase() ??
      `${codePrefix[body.kind]}-${jakartaDateKey(new Date()).replaceAll('-', '')}-${Date.now().toString().slice(-6)}`

    const item = await prisma.materialRequest.create({
      data: {
        code,
        kind: body.kind,
        partNumber,
        boxes: body.boxes,
        pcsPerBox: body.pcsPerBox,
        destination: body.destination,
        requester: body.requester ?? req.user!.name,
        note: body.note,
      },
    })
    await prisma.auditLog.create({
      data: {
        title: `Permintaan material ${code} dibuat`,
        detail: `${partNumber} · ${body.boxes} box × ${body.pcsPerBox} pcs → ${body.destination}`,
        type: 'material',
        line: stock.location,
      },
    })
    res.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

const statusSchema = z.object({
  status: z.enum(['waiting', 'partial', 'received', 'completed', 'rejected']),
  note: z.string().optional(),
})

const closedStatuses = new Set(['received', 'completed'])

router.patch('/requests/:id/status', requireRole('leader', 'admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = statusSchema.parse(req.body)
    const request = await prisma.materialRequest.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!request) return res.status(404).json({ message: 'Material request not found.' })

    if (closedStatuses.has(request.status) && !closedStatuses.has(body.status)) {
      return res.status(400).json({
        message: 'Permintaan yang sudah selesai tidak dapat dibuka kembali.',
      })
    }

    const kind = request.kind as MaterialKind
    const shouldMoveStock =
      closedStatuses.has(body.status) && !closedStatuses.has(request.status)

    const updated = await prisma.$transaction(async (tx) => {
      if (!shouldMoveStock) {
        return tx.materialRequest.update({
          where: { id: request.id },
          data: {
            status: body.status,
            ...(body.note !== undefined ? { note: body.note } : {}),
          },
        })
      }

      // Klaim status dulu supaya dua tab tidak bisa menambah stok yang sama dua kali.
      const claimed = await tx.materialRequest.updateMany({
        where: { id: request.id, status: request.status },
        data: {
          status: body.status,
          ...(body.note !== undefined ? { note: body.note } : {}),
        },
      })
      if (claimed.count === 0) return null

      const qty = request.boxes * request.pcsPerBox
      await applyStockMovement(tx, {
        partNumber: request.partNumber,
        delta: movementDirection[kind] * qty,
        type: movementType[kind],
        reference: request.code,
        user: req.user!.name,
      })
      return tx.materialRequest.findUniqueOrThrow({ where: { id: request.id } })
    })

    if (!updated) {
      return res.status(409).json({ message: 'Kanban ini sudah diproses. Muat ulang antrian sebelum mencoba lagi.' })
    }
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

router.delete('/requests/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const request = await prisma.materialRequest.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!request) return res.status(404).json({ message: 'Material request not found.' })
    if (closedStatuses.has(request.status)) {
      return res.status(400).json({ message: 'Permintaan yang sudah selesai tidak dapat dihapus.' })
    }
    await prisma.materialRequest.delete({ where: { id: request.id } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

router.get('/stock', async (_req, res, next) => {
  try {
    const items = await prisma.stockItem.findMany({ orderBy: { partNumber: 'asc' } })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

router.get('/buffer', async (_req, res, next) => {
  try {
    const items = await prisma.bufferItem.findMany({ orderBy: { completedAt: 'desc' } })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

export default router
