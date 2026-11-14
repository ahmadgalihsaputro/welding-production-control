import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js'
import { stockStatus } from '../lib/stock.js'
import { workAreaMismatchForRole } from '../lib/workAreas.js'

const router = Router()

router.use(authenticate)

const writeRoles = requireRole('admin', 'leader')

const queueType = z.enum(['Assy', 'Sub_Assy'])

/* Parts */

router.get('/parts', async (req, res, next) => {
  try {
    const type = typeof req.query.type === 'string' ? req.query.type : undefined
    const line = typeof req.query.line === 'string' ? req.query.line : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const items = await prisma.productionPart.findMany({
      where: {
        ...(type === 'Assy' || type === 'Sub_Assy' ? { type } : {}),
        ...(line ? { line } : {}),
        ...(status === 'active' || status === 'inactive' ? { status } : {}),
        ...(search
          ? {
              OR: [
                { partNumber: { contains: search, mode: 'insensitive' } },
                { process: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: { partNumber: 'asc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const partSchema = z.object({
  partNumber: z.string().min(1),
  line: z.string().min(1),
  type: queueType,
  process: z.string().min(1),
  models: z.array(z.string()).default([]),
  packaging: z.number().int().positive().nullable().optional(),
  maxStore: z.number().int().nonnegative().nullable().optional(),
  cycleTime: z.number().positive().nullable().optional(),
  cycleGroupId: z.string().nullable().optional(),
  placeholder: z.boolean().optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

async function resolvePartModels(models: string[]): Promise<{ codes: string[]; error: string | null }> {
  const codes = Array.from(
    new Set(models.map((model) => model.trim().toUpperCase()).filter(Boolean)),
  )
  if (codes.length === 0) {
    return { codes: [], error: 'Minimal satu model wajib dipilih.' }
  }
  const existing = await prisma.productionModel.findMany({
    where: { code: { in: codes } },
    select: { code: true },
  })
  if (existing.length !== codes.length) {
    const known = new Set(existing.map((model) => model.code))
    const missing = codes.filter((code) => !known.has(code))
    return {
      codes: [],
      error: `Model belum terdaftar di Master Model: ${missing.join(', ')}.`,
    }
  }
  return { codes, error: null }
}

router.get('/parts/:partNumber', async (req, res, next) => {
  try {
    const item = await prisma.productionPart.findUnique({
      where: { partNumber: String(req.params.partNumber).toUpperCase() },
    })
    if (!item) return res.status(404).json({ message: 'Part not found.' })
    res.json(item)
  } catch (error) {
    next(error)
  }
})

router.post('/parts', writeRoles, async (req, res, next) => {
  try {
    const body = partSchema.parse(req.body)
    const partNumber = body.partNumber.trim().toUpperCase()
    const process = body.process.trim()
    const models = await resolvePartModels(body.models)
    if (models.error) return res.status(400).json({ message: models.error })

    const existing = await prisma.productionPart.findUnique({ where: { partNumber } })
    if (existing) {
      return res.status(409).json({
        message: 'Part number sudah terdaftar. Gunakan edit untuk memperbarui data part.',
      })
    }

    const { partNumber: _partNumber, process: _process, models: _models, cycleGroupId, ...rest } = body
    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.productionPart.create({
        data: {
          ...rest,
          partNumber,
          process,
          models: models.codes,
          cycleGroupId: cycleGroupId?.trim().toUpperCase() || null,
          status: body.status ?? 'active',
        },
      })
      const stockData: Record<string, number> = {}
      if (body.packaging !== undefined && body.packaging !== null) {
        stockData.packaging = body.packaging
      }
      if (body.maxStore !== undefined && body.maxStore !== null) {
        stockData.maxStore = body.maxStore
      }
      if (Object.keys(stockData).length > 0) {
        await tx.stockItem.upsert({
          where: { partNumber },
          update: stockData,
          create: {
            partNumber,
            description: partNumber,
            category: body.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy',
            ...stockData,
            safetyStock: 0,
            maxStore: body.maxStore ?? 0,
            location: 'Box standard · ',
            status: 'safe',
          },
        })
      }
      return created
    })
    res.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

router.patch('/parts/:partNumber', writeRoles, async (req: AuthenticatedRequest, res, next) => {
  try {
    const partNumber = String(req.params.partNumber).toUpperCase()
    const body = partSchema.partial().parse(req.body)
    if (body.partNumber && body.partNumber.trim().toUpperCase() !== partNumber) {
      return res.status(400).json({
        message: 'Part number tidak dapat diubah setelah part dibuat.',
      })
    }

    const data: Record<string, unknown> = { ...body }
    delete data.partNumber
    if (body.process !== undefined) data.process = body.process.trim()
    if (body.cycleGroupId !== undefined) {
      data.cycleGroupId = body.cycleGroupId?.trim().toUpperCase() || null
    }
    if (body.models !== undefined) {
      const models = await resolvePartModels(body.models)
      if (models.error) return res.status(400).json({ message: models.error })
      data.models = models.codes
    }

    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.productionPart.findUnique({ where: { partNumber } })
      if (!current) return { kind: 'missing' as const }
      const mappingChanged =
        (body.line !== undefined && body.line.trim() !== current.line) ||
        (body.process !== undefined && body.process.trim() !== current.process)
      if (mappingChanged) {
        const [pendingRequests, activeQueueItems] = await Promise.all([
          tx.productionRequest.count({ where: { partNumber, status: 'pending' } }),
          tx.queueItem.count({
            where: { partNumber, status: { in: ['waiting', 'running'] } },
          }),
        ])
        if (pendingRequests > 0 || activeQueueItems > 0) {
          return {
            kind: 'blocked' as const,
            pendingRequests,
            activeQueueItems,
          }
        }
      }

      const updated = await tx.productionPart.update({
        where: { partNumber },
        data: data as never,
      })
      const stockData: Record<string, number> = {}
      if (body.packaging !== undefined && body.packaging !== null) {
        stockData.packaging = body.packaging
      }
      if (body.maxStore !== undefined && body.maxStore !== null) {
        stockData.maxStore = body.maxStore
      }
      if (Object.keys(stockData).length > 0) {
        await tx.stockItem.upsert({
          where: { partNumber },
          update: stockData,
          create: {
            partNumber,
            description: partNumber,
            category: updated.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy',
            ...stockData,
            safetyStock: 0,
            maxStore: body.maxStore ?? updated.maxStore ?? 0,
            location: 'Box standard · ',
            status: 'safe',
          },
        })
      }
      if (mappingChanged) {
        await tx.auditLog.create({
          data: {
            title: `Mapping line part ${partNumber} diperbarui`,
            detail: `${current.line} · ${current.process} → ${updated.line} · ${updated.process}; saldo stok dan riwayat transaksi lama tidak diubah; berlaku untuk transaksi baru. Diubah oleh ${req.user!.name}.`,
            type: 'master',
            line: updated.line,
            process: updated.process,
          },
        })
      }
      return { kind: 'updated' as const, item: updated }
    })
    if (result.kind === 'missing') return res.status(404).json({ message: 'Part tidak ditemukan.' })
    if (result.kind === 'blocked') {
      const activeWork = [
        result.pendingRequests > 0 ? `${result.pendingRequests} request pending` : null,
        result.activeQueueItems > 0 ? `${result.activeQueueItems} item antrean aktif` : null,
      ]
        .filter((item): item is string => item !== null)
        .join(' dan ')
      return res.status(409).json({
        message:
          `Mapping part belum dapat dipindah: selesaikan atau batalkan ${activeWork} terlebih dahulu.`,
      })
    }
    res.json(result.item)
  } catch (error) {
    next(error)
  }
})

router.delete('/parts/:partNumber', requireRole('admin'), async (req, res, next) => {
  try {
    const partNumber = String(req.params.partNumber).toUpperCase()
    const [requests, queue, boxes, results, ng, bom, routings, schedules, stock] = await Promise.all([
      prisma.productionRequest.count({ where: { partNumber } }),
      prisma.queueItem.count({ where: { partNumber } }),
      prisma.completedBox.count({ where: { partNumber } }),
      prisma.productionShiftRecord.count({ where: { partNumber } }),
      prisma.ngShiftRecord.count({ where: { partNumber } }),
      prisma.bomComponent.count({
        where: { OR: [{ parentPartNumber: partNumber }, { componentPartNumber: partNumber }] },
      }),
      prisma.routing.count({ where: { partNumber } }),
      prisma.scheduleItem.count({ where: { partNumber } }),
      prisma.stockItem.count({ where: { partNumber } }),
    ])
    if (requests + queue + boxes + results + ng > 0) {
      return res.status(400).json({
        message: 'Part masih memiliki transaksi produksi dan tidak dapat dihapus.',
      })
    }
    if (bom + routings + schedules > 0) {
      const usage = [
        bom > 0 ? `${bom} relasi BOM` : null,
        routings > 0 ? `${routings} routing` : null,
        schedules > 0 ? `${schedules} jadwal` : null,
      ]
        .filter(Boolean)
        .join(', ')
      return res.status(400).json({
        message: `Part masih dipakai oleh ${usage}. Hapus relasi tersebut terlebih dahulu atau nonaktifkan part.`,
      })
    }

    const hasStock = stock > 0
    if (hasStock) {
      await prisma.$transaction([
        prisma.stockItem.delete({ where: { partNumber } }),
        prisma.productionPart.delete({ where: { partNumber } }),
      ])
    } else {
      await prisma.productionPart.delete({ where: { partNumber } })
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Production models */

router.get('/models', async (_req, res, next) => {
  try {
    const [models, parts] = await Promise.all([
      prisma.productionModel.findMany({ orderBy: { code: 'asc' } }),
      prisma.productionPart.findMany(),
    ])
    res.json(
      models.map((model) => ({
        ...model,
        assyParts: parts.filter((part) => part.type === 'Assy' && part.models.includes(model.code)).length,
        subAssyParts: parts.filter((part) => part.type === 'Sub_Assy' && part.models.includes(model.code)).length,
      })),
    )
  } catch (error) {
    next(error)
  }
})

const modelSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(['active', 'inactive']).optional(),
})

router.post('/models', writeRoles, async (req, res, next) => {
  try {
    const body = modelSchema.parse(req.body)
    const code = body.code.trim().toUpperCase()
    const existing = await prisma.productionModel.findUnique({ where: { code } })
    if (existing) {
      return res.status(409).json({
        message: 'Kode model sudah terdaftar. Gunakan edit untuk memperbarui nama atau status.',
      })
    }
    const model = await prisma.productionModel.create({
      data: {
        code,
        name: body.name.trim(),
        status: body.status ?? 'active',
      },
    })
    res.status(201).json(model)
  } catch (error) {
    next(error)
  }
})

router.patch('/models/:id', writeRoles, async (req, res, next) => {
  try {
    const body = modelSchema.partial().parse(req.body)
    const existing = await prisma.productionModel.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!existing) return res.status(404).json({ message: 'Model tidak ditemukan.' })
    if (body.code && body.code.trim().toUpperCase() !== existing.code) {
      return res.status(400).json({
        message:
          'Kode model tidak dapat diubah karena dipakai oleh part, routing, dan jadwal. Ubah nama atau status saja.',
      })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.status !== undefined) data.status = body.status

    const model = await prisma.productionModel.update({
      where: { id: existing.id },
      data: data as never,
    })
    res.json(model)
  } catch (error) {
    next(error)
  }
})

router.delete('/models/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const model = await prisma.productionModel.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!model) return res.status(404).json({ message: 'Model tidak ditemukan.' })

    const [parts, routings, schedules] = await Promise.all([
      prisma.productionPart.count({ where: { models: { has: model.code } } }),
      prisma.routing.count({ where: { model: model.code } }),
      prisma.scheduleItem.count({ where: { model: model.code } }),
    ])
    if (parts + routings + schedules > 0) {
      const usage = [
        parts > 0 ? `${parts} part` : null,
        routings > 0 ? `${routings} routing` : null,
        schedules > 0 ? `${schedules} jadwal` : null,
      ]
        .filter(Boolean)
        .join(', ')
      return res.status(400).json({
        message: `Model ${model.code} masih dipakai oleh ${usage}. Nonaktifkan model agar histori tetap utuh.`,
      })
    }

    await prisma.productionModel.delete({ where: { id: model.id } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Machines */

router.get('/machines', async (_req, res, next) => {
  try {
    res.json(await prisma.machine.findMany({ orderBy: { code: 'asc' } }))
  } catch (error) {
    next(error)
  }
})

const machineSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  line: z.string().min(1),
  processes: z.array(z.string()).default([]),
  status: z.enum(['active', 'inactive', 'maintenance']).optional(),
})

async function machineRoutingUsage(code: string): Promise<string[]> {
  const routings = await prisma.routing.findMany({
    select: { partNumber: true, model: true, version: true, steps: true },
  })
  const usages: string[] = []
  for (const routing of routings) {
    const steps = Array.isArray(routing.steps)
      ? (routing.steps as Array<Record<string, unknown>>)
      : []
    if (steps.some((step) => String(step.machine ?? '').trim().toUpperCase() === code)) {
      usages.push(`${routing.partNumber} ${routing.model} v${routing.version}`)
    }
  }
  return usages
}

router.post('/machines', writeRoles, async (req, res, next) => {
  try {
    const body = machineSchema.parse(req.body)
    const code = body.code.trim().toUpperCase()
    const existing = await prisma.machine.findUnique({ where: { code } })
    if (existing) {
      return res.status(409).json({
        message: 'Kode machine sudah terdaftar. Gunakan edit untuk memperbarui data machine.',
      })
    }
    const machine = await prisma.machine.create({
      data: {
        code,
        name: body.name.trim(),
        line: body.line.trim(),
        processes: body.processes.map((process) => process.trim()).filter(Boolean),
        status: body.status ?? 'active',
      },
    })
    res.status(201).json(machine)
  } catch (error) {
    next(error)
  }
})

router.patch('/machines/:id', writeRoles, async (req, res, next) => {
  try {
    const body = machineSchema.partial().parse(req.body)
    const existing = await prisma.machine.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!existing) return res.status(404).json({ message: 'Machine tidak ditemukan.' })
    if (body.code && body.code.trim().toUpperCase() !== existing.code) {
      return res.status(400).json({
        message:
          'Kode machine tidak dapat diubah karena dipakai pada routing. Ubah nama, line, proses, atau status saja.',
      })
    }

    const data: Record<string, unknown> = {}
    if (body.name !== undefined) data.name = body.name.trim()
    if (body.line !== undefined) data.line = body.line.trim()
    if (body.processes !== undefined) {
      data.processes = body.processes.map((process) => process.trim()).filter(Boolean)
    }
    if (body.status !== undefined) data.status = body.status

    const machine = await prisma.machine.update({
      where: { id: existing.id },
      data: data as never,
    })
    res.json(machine)
  } catch (error) {
    next(error)
  }
})

router.delete('/machines/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const machine = await prisma.machine.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!machine) return res.status(404).json({ message: 'Machine tidak ditemukan.' })

    const usages = await machineRoutingUsage(machine.code)
    if (usages.length > 0) {
      return res.status(400).json({
        message: `Machine ${machine.code} masih dipakai di routing ${usages.join(', ')}. Nonaktifkan machine agar histori routing tetap utuh.`,
      })
    }

    await prisma.machine.delete({ where: { id: machine.id } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* BOM */

type BomComponentSource = 'production' | 'stock'

interface BomRow {
  id: string
  parentPartNumber: string
  componentPartNumber: string
  quantityPerAssy: number
  createdAt: Date
  updatedAt: Date
}

async function enrichBomRows(rows: BomRow[]) {
  if (rows.length === 0) return []
  const partNumbers = Array.from(new Set(rows.map((row) => row.componentPartNumber)))
  const [parts, stocks] = await Promise.all([
    prisma.productionPart.findMany({ where: { partNumber: { in: partNumbers } } }),
    prisma.stockItem.findMany({ where: { partNumber: { in: partNumbers } } }),
  ])
  const partMap = new Map(parts.map((part) => [part.partNumber, part]))
  const stockMap = new Map(stocks.map((stock) => [stock.partNumber, stock]))
  return rows.map((row) => {
    const part = partMap.get(row.componentPartNumber)
    const stock = stockMap.get(row.componentPartNumber)
    return {
      ...row,
      source: (part ? 'production' : 'stock') as BomComponentSource,
      description: stock?.description ?? null,
      category: stock?.category ?? part?.type ?? null,
      type: part?.type ?? null,
      line: part?.line ?? null,
      process: part?.process ?? null,
      partStatus: part?.status ?? null,
    }
  })
}

async function resolveBomComponent(rawPartNumber: string) {
  const partNumber = rawPartNumber.trim().toUpperCase()
  if (!partNumber) {
    return { partNumber, source: null as BomComponentSource | null, error: 'Part number komponen wajib diisi.' }
  }
  const [part, stock] = await Promise.all([
    prisma.productionPart.findUnique({ where: { partNumber } }),
    prisma.stockItem.findUnique({ where: { partNumber } }),
  ])
  if (!part && !stock) {
    return {
      partNumber,
      source: null as BomComponentSource | null,
      error:
        'Komponen belum terdaftar. Daftarkan dulu sebagai Part Number produksi atau Stock Item.',
    }
  }
  return {
    partNumber,
    source: (part ? 'production' : 'stock') as BomComponentSource,
    error: null as string | null,
  }
}

router.get('/bom', async (req, res, next) => {
  try {
    const parentPartNumber =
      typeof req.query.parentPartNumber === 'string'
        ? req.query.parentPartNumber.toUpperCase()
        : undefined
    const items = await prisma.bomComponent.findMany({
      where: parentPartNumber ? { parentPartNumber } : undefined,
      orderBy: [{ parentPartNumber: 'asc' }, { componentPartNumber: 'asc' }],
    })
    res.json(await enrichBomRows(items))
  } catch (error) {
    next(error)
  }
})

router.get('/bom/:parentPartNumber', async (req, res, next) => {
  try {
    const parentPartNumber = String(req.params.parentPartNumber).toUpperCase()
    const [parent, components] = await Promise.all([
      prisma.productionPart.findUnique({ where: { partNumber: parentPartNumber } }),
      prisma.bomComponent.findMany({
        where: { parentPartNumber },
        orderBy: { componentPartNumber: 'asc' },
      }),
    ])
    if (!parent) return res.status(404).json({ message: 'Parent part tidak ditemukan.' })
    res.json({ parentPartNumber, parent, components: await enrichBomRows(components) })
  } catch (error) {
    next(error)
  }
})

const bomComponentSchema = z.object({
  partNumber: z.string().min(1),
  quantityPerAssy: z.number().int().min(1),
})

const bomQuantitySchema = z.object({
  quantityPerAssy: z.number().int().min(1),
})

const bomSchema = z.object({
  components: z.array(bomComponentSchema),
})

router.post('/bom/:parentPartNumber', writeRoles, async (req, res, next) => {
  try {
    const parentPartNumber = String(req.params.parentPartNumber).toUpperCase()
    const body = bomComponentSchema.parse(req.body)
    const parent = await prisma.productionPart.findUnique({ where: { partNumber: parentPartNumber } })
    if (!parent) return res.status(404).json({ message: 'Parent part tidak ditemukan.' })

    const component = await resolveBomComponent(body.partNumber)
    if (component.error) return res.status(400).json({ message: component.error })
    if (component.partNumber === parentPartNumber) {
      return res.status(400).json({ message: 'Part tidak dapat menjadi komponen BOM dirinya sendiri.' })
    }

    const existing = await prisma.bomComponent.findUnique({
      where: {
        parentPartNumber_componentPartNumber: {
          parentPartNumber,
          componentPartNumber: component.partNumber,
        },
      },
    })
    if (existing) {
      return res.status(409).json({
        message: 'Komponen sudah ada di BOM parent ini. Ubah qty lewat baris yang tersedia.',
      })
    }

    const created = await prisma.bomComponent.create({
      data: {
        parentPartNumber,
        componentPartNumber: component.partNumber,
        quantityPerAssy: body.quantityPerAssy,
      },
    })
    const [item] = await enrichBomRows([created])
    res.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

router.patch('/bom/:parentPartNumber/:componentPartNumber', writeRoles, async (req, res, next) => {
  try {
    const parentPartNumber = String(req.params.parentPartNumber).toUpperCase()
    const componentPartNumber = String(req.params.componentPartNumber).toUpperCase()
    const body = bomQuantitySchema.parse(req.body)
    const existing = await prisma.bomComponent.findUnique({
      where: {
        parentPartNumber_componentPartNumber: { parentPartNumber, componentPartNumber },
      },
    })
    if (!existing) return res.status(404).json({ message: 'Baris BOM tidak ditemukan.' })

    const updated = await prisma.bomComponent.update({
      where: { id: existing.id },
      data: { quantityPerAssy: body.quantityPerAssy },
    })
    const [item] = await enrichBomRows([updated])
    res.json(item)
  } catch (error) {
    next(error)
  }
})

router.delete('/bom/:parentPartNumber/:componentPartNumber', writeRoles, async (req, res, next) => {
  try {
    const parentPartNumber = String(req.params.parentPartNumber).toUpperCase()
    const componentPartNumber = String(req.params.componentPartNumber).toUpperCase()
    const existing = await prisma.bomComponent.findUnique({
      where: {
        parentPartNumber_componentPartNumber: { parentPartNumber, componentPartNumber },
      },
    })
    if (!existing) return res.status(404).json({ message: 'Baris BOM tidak ditemukan.' })
    await prisma.bomComponent.delete({ where: { id: existing.id } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

router.put('/bom/:parentPartNumber', writeRoles, async (req, res, next) => {
  try {
    const parentPartNumber = String(req.params.parentPartNumber).toUpperCase()
    const body = bomSchema.parse(req.body)
    const parent = await prisma.productionPart.findUnique({ where: { partNumber: parentPartNumber } })
    if (!parent) return res.status(404).json({ message: 'Parent part tidak ditemukan.' })

    const partNumbers = Array.from(
      new Set(body.components.map((component) => component.partNumber.trim().toUpperCase())),
    )
    if (partNumbers.length !== body.components.length) {
      return res.status(400).json({ message: 'Komponen yang sama tidak boleh diduplikasi.' })
    }
    if (partNumbers.includes(parentPartNumber)) {
      return res.status(400).json({ message: 'Part tidak dapat menjadi komponen BOM dirinya sendiri.' })
    }

    const resolved = await Promise.all(partNumbers.map((partNumber) => resolveBomComponent(partNumber)))
    const invalid = resolved.find((component) => component.error)
    if (invalid) return res.status(400).json({ message: invalid.error })

    const components = await prisma.$transaction(async (tx) => {
      await tx.bomComponent.deleteMany({ where: { parentPartNumber } })
      if (body.components.length > 0) {
        await tx.bomComponent.createMany({
          data: body.components.map((component) => ({
            parentPartNumber,
            componentPartNumber: component.partNumber.trim().toUpperCase(),
            quantityPerAssy: component.quantityPerAssy,
          })),
        })
      }
      return tx.bomComponent.findMany({
        where: { parentPartNumber },
        orderBy: { componentPartNumber: 'asc' },
      })
    })

    res.json({ parentPartNumber, components: await enrichBomRows(components) })
  } catch (error) {
    next(error)
  }
})

router.delete('/bom/:parentPartNumber', writeRoles, async (req, res, next) => {
  try {
    await prisma.bomComponent.deleteMany({
      where: { parentPartNumber: String(req.params.parentPartNumber).toUpperCase() },
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Routing */

router.get('/routings', async (req, res, next) => {
  try {
    const partNumber = typeof req.query.partNumber === 'string' ? req.query.partNumber.toUpperCase() : undefined
    const items = await prisma.routing.findMany({
      where: partNumber ? { partNumber } : undefined,
      orderBy: [{ partNumber: 'asc' }, { model: 'asc' }],
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const routingStepSchema = z.object({
  step: z.number().int().positive(),
  process: z.string().min(1),
  machine: z.string().min(1),
  cycle: z.number().nonnegative(),
  status: z.enum(['active', 'inactive']).default('active'),
})

const routingSchema = z.object({
  partNumber: z.string().min(1),
  model: z.string().min(1),
  version: z.string().min(1).default('1.0'),
  effectiveDate: z.string().min(1),
  steps: z.array(routingStepSchema),
  status: z.enum(['active', 'inactive']).optional(),
})

type RoutingStepInput = z.infer<typeof routingStepSchema>

function normalizeRoutingSteps(steps: RoutingStepInput[]) {
  return steps.map((step) => ({
    ...step,
    process: step.process.trim(),
    machine: step.machine.trim().toUpperCase(),
  }))
}

async function validateRoutingReferences(model: string, steps: RoutingStepInput[]) {
  const modelCode = model.trim().toUpperCase()
  const modelExists = await prisma.productionModel.findUnique({ where: { code: modelCode } })
  if (!modelExists) {
    return { error: `Model ${modelCode} belum terdaftar di Master Model.` }
  }

  const machineCodes = Array.from(
    new Set(steps.map((step) => step.machine.trim().toUpperCase()).filter(Boolean)),
  )
  const machines = await prisma.machine.findMany({
    where: { code: { in: machineCodes } },
    select: { code: true },
  })
  const known = new Set(machines.map((machine) => machine.code))
  const missing = machineCodes.filter((code) => !known.has(code))
  if (missing.length > 0) {
    return { error: `Machine belum terdaftar di Master Machine: ${missing.join(', ')}.` }
  }
  return { error: null }
}

router.post('/routings', writeRoles, async (req, res, next) => {
  try {
    const body = routingSchema.parse(req.body)
    const partNumber = body.partNumber.trim().toUpperCase()
    const model = body.model.trim().toUpperCase()
    const version = body.version.trim()
    const steps = normalizeRoutingSteps(body.steps)

    const part = await prisma.productionPart.findUnique({ where: { partNumber } })
    if (!part) {
      return res.status(400).json({ message: `Part number ${partNumber} belum terdaftar.` })
    }
    const references = await validateRoutingReferences(model, steps)
    if (references.error) return res.status(400).json({ message: references.error })

    const existing = await prisma.routing.findUnique({
      where: { partNumber_model_version: { partNumber, model, version } },
    })
    if (existing) {
      return res.status(409).json({
        message: `Routing ${partNumber} model ${model} versi ${version} sudah ada. Gunakan edit untuk memperbarui.`,
      })
    }

    const routing = await prisma.routing.create({
      data: {
        partNumber,
        model,
        version,
        effectiveDate: body.effectiveDate,
        steps,
        status: body.status ?? 'active',
      },
    })
    res.status(201).json(routing)
  } catch (error) {
    next(error)
  }
})

router.patch('/routings/:id', writeRoles, async (req, res, next) => {
  try {
    const body = routingSchema.partial().parse(req.body)
    const existing = await prisma.routing.findUnique({
      where: { id: String(req.params.id) },
    })
    if (!existing) return res.status(404).json({ message: 'Routing tidak ditemukan.' })

    const data: Record<string, unknown> = {}
    if (body.partNumber !== undefined) {
      const partNumber = body.partNumber.trim().toUpperCase()
      const part = await prisma.productionPart.findUnique({ where: { partNumber } })
      if (!part) {
        return res.status(400).json({ message: `Part number ${partNumber} belum terdaftar.` })
      }
      data.partNumber = partNumber
    }
    if (body.model !== undefined) data.model = body.model.trim().toUpperCase()
    if (body.version !== undefined) data.version = body.version.trim()
    if (body.effectiveDate !== undefined) data.effectiveDate = body.effectiveDate
    if (body.status !== undefined) data.status = body.status

    if (body.steps !== undefined) {
      const steps = normalizeRoutingSteps(body.steps)
      const model = body.model !== undefined ? body.model : existing.model
      const references = await validateRoutingReferences(model, steps)
      if (references.error) return res.status(400).json({ message: references.error })
      data.steps = steps
    } else if (body.model !== undefined) {
      const model = body.model.trim().toUpperCase()
      const modelExists = await prisma.productionModel.findUnique({ where: { code: model } })
      if (!modelExists) {
        return res.status(400).json({ message: `Model ${model} belum terdaftar di Master Model.` })
      }
    }

    const routing = await prisma.routing.update({
      where: { id: existing.id },
      data: data as never,
    })
    res.json(routing)
  } catch (error) {
    next(error)
  }
})

router.delete('/routings/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.routing.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Stock policy */

router.get('/stock-policy', async (req, res, next) => {
  try {
    const category = typeof req.query.category === 'string' ? req.query.category : undefined
    const items = await prisma.stockItem.findMany({
      where: category ? { category } : undefined,
      orderBy: { partNumber: 'asc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const stockPolicySchema = z.object({
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  packaging: z.number().int().positive().optional(),
  maxStore: z.number().int().nonnegative().optional(),
  safetyStock: z.number().int().nonnegative().optional(),
  location: z.string().min(1).optional(),
})

const stockPolicyCreateSchema = z.object({
  partNumber: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  packaging: z.number().int().positive(),
  maxStore: z.number().int().nonnegative().default(0),
  safetyStock: z.number().int().nonnegative().default(0),
  location: z.string().min(1),
})

router.post('/stock-policy', writeRoles, async (req, res, next) => {
  try {
    const body = stockPolicyCreateSchema.parse(req.body)
    const partNumber = body.partNumber.trim().toUpperCase()
    const existing = await prisma.stockItem.findUnique({ where: { partNumber } })
    if (existing) {
      return res.status(409).json({
        message: 'Part number sudah terdaftar sebagai stock item. Gunakan edit untuk memperbarui.',
      })
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.stockItem.create({
        data: {
          partNumber,
          description: body.description.trim(),
          category: body.category.trim(),
          packaging: body.packaging,
          maxStore: body.maxStore,
          safetyStock: body.safetyStock,
          location: body.location.trim(),
          status: stockStatus(0, body.safetyStock, body.maxStore),
        },
      })
      await tx.productionPart.upsert({
        where: { partNumber },
        update: { packaging: body.packaging, maxStore: body.maxStore },
        create: {
          partNumber,
          line: 'Robot G',
          type: 'Assy',
          process: 'UNKNOWN',
          models: [],
          packaging: body.packaging,
          maxStore: body.maxStore,
          status: 'inactive',
        },
      })
      return created
    })
    res.status(201).json(item)
  } catch (error) {
    next(error)
  }
})

router.patch('/stock-policy/:partNumber', writeRoles, async (req, res, next) => {
  try {
    const body = stockPolicySchema.parse(req.body)
    const partNumber = String(req.params.partNumber).toUpperCase()
    const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
    if (!stock) return res.status(404).json({ message: 'Stock item tidak ditemukan.' })

    const maxStore = body.maxStore ?? stock.maxStore
    const safetyStock = body.safetyStock ?? stock.safetyStock
    const data: Record<string, unknown> = { status: stockStatus(stock.store, safetyStock, maxStore) }
    if (body.description !== undefined) data.description = body.description.trim()
    if (body.category !== undefined) data.category = body.category.trim()
    if (body.packaging !== undefined) data.packaging = body.packaging
    if (body.maxStore !== undefined) data.maxStore = body.maxStore
    if (body.safetyStock !== undefined) data.safetyStock = body.safetyStock
    if (body.location !== undefined) data.location = body.location.trim()

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.stockItem.update({
        where: { partNumber },
        data: data as never,
      })
      const partData: Record<string, number> = {}
      if (body.packaging !== undefined) partData.packaging = body.packaging
      if (body.maxStore !== undefined) partData.maxStore = body.maxStore
      if (Object.keys(partData).length > 0) {
        await tx.productionPart.upsert({
          where: { partNumber },
          update: partData,
          create: {
            partNumber,
            line: 'Robot G',
            type: 'Assy',
            process: 'UNKNOWN',
            models: [],
            ...partData,
            status: 'inactive',
          },
        })
      }
      return item
    })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

router.delete('/stock-policy/:partNumber', requireRole('admin'), async (req, res, next) => {
  try {
    const partNumber = String(req.params.partNumber).toUpperCase()
    const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
    if (!stock) return res.status(404).json({ message: 'Stock item tidak ditemukan.' })

    const [parts, bom, material, buffer, ledger, requests, queue, boxes, results, ng, routings, schedules] = await Promise.all([
      prisma.productionPart.count({ where: { partNumber } }),
      prisma.bomComponent.count({
        where: { OR: [{ parentPartNumber: partNumber }, { componentPartNumber: partNumber }] },
      }),
      prisma.materialRequest.count({ where: { partNumber } }),
      prisma.bufferItem.count({ where: { partNumber } }),
      prisma.ledgerEntry.count({ where: { partNumber } }),
      prisma.productionRequest.count({ where: { partNumber } }),
      prisma.queueItem.count({ where: { partNumber } }),
      prisma.completedBox.count({ where: { partNumber } }),
      prisma.productionShiftRecord.count({ where: { partNumber } }),
      prisma.ngShiftRecord.count({ where: { partNumber } }),
      prisma.routing.count({ where: { partNumber } }),
      prisma.scheduleItem.count({ where: { partNumber } }),
    ])

    const hasProductionRefs = bom + material + buffer + ledger + requests + queue + boxes + results + ng + routings + schedules > 0
    const partOnly = parts > 0 && !hasProductionRefs

    if (hasProductionRefs) {
      const usage = [
        parts > 0 ? 'Part Number produksi' : null,
        bom > 0 ? `${bom} relasi BOM` : null,
        material > 0 ? `${material} permintaan material` : null,
        buffer > 0 ? `${buffer} buffer item` : null,
        ledger > 0 ? `${ledger} ledger stock` : null,
        requests + queue + boxes + results + ng > 0 ? 'transaksi produksi' : null,
        routings > 0 ? `${routings} routing` : null,
        schedules > 0 ? `${schedules} jadwal` : null,
      ]
        .filter(Boolean)
        .join(', ')
      return res.status(400).json({
        message: `Stock item ${partNumber} masih dipakai oleh ${usage}. Hapus relasi tersebut terlebih dahulu.`,
      })
    }

    if (partOnly) {
      await prisma.$transaction([
        prisma.productionPart.delete({ where: { partNumber } }),
        prisma.stockItem.delete({ where: { partNumber } }),
      ])
    } else {
      await prisma.stockItem.delete({ where: { partNumber } })
    }
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Inventory locations */

router.get('/locations', async (_req, res, next) => {
  try {
    res.json(await prisma.inventoryLocation.findMany({ orderBy: { code: 'asc' } }))
  } catch (error) {
    next(error)
  }
})

const locationSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  type: z.enum(['Buffer', 'Store', 'External', 'Return']),
  line: z.string().min(1),
  capacity: z.number().int().nonnegative().default(0),
  status: z.enum(['active', 'inactive']).optional(),
})

router.post('/locations', writeRoles, async (req, res, next) => {
  try {
    const body = locationSchema.parse(req.body)
    const location = await prisma.inventoryLocation.upsert({
      where: { code: body.code.trim().toUpperCase() },
      update: body,
      create: { ...body, code: body.code.trim().toUpperCase() },
    })
    res.status(201).json(location)
  } catch (error) {
    next(error)
  }
})

router.patch('/locations/:id', writeRoles, async (req, res, next) => {
  try {
    const body = locationSchema.partial().parse(req.body)
    const location = await prisma.inventoryLocation.update({
      where: { id: String(req.params.id) },
      data: body,
    })
    res.json(location)
  } catch (error) {
    next(error)
  }
})

router.delete('/locations/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.inventoryLocation.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Shifts */

router.get('/shifts', async (_req, res, next) => {
  try {
    res.json(await prisma.shiftConfig.findMany({ orderBy: { start: 'asc' } }))
  } catch (error) {
    next(error)
  }
})

const shiftSchema = z.object({
  name: z.string().min(1),
  start: z.string().min(1),
  end: z.string().min(1),
  breakStart: z.string(),
  breakEnd: z.string(),
  workHours: z.number().nonnegative().optional(),
  maxOvertimeMinutes: z.number().int().nonnegative().optional(),
  active: z.boolean().optional(),
})

router.post('/shifts', writeRoles, async (req, res, next) => {
  try {
    const body = shiftSchema.parse(req.body)
    const shift = await prisma.shiftConfig.upsert({
      where: { name: body.name },
      update: body,
      create: {
        ...body,
        workHours: body.workHours ?? 0,
        maxOvertimeMinutes: body.maxOvertimeMinutes ?? 0,
      },
    })
    res.status(201).json(shift)
  } catch (error) {
    next(error)
  }
})

router.patch('/shifts/:id', writeRoles, async (req, res, next) => {
  try {
    const body = shiftSchema.partial().parse(req.body)
    const shift = await prisma.shiftConfig.update({
      where: { id: String(req.params.id) },
      data: body,
    })
    res.json(shift)
  } catch (error) {
    next(error)
  }
})

router.delete('/shifts/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.shiftConfig.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Kanban config */

router.get('/kanban', async (_req, res, next) => {
  try {
    res.json(await prisma.kanbanConfig.findMany({ orderBy: { type: 'asc' } }))
  } catch (error) {
    next(error)
  }
})

const kanbanSchema = z.object({
  type: z.string().min(1),
  prefix: z.string().min(1),
  format: z.string().min(1),
  fields: z.array(z.string()).default([]),
  template: z.string().min(1),
  active: z.boolean().optional(),
})

router.post('/kanban', writeRoles, async (req, res, next) => {
  try {
    const body = kanbanSchema.parse(req.body)
    const config = await prisma.kanbanConfig.upsert({
      where: { type: body.type },
      update: body,
      create: body,
    })
    res.status(201).json(config)
  } catch (error) {
    next(error)
  }
})

router.patch('/kanban/:id', writeRoles, async (req, res, next) => {
  try {
    const body = kanbanSchema.partial().parse(req.body)
    const config = await prisma.kanbanConfig.update({
      where: { id: String(req.params.id) },
      data: body,
    })
    res.json(config)
  } catch (error) {
    next(error)
  }
})

router.delete('/kanban/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.kanbanConfig.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

/* Cycle time */

router.get('/cycle-time', async (_req, res, next) => {
  try {
    const parts = await prisma.productionPart.findMany({ orderBy: { partNumber: 'asc' } })
    res.json(
      parts.map((part) => ({
        partNumber: part.partNumber,
        line: part.line,
        type: part.type,
        process: part.process,
        models: part.models,
        secondsPerPiece: part.cycleTime,
        cycleGroupId: part.cycleGroupId,
      })),
    )
  } catch (error) {
    next(error)
  }
})

const cycleTimeSchema = z.object({
  secondsPerPiece: z.number().positive().nullable().optional(),
  cycleGroupId: z.string().nullable().optional(),
})

router.patch('/cycle-time/:partNumber', writeRoles, async (req, res, next) => {
  try {
    const body = cycleTimeSchema.parse(req.body)
    const part = await prisma.productionPart.update({
      where: { partNumber: String(req.params.partNumber).toUpperCase() },
      data: {
        ...(body.secondsPerPiece !== undefined ? { cycleTime: body.secondsPerPiece } : {}),
        ...(body.cycleGroupId !== undefined ? { cycleGroupId: body.cycleGroupId } : {}),
      },
    })
    res.json({
      partNumber: part.partNumber,
      secondsPerPiece: part.cycleTime,
      cycleGroupId: part.cycleGroupId,
    })
  } catch (error) {
    next(error)
  }
})

/* Work areas */

router.get('/work-areas', async (_req, res, next) => {
  try {
    const items = await prisma.workArea.findMany({
      include: {
        users: { include: { user: { select: { id: true, name: true, employeeId: true, role: true } } } },
      },
      orderBy: { label: 'asc' },
    })
    res.json(items)
  } catch (error) {
    next(error)
  }
})

const workAreaSchema = z.object({
  label: z.string().min(1),
  line: z.string().min(1),
  type: z.enum(['Assy', 'Sub_Assy']),
  process: z.string().min(1),
})

async function findWorkAreaDuplicate(input: {
  id?: string
  label: string
  line: string
  type: string
  process: string
}) {
  return prisma.workArea.findFirst({
    where: {
      ...(input.id ? { id: { not: input.id } } : {}),
      OR: [
        { line: input.line, type: input.type, process: input.process },
        { label: { equals: input.label, mode: 'insensitive' } },
      ],
    },
    select: { label: true, line: true, type: true, process: true },
  })
}

function duplicateWorkAreaMessage(
  duplicate: { label: string; line: string; type: string; process: string },
  input: { label: string; line: string; type: string; process: string },
) {
  if (duplicate.label.toLowerCase() === input.label.toLowerCase()) {
    return 'Label area kerja sudah digunakan.'
  }
  return 'Kombinasi line, tipe, dan proses area kerja sudah ada.'
}

router.post('/work-areas', requireRole('admin'), async (req, res, next) => {
  try {
    const body = workAreaSchema.parse(req.body)
    const input = {
      label: body.label.trim(),
      line: body.line.trim(),
      type: body.type,
      process: body.process.trim(),
    }
    const duplicate = await findWorkAreaDuplicate(input)
    if (duplicate) {
      return res.status(409).json({ message: duplicateWorkAreaMessage(duplicate, input) })
    }

    const area = await prisma.workArea.create({ data: input })
    res.status(201).json(area)
  } catch (error) {
    next(error)
  }
})

router.patch('/work-areas/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const body = workAreaSchema.partial().parse(req.body)
    const existing = await prisma.workArea.findUnique({
      where: { id: String(req.params.id) },
      include: {
        users: {
          include: {
            user: { select: { name: true, employeeId: true, role: true } },
          },
        },
      },
    })
    if (!existing) return res.status(404).json({ message: 'Area kerja tidak ditemukan.' })

    const input = {
      label: body.label?.trim() ?? existing.label,
      line: body.line?.trim() ?? existing.line,
      type: body.type ?? existing.type,
      process: body.process?.trim() ?? existing.process,
    }

    const duplicate = await findWorkAreaDuplicate({ id: existing.id, ...input })
    if (duplicate) {
      return res.status(409).json({ message: duplicateWorkAreaMessage(duplicate, input) })
    }

    if (body.type && body.type !== existing.type) {
      const incompatible = existing.users.find((assignment) =>
        workAreaMismatchForRole(assignment.user.role, [{ type: input.type }]),
      )
      if (incompatible) {
        return res.status(400).json({
          message: `Tipe area tidak dapat diubah karena masih ditugaskan ke ${incompatible.user.name} (${incompatible.user.employeeId}). Lepaskan penugasan tersebut terlebih dahulu.`,
        })
      }
    }

    const area = await prisma.workArea.update({
      where: { id: existing.id },
      data: input,
    })
    res.json(area)
  } catch (error) {
    next(error)
  }
})

router.delete('/work-areas/:id', requireRole('admin'), async (req, res, next) => {
  try {
    const area = await prisma.workArea.findUnique({
      where: { id: String(req.params.id) },
      include: {
        users: {
          include: {
            user: { select: { name: true, employeeId: true } },
          },
        },
      },
    })
    if (!area) return res.status(404).json({ message: 'Area kerja tidak ditemukan.' })
    if (area.users.length > 0) {
      const names = area.users
        .slice(0, 3)
        .map((assignment) => assignment.user.name)
        .join(', ')
      const suffix = area.users.length > 3 ? ` dan ${area.users.length - 3} user lain` : ''
      return res.status(400).json({
        message: `Area kerja masih ditugaskan ke ${names}${suffix}. Lepaskan penugasan sebelum menghapus.`,
      })
    }

    await prisma.workArea.delete({ where: { id: area.id } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
