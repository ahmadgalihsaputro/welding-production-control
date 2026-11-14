import { Router } from 'express'
import { z } from 'zod'
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'

const router = Router()

const queueTypeSchema = z
  .enum(['Assy', 'Sub_Assy', 'Sub Assy'])
  .transform((value): 'Assy' | 'Sub_Assy' => (value === 'Assy' ? 'Assy' : 'Sub_Assy'))

function normalizeQueueType(value: unknown): 'Assy' | 'Sub_Assy' | undefined {
  if (value === 'Assy') return 'Assy'
  if (value === 'Sub_Assy' || value === 'Sub Assy') return 'Sub_Assy'
  return undefined
}

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}


const scanSchema = z.object({
  code: z.string().min(1),
  partNumber: z.string().min(1),
  model: z.string().min(1),
  type: queueTypeSchema,
  qty: z.number().int().positive(),
  process: z.string().optional(),
  sourceShift: z.number().int().min(1).max(2).optional(),
})

router.post('/requests/scan', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = scanSchema.parse(req.body)
    const code = body.code.trim().toUpperCase()
    const partNumber = body.partNumber.trim().toUpperCase()
    const part = await prisma.productionPart.findUnique({ where: { partNumber } })
    if (!part || part.type !== body.type) {
      return res.status(400).json({ message: 'Part number is not registered for this production type.' })
    }
    if (part.models.length > 0 && !part.models.includes(body.model)) {
      return res.status(400).json({ message: `Model ${body.model} is not registered for ${partNumber}.` })
    }

    const [existingItem, existingRequest, existingCompleted] = await Promise.all([
      prisma.queueItem.findFirst({ where: { kanban: { equals: code, mode: 'insensitive' } } }),
      prisma.productionRequest.findFirst({ where: { code: { equals: code, mode: 'insensitive' } } }),
      prisma.completedBox.findFirst({ where: { kanban: { startsWith: code } } }),
    ])
    if (existingItem || existingRequest || existingCompleted) {
      return res.status(409).json({ message: `Kanban ${code} has already been recorded.` })
    }

    const request = await prisma.productionRequest.create({
      data: {
        code,
        partNumber,
        model: body.model,
        type: body.type,
        line: part.line,
        process: body.type === 'Sub_Assy' ? (body.process ?? part.process) : null,
        qty: body.qty,
        sourceShift: body.sourceShift,
        status: 'pending',
      },
    })

    await prisma.auditLog.create({
      data: {
        title: `Permintaan ${code} menunggu alokasi`,
        detail: `${partNumber} · ${body.qty} pcs · scan ${body.type}`,
        type: body.type,
        line: part.line,
        process: body.type === 'Sub_Assy' ? (body.process ?? part.process) : null,
      },
    })

    res.status(201).json(request)
  } catch (error) {
    next(error)
  }
})

router.get('/audit', authenticate, async (_req, res, next) => {
  try {
    const items = await prisma.auditLog.findMany({
      where: { type: { in: ['Assy', 'Sub_Assy'] } },
      orderBy: { time: 'desc' },
      take: 40,
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

router.get('/requests', authenticate, async (req, res, next) => {
  try {
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const type = normalizeQueueType(req.query.type)
    const requests = await prisma.productionRequest.findMany({
      where: {
        ...(status ? { status: status as 'pending' | 'allocated' } : {}),
        ...(line ? { line } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { scannedAt: 'desc' },
    })
    res.json(requests)
  } catch (error) {
    next(error)
  }
})

const allocateSchema = z.object({
  targetShift: z.number().int().min(1).max(2),
})

router.post(
  '/requests/:id/allocate',
  authenticate,
  requireRole('admin', 'leader'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { targetShift } = allocateSchema.parse(req.body)
      const request = await prisma.productionRequest.findUnique({
        where: { id: String(req.params.id) },
      })
      if (!request || request.status !== 'pending') {
        return res.status(404).json({ message: 'Request not found or already allocated.' })
      }

      const part = await prisma.productionPart.findUnique({
        where: { partNumber: request.partNumber },
      })
      if (!part) return res.status(400).json({ message: 'Part not found.' })

      const bom = await prisma.bomComponent.findMany({
        where: { parentPartNumber: request.partNumber },
      })
      const componentParts = bom.length
        ? await prisma.productionPart.findMany({
            where: { partNumber: { in: bom.map((component) => component.componentPartNumber) } },
          })
        : []
      const componentMap = new Map(componentParts.map((component) => [component.partNumber, component]))
      const subComponents = bom.filter(
        (component) => componentMap.get(component.componentPartNumber)?.type === 'Sub_Assy',
      )

      const queueItem = await prisma.$transaction(async (tx) => {
        const aggregate = await tx.queueItem.aggregate({ _max: { no: true } })
        let no = (aggregate._max.no ?? 0) + 1

        const mainItem = await tx.queueItem.create({
          data: {
            no,
            partNumber: request.partNumber,
            model: request.model,
            type: request.type,
            line: part.line,
            process: request.type === 'Sub_Assy' ? (request.process ?? part.process) : null,
            sourceShift: request.sourceShift,
            targetShift,
            kanban: request.code,
            taken: request.qty,
            stock: 0,
            time: request.scannedAt.toISOString(),
            priority: 'normal',
            status: 'waiting',
          },
        })

        for (const component of subComponents) {
          const componentPart = componentMap.get(component.componentPartNumber)!
          no += 1
          await tx.queueItem.create({
            data: {
              no,
              partNumber: componentPart.partNumber,
              model: request.model,
              type: 'Sub_Assy',
              line: componentPart.line,
              process: componentPart.process,
              sourceShift: request.sourceShift,
              targetShift,
              kanban: `AUTO-${request.code}-${componentPart.partNumber}`,
              taken: request.qty * component.quantityPerAssy,
              stock: 0,
              time: request.scannedAt.toISOString(),
              priority: 'normal',
              status: 'waiting',
            },
          })
        }

        await tx.productionRequest.update({
          where: { id: request.id },
          data: { status: 'allocated', targetShift },
        })

        await tx.auditLog.create({
          data: {
            title: `Permintaan ${request.code} dialokasikan ke Shift ${targetShift}`,
            detail: `${request.partNumber} · ${request.qty} pcs · ${subComponents.length} komponen Sub Assy`,
            type: request.type,
            line: part.line,
            process: request.type === 'Sub_Assy' ? (request.process ?? part.process) : null,
          },
        })

        return mainItem
      })

      res.json({ ok: true, item: queueItem })
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/requests/:id',
  authenticate,
  requireRole('admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const request = await prisma.productionRequest.findUnique({
        where: { id: String(req.params.id) },
      })
      if (!request) return res.status(404).json({ message: 'Request not found.' })
      if (request.status !== 'pending') {
        return res.status(400).json({ message: 'Hanya permintaan pending yang dapat dihapus.' })
      }
      await prisma.productionRequest.delete({ where: { id: request.id } })
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  },
)

router.get('/queue', authenticate, async (req, res, next) => {
  try {
    const type = normalizeQueueType(req.query.type)
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const targetShift = typeof req.query.targetShift === 'string' ? Number(req.query.targetShift) : undefined
    const items = await prisma.queueItem.findMany({
      where: {
        ...(type ? { type } : {}),
        ...(line ? { line } : {}),
        ...(targetShift ? { targetShift } : {}),
        ...(status ? { status: status as 'waiting' | 'running' | 'complete' } : { status: { not: 'complete' } }),
      },
      orderBy: { no: 'asc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const updateQueueSchema = z.object({
  priority: z.enum(['urgent', 'normal', 'low']).optional(),
  targetShift: z.number().int().min(1).max(2).nullable().optional(),
  status: z.enum(['waiting', 'running', 'complete']).optional(),
})

const operatorRoles = ['operator_assy', 'operator_sub_assy', 'operator_both', 'leader', 'admin']

router.patch(
  '/queue/:id',
  authenticate,
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = updateQueueSchema.parse(req.body)
      const role = req.user!.role
      if (!operatorRoles.includes(role)) {
        return res.status(403).json({ message: 'You do not have permission to perform this action.' })
      }
      if ((body.targetShift !== undefined || body.status !== undefined) && !['admin', 'leader'].includes(role)) {
        return res.status(403).json({ message: 'Only admin or leader can change shift or status.' })
      }
      const item = await prisma.queueItem.update({
        where: { id: String(req.params.id) },
        data: body,
      })
      res.json(item)
    } catch (error) {
      next(error)
    }
  },
)

const orderSchema = z.object({
  ids: z.array(z.string().min(1)).min(1).max(500),
})

router.put(
  '/queue/order',
  authenticate,
  requireRole(...operatorRoles),
  async (req, res, next) => {
    try {
      const { ids } = orderSchema.parse(req.body)
      const found = await prisma.queueItem.count({ where: { id: { in: ids } } })
      if (found !== ids.length) {
        return res.status(400).json({ message: 'One or more queue items were not found.' })
      }
      await prisma.$transaction(
        ids.map((id, index) =>
          prisma.queueItem.update({ where: { id }, data: { no: index + 1 } }),
        ),
      )
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/queue/:id',
  authenticate,
  requireRole('admin', 'leader'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const item = await prisma.queueItem.findUnique({
        where: { id: String(req.params.id) },
      })
      if (!item) return res.status(404).json({ message: 'Queue item not found.' })
      if (item.printedQty > 0) {
        return res.status(400).json({ message: 'Antrean yang sudah dicetak tidak dapat dihapus.' })
      }
      await prisma.queueItem.delete({ where: { id: item.id } })
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  },
)

const printSchema = z.object({
  operator: z.string().min(1).optional(),
})

router.post(
  '/queue/:id/print',
  authenticate,
  requireRole('operator_assy', 'operator_sub_assy', 'operator_both', 'leader', 'admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const { operator } = printSchema.parse(req.body ?? {})
      const item = await prisma.queueItem.findUnique({
        where: { id: String(req.params.id) },
      })
      if (!item || item.status === 'complete') {
        return res.status(404).json({ message: 'Queue item not found.' })
      }

      const part = await prisma.productionPart.findUnique({
        where: { partNumber: item.partNumber },
      })
      const stock = await prisma.stockItem.findUnique({
        where: { partNumber: item.partNumber },
      })
      const packaging = part?.packaging ?? stock?.packaging ?? 0
      if (!packaging) {
        return res.status(400).json({
          message: `Standard packaging for ${item.partNumber} is not configured.`,
        })
      }

      const remainingQty = Math.max(item.taken - item.printedQty, 0)
      if (remainingQty === 0) {
        return res.status(400).json({
          message: `All kanban for ${item.partNumber} have already been printed.`,
        })
      }

      const totalQty = Math.min(packaging, remainingQty)
      const completedKanbans = item.printedKanbans + 1
      const totalKanbans = Math.ceil(item.taken / packaging)
      const completedAt = new Date()
      const operatorName = operator ?? req.user!.name

      const { box, nextPrintedQty } = await prisma.$transaction(async (tx) => {
        const createdBox = await tx.completedBox.create({
          data: {
            partNumber: item.partNumber,
            type: item.type,
            line: item.line,
            qty: totalQty,
            kanban: `${item.kanban}-${String(completedKanbans).padStart(2, '0')}`,
            completedAt,
            completedAtEpoch: BigInt(completedAt.getTime()),
            date: dateKey(completedAt),
            operator: operatorName,
            shift: item.targetShift ?? undefined,
            operatorUserId: req.user!.id,
          },
        })

        const printedQty = item.printedQty + totalQty
        await tx.queueItem.update({
          where: { id: item.id },
          data: {
            printedQty,
            printedKanbans: completedKanbans,
            status: printedQty >= item.taken ? 'complete' : 'running',
          },
        })

        await tx.bufferItem.create({
          data: {
            partNumber: item.partNumber,
            qty: totalQty,
            kanban: createdBox.kanban,
            completedAt,
            operator: operatorName,
            waitingMinutes: 0,
            status: 'pending',
          },
        })

        await tx.auditLog.create({
          data: {
            title: `Kanban ${createdBox.kanban} dicetak (${completedKanbans}/${totalKanbans})`,
            detail: `${item.partNumber} · ${totalQty} pcs selesai produksi`,
            type: item.type,
            line: item.line,
            process: item.process,
          },
        })

        return { box: createdBox, nextPrintedQty: printedQty }
      })

      res.json({ ok: true, box, totalQty, completedKanbans, totalKanbans, printedQty: nextPrintedQty })
    } catch (error) {
      next(error)
    }
  },
)

router.get('/results', authenticate, async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const type = normalizeQueueType(req.query.type)
    const records = await prisma.productionShiftRecord.findMany({
      where: {
        ...(date ? { date } : {}),
        ...(line ? { line } : {}),
        ...(type ? { type } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(records)
  } catch (error) {
    next(error)
  }
})

const resultSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partNumber: z.string().min(1),
  type: queueTypeSchema,
  shift: z.number().int().min(1).max(2),
  ok: z.number().int().nonnegative(),
  ng: z.number().int().nonnegative(),
  line: z.string().min(1),
  process: z.string().optional(),
})

router.post(
  '/results',
  authenticate,
  requireRole('operator_assy', 'operator_sub_assy', 'operator_both', 'leader', 'admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = resultSchema.parse(req.body)
      const partNumber = body.partNumber.trim().toUpperCase()
      const part = await prisma.productionPart.findUnique({ where: { partNumber } })
      if (!part) return res.status(400).json({ message: 'Part number is not registered.' })

      const date = body.date ?? dateKey()
      const process = body.process ?? ''
      const record = await prisma.productionShiftRecord.upsert({
        where: {
          date_partNumber_type_shift_line_process: {
            date,
            partNumber,
            type: body.type,
            shift: body.shift,
            line: body.line,
            process,
          },
        },
        update: {
          ok: body.ok,
          ng: body.ng,
          operator: req.user!.name,
          time: new Date().toTimeString().slice(0, 8),
          updatedAtEpoch: BigInt(Date.now()),
          operatorUserId: req.user!.id,
        },
        create: {
          date,
          partNumber,
          type: body.type,
          shift: body.shift,
          ok: body.ok,
          ng: body.ng,
          operator: req.user!.name,
          time: new Date().toTimeString().slice(0, 8),
          line: body.line,
          process,
          updatedAtEpoch: BigInt(Date.now()),
          operatorUserId: req.user!.id,
        },
      })

      await prisma.auditLog.create({
        data: {
          title: `Hasil shift ${partNumber} disimpan`,
          detail: `Shift ${body.shift} · OK ${body.ok} · NG ${body.ng}`,
          type: body.type,
          line: body.line,
          process: body.process,
        },
      })

      res.json(record)
    } catch (error) {
      next(error)
    }
  },
)

router.get('/ng', authenticate, async (req, res, next) => {
  try {
    const date = typeof req.query.date === 'string' ? req.query.date : undefined
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const records = await prisma.ngShiftRecord.findMany({
      where: {
        ...(date ? { date } : {}),
        ...(line ? { line } : {}),
      },
      orderBy: { createdAt: 'desc' },
    })
    res.json(records)
  } catch (error) {
    next(error)
  }
})

const ngSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  partNumber: z.string().min(1),
  type: queueTypeSchema,
  shift: z.number().int().min(1).max(2),
  ng: z.number().int().nonnegative(),
  line: z.string().min(1),
})

router.post(
  '/ng',
  authenticate,
  requireRole('operator_assy', 'operator_sub_assy', 'operator_both', 'leader', 'admin'),
  async (req: AuthenticatedRequest, res, next) => {
    try {
      const body = ngSchema.parse(req.body)
      const partNumber = body.partNumber.trim().toUpperCase()
      const part = await prisma.productionPart.findUnique({ where: { partNumber } })
      if (!part) return res.status(400).json({ message: 'Part number is not registered.' })

      const date = body.date ?? dateKey()
      const existing = await prisma.ngShiftRecord.findFirst({
        where: { date, partNumber, type: body.type, shift: body.shift, line: body.line },
      })
      const data = {
        date,
        partNumber,
        type: body.type,
        shift: body.shift,
        ng: body.ng,
        line: body.line,
        operator: req.user!.name,
        time: new Date().toTimeString().slice(0, 8),
        updatedAtEpoch: BigInt(Date.now()),
      }
      const record = existing
        ? await prisma.ngShiftRecord.update({ where: { id: existing.id }, data })
        : await prisma.ngShiftRecord.create({ data })

      res.json(record)
    } catch (error) {
      next(error)
    }
  },
)

/* Schedules */

router.get('/schedules', authenticate, async (req, res, next) => {
  try {
    const shift = typeof req.query.shift === 'string' ? Number(req.query.shift) : undefined
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const items = await prisma.scheduleItem.findMany({
      where: {
        ...(shift ? { shift } : {}),
        ...(line ? { line } : {}),
      },
      orderBy: [{ shift: 'asc' }, { dueTime: 'asc' }],
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const scheduleSchema = z.object({
  partNumber: z.string().min(1),
  model: z.string().min(1),
  target: z.number().int().nonnegative(),
  actual: z.number().int().nonnegative().optional(),
  status: z.string().optional(),
  shift: z.number().int().min(1).max(2),
  dueTime: z.string().min(1),
  line: z.string().min(1),
})

router.post(
  '/schedules',
  authenticate,
  requireRole('admin', 'leader'),
  async (req, res, next) => {
    try {
      const body = scheduleSchema.parse(req.body)
      const part = await prisma.productionPart.findUnique({
        where: { partNumber: body.partNumber.trim().toUpperCase() },
      })
      if (!part) return res.status(400).json({ message: 'Part number is not registered.' })
      const item = await prisma.scheduleItem.create({
        data: { ...body, partNumber: part.partNumber },
      })
      res.status(201).json(item)
    } catch (error) {
      next(error)
    }
  },
)

router.patch(
  '/schedules/:id',
  authenticate,
  requireRole('admin', 'leader'),
  async (req, res, next) => {
    try {
      const body = scheduleSchema.partial().parse(req.body)
      const item = await prisma.scheduleItem.update({
        where: { id: String(req.params.id) },
        data: body,
      })
      res.json(item)
    } catch (error) {
      next(error)
    }
  },
)

router.delete(
  '/schedules/:id',
  authenticate,
  requireRole('admin', 'leader'),
  async (req, res, next) => {
    try {
      await prisma.scheduleItem.delete({ where: { id: String(req.params.id) } })
      res.json({ ok: true })
    } catch (error) {
      next(error)
    }
  },
)

export default router
