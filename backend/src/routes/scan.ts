import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate } from '../middleware/auth.js'
import {
  createProductionScanRequest,
  createSupplierQueueRequest,
  getKanbanPartType,
  splitScanCode,
} from '../lib/scan.js'

const router = Router()

const scanSchema = z.object({
  code: z.string().min(1),
  pairingCode: z.string().min(1).optional(),
})

// Daftar scanner hanya untuk UI input manual yang sudah login, bukan untuk scanner.
router.get('/devices', authenticate, async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      where: { type: 'Scanner', status: 'online', pairingCode: { not: null } },
      select: { name: true, location: true, pairingCode: true },
      orderBy: { name: 'asc' },
    })
    res.json(devices)
  } catch (error) {
    next(error)
  }
})

router.get('/pending', async (_req, res, next) => {
  try {
    const [assy, subAssy, supplier] = await Promise.all([
      prisma.productionRequest.count({ where: { type: 'Assy', status: 'pending' } }),
      prisma.productionRequest.count({ where: { type: 'Sub_Assy', status: 'pending' } }),
      prisma.materialRequest.count({
        where: { kind: 'receiving', destination: 'Supplier', status: 'waiting' },
      }),
    ])
    res.json({ assy, subAssy, supplier })
  } catch (error) {
    next(error)
  }
})

router.post('/', async (req, res, next) => {
  try {
    const body = scanSchema.parse(req.body)
    const scanned = splitScanCode(body.code)
    const pairingCode = scanned.deviceCode ?? body.pairingCode
    if (!pairingCode) {
      return res.status(403).json({
        message: 'Scan ditolak: kode pairing scanner wajib ada pada prefix barcode atau pilih scanner.',
      })
    }

    // Pairing code adalah kredensial scanner: jangan cocokkan id/nama dan jangan aktifkan device otomatis.
    const device = await prisma.device.findFirst({
      where: { type: 'Scanner', pairingCode, status: 'online' },
    })
    if (!device) {
      return res.status(403).json({
        message: `Scanner ${pairingCode} belum terdaftar atau tidak online di Device Management.`,
      })
    }
    await prisma.device.update({
      where: { id: device.id },
      data: { lastSeen: new Date() },
    })

    const actor = { name: device.name }
    const partType = getKanbanPartType(scanned.code)
    if (partType) {
      const result = await createProductionScanRequest(scanned.code, actor)
      if (!result.ok) return res.status(result.status).json({ message: result.message })
      return res.status(201).json({
        destination: partType === 'Assy' ? 'assy' : 'sub-assy',
        device: device.name,
        request: result.value,
      })
    }

    const result = await createSupplierQueueRequest(scanned.code, actor)
    if (!result.ok) return res.status(result.status).json({ message: result.message })
    res.status(201).json({ destination: 'supplier', device: device.name, request: result.value })
  } catch (error) {
    next(error)
  }
})

export default router
