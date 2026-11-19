import { Router } from 'express'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat, unlink } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole } from '../middleware/auth.js'
import { env } from '../config/env.js'

const router = Router()
const execFileAsync = promisify(execFile)

const here = dirname(fileURLToPath(import.meta.url))
const backupDir = resolve(here, '../../backups')

router.use(authenticate)

router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.appSetting.findMany({ orderBy: { key: 'asc' } })
    res.json(Object.fromEntries(rows.map((row) => [row.key, row.value])))
  } catch (error) {
    next(error)
  }
})

router.get('/backups', requireRole('admin', 'leader'), async (_req, res, next) => {
  try {
    if (!existsSync(backupDir)) return res.json([])
    const files = await readdir(backupDir)
    const backups = await Promise.all(
      files
        .filter((file) => file.endsWith('.sql'))
        .map(async (file) => {
          const fileStat = await stat(join(backupDir, file))
          return {
            file,
            size: fileStat.size,
            createdAt: fileStat.mtime.toISOString(),
          }
        }),
    )
    res.json(backups.sort((a, b) => b.createdAt.localeCompare(a.createdAt)))
  } catch (error) {
    next(error)
  }
})

router.post('/backup', requireRole('admin'), async (_req, res, next) => {
  try {
    await mkdir(backupDir, { recursive: true })
    const stamp = new Date().toISOString().replace(/[:.]/g, '-')
    const file = join(backupDir, `wpc-${stamp}.sql`)
    const candidates = [
      process.env.PG_DUMP_PATH,
      '/usr/lib/postgresql/16/bin/pg_dump',
      'pg_dump',
    ].filter((value): value is string => Boolean(value))
    const pgDump = candidates.find((candidate) => candidate === 'pg_dump' || existsSync(candidate))

    if (!pgDump) {
      return res.status(500).json({ message: 'pg_dump tidak ditemukan. Set PG_DUMP_PATH.' })
    }

    await execFileAsync(pgDump, [env.databaseUrl, '--no-owner', '--file', file])
    const fileStat = await stat(file)
    const backup = {
      file,
      size: fileStat.size,
      createdAt: fileStat.mtime.toISOString(),
    }

    const setting = await prisma.appSetting.findUnique({ where: { key: 'backup' } })
    await prisma.appSetting.upsert({
      where: { key: 'backup' },
      update: {
        value: {
          ...(setting && typeof setting.value === 'object' && setting.value !== null
            ? (setting.value as Record<string, unknown>)
            : {}),
          lastBackupAt: backup.createdAt,
        },
      },
      create: {
        key: 'backup',
        value: { automatic: false, schedule: '02:00', retentionDays: 30, lastBackupAt: backup.createdAt },
      },
    })

    await prisma.auditLog.create({
      data: {
        title: 'Backup database dibuat',
        detail: `${backup.file} · ${Math.round(backup.size / 1024)} KB`,
        type: 'system',
      },
    })

    res.status(201).json(backup)
  } catch (error) {
    next(error)
  }
})

const settingsSchema = z.object({
  value: z.unknown(),
})

const productionCapacitySchema = z.object({
  value: z.object({
    pcsPerHour: z.number().int().positive(),
  }),
})

router.get('/production-capacity', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: 'production-capacity' },
    })
    if (!setting) return res.json({ pcsPerHour: 40 })
    const parsed = z.object({ pcsPerHour: z.number().int().positive() }).safeParse(setting.value)
    if (!parsed.success) {
      return res.status(500).json({ message: 'Pengaturan kemampuan produksi per jam tidak valid.' })
    }
    res.json(parsed.data)
  } catch (error) {
    next(error)
  }
})

router.put('/production-capacity', requireRole('admin'), async (req, res, next) => {
  try {
    const body = productionCapacitySchema.parse(req.body)
    const setting = await prisma.appSetting.upsert({
      where: { key: 'production-capacity' },
      update: { value: body.value },
      create: { key: 'production-capacity', value: body.value },
    })
    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

const notificationSettingsSchema = z.object({
  assy: z.object({ low: z.boolean(), high: z.boolean() }),
  subAssy: z.object({ low: z.boolean(), high: z.boolean() }),
  criticalSafety: z.boolean(),
})

type NotificationSettings = z.infer<typeof notificationSettingsSchema>

const defaultNotificationSettings: NotificationSettings = {
  assy: { low: true, high: true },
  subAssy: { low: true, high: true },
  criticalSafety: true,
}

function readNotificationSettings(value: unknown): NotificationSettings {
  const parsed = notificationSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultNotificationSettings
}

router.get('/notifications', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'notifications' } })
    res.json(readNotificationSettings(setting?.value))
  } catch (error) {
    next(error)
  }
})

router.put('/notifications', requireRole('admin', 'leader'), async (req, res, next) => {
  try {
    const body = z.object({ value: notificationSettingsSchema }).parse(req.body)
    const setting = await prisma.appSetting.upsert({
      where: { key: 'notifications' },
      update: { value: body.value },
      create: { key: 'notifications', value: body.value },
    })
    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

const CRITICAL_SAFETY_MINUTES = 60

interface StockNotification {
  id: string
  title: string
  body: string
  time: string
  tone: 'danger' | 'warning' | 'info'
  kind: 'low' | 'high' | 'critical'
  partNumber: string
  category: 'Assy' | 'Sub Assy'
}

router.get('/notifications/alerts', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'notifications' } })
    const config = readNotificationSettings(setting?.value)
    const since = new Date(Date.now() - CRITICAL_SAFETY_MINUTES * 60_000)

    const [items, usageRows] = await Promise.all([
      prisma.stockItem.findMany({
        where: { category: { in: ['Assy', 'Sub Assy'] } },
        orderBy: { partNumber: 'asc' },
      }),
      prisma.ledgerEntry.groupBy({
        by: ['partNumber'],
        where: {
          time: { gte: since },
          type: { in: ['Supply Issue', 'Collect Pickup'] },
        },
        _sum: { qty: true },
      }),
    ])

    const usageByPart = new Map(
      usageRows.map((row) => [row.partNumber, Math.abs(row._sum.qty ?? 0)]),
    )
    const alerts: StockNotification[] = []

    for (const item of items) {
      const category: 'Assy' | 'Sub Assy' = item.category === 'Assy' ? 'Assy' : 'Sub Assy'
      const rules = category === 'Assy' ? config.assy : config.subAssy
      const time = item.updatedAt.toISOString()

      if (rules.low && (item.status === 'low' || item.status === 'empty')) {
        alerts.push({
          id: `low-${category}-${item.partNumber}`,
          title: `Stok ${category} rendah`,
          body: `${item.partNumber} · ${item.store} pcs (safety ${item.safetyStock})`,
          time,
          tone: item.status === 'empty' ? 'danger' : 'warning',
          kind: 'low',
          partNumber: item.partNumber,
          category,
        })
      }

      if (rules.high && item.maxStore > 0 && item.store >= item.maxStore) {
        alerts.push({
          id: `high-${category}-${item.partNumber}`,
          title: `Stok ${category} penuh`,
          body: `${item.partNumber} · ${item.store} pcs (max ${item.maxStore})`,
          time,
          tone: 'info',
          kind: 'high',
          partNumber: item.partNumber,
          category,
        })
      }

      const hourlyUsage = usageByPart.get(item.partNumber) ?? 0
      if (config.criticalSafety && item.store > 0 && hourlyUsage > 0) {
        const minutesLeft = Math.floor((item.store / hourlyUsage) * 60)
        if (minutesLeft < CRITICAL_SAFETY_MINUTES) {
          alerts.push({
            id: `critical-${category}-${item.partNumber}`,
            title: `Safety stock ${category} < 1 jam`,
            body: `${item.partNumber} · sisa ${minutesLeft} menit produksi (${item.store} pcs)`,
            time,
            tone: 'danger',
            kind: 'critical',
            partNumber: item.partNumber,
            category,
          })
        }
      }
    }

    const order = { critical: 0, low: 1, high: 2 }
    alerts.sort((a, b) => order[a.kind] - order[b.kind] || a.partNumber.localeCompare(b.partNumber))

    res.json({
      alerts,
      summary: {
        total: alerts.length,
        low: alerts.filter((alert) => alert.kind === 'low').length,
        high: alerts.filter((alert) => alert.kind === 'high').length,
        critical: alerts.filter((alert) => alert.kind === 'critical').length,
      },
    })
  } catch (error) {
    next(error)
  }
})

const printingSettingsSchema = z.object({
  autoPrint: z.boolean(),
  labelSize: z.enum(['100x150', '80x100', '60x80']),
  copies: z.number().int().min(1).max(10),
  symbology: z.enum(['code128', 'qr', 'both']),
  dpi: z.enum(['203', '300']),
})

const defaultPrintingSettings = {
  autoPrint: true,
  labelSize: '100x150' as const,
  copies: 1,
  symbology: 'code128' as const,
  dpi: '203' as const,
}

function readPrintingSettings(value: unknown) {
  const parsed = printingSettingsSchema.safeParse(value)
  return parsed.success ? parsed.data : defaultPrintingSettings
}

router.get('/printing', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'printing' } })
    res.json(readPrintingSettings(setting?.value))
  } catch (error) {
    next(error)
  }
})

router.put('/printing', requireRole('admin', 'leader'), async (req, res, next) => {
  try {
    const body = z.object({ value: printingSettingsSchema }).parse(req.body)
    const setting = await prisma.appSetting.upsert({
      where: { key: 'printing' },
      update: { value: body.value },
      create: { key: 'printing', value: body.value },
    })
    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

const backupSettingsSchema = z.object({
  automatic: z.boolean(),
  schedule: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  retentionDays: z.number().int().min(1).max(365),
})

const defaultBackupSettings = {
  automatic: true,
  schedule: '02:00',
  retentionDays: 30,
}

function readBackupSettings(value: unknown) {
  if (!value || typeof value !== 'object') return defaultBackupSettings
  const parsed = backupSettingsSchema.safeParse(value)
  if (!parsed.success) return defaultBackupSettings
  const lastBackupAt =
    'lastBackupAt' in value && typeof value.lastBackupAt === 'string' ? value.lastBackupAt : null
  return { ...parsed.data, lastBackupAt }
}

router.get('/backup', async (_req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'backup' } })
    res.json(readBackupSettings(setting?.value))
  } catch (error) {
    next(error)
  }
})

router.put('/backup', requireRole('admin'), async (req, res, next) => {
  try {
    const body = z.object({ value: backupSettingsSchema }).parse(req.body)
    const setting = await prisma.appSetting.findUnique({ where: { key: 'backup' } })
    const value = {
      ...(setting && typeof setting.value === 'object' && setting.value !== null
        ? (setting.value as Record<string, unknown>)
        : {}),
      ...body.value,
    }
    const saved = await prisma.appSetting.upsert({
      where: { key: 'backup' },
      update: { value },
      create: { key: 'backup', value },
    })
    res.json(readBackupSettings(saved.value))
  } catch (error) {
    next(error)
  }
})

const backupFilePattern = /^wpc-[0-9A-Za-z-]+\.sql$/

router.get('/backups/:file/download', requireRole('admin', 'leader'), (req, res, next) => {
  try {
    const file = String(req.params.file)
    if (!backupFilePattern.test(file)) {
      return res.status(400).json({ message: 'Nama file backup tidak valid.' })
    }
    const filePath = join(backupDir, file)
    if (!existsSync(filePath)) {
      return res.status(404).json({ message: 'File backup tidak ditemukan.' })
    }
    res.download(filePath, file)
  } catch (error) {
    next(error)
  }
})

router.post('/backups/cleanup', requireRole('admin'), async (_req, res, next) => {
  try {
    if (!existsSync(backupDir)) return res.json({ deleted: 0, freedBytes: 0 })
    const setting = await prisma.appSetting.findUnique({ where: { key: 'backup' } })
    const config = readBackupSettings(setting?.value)
    const cutoff = Date.now() - config.retentionDays * 86_400_000
    const files = (await readdir(backupDir)).filter((file) => file.endsWith('.sql'))
    let deleted = 0
    let freedBytes = 0
    for (const file of files) {
      const filePath = join(backupDir, file)
      const fileStat = await stat(filePath)
      if (fileStat.mtime.getTime() >= cutoff) continue
      await unlink(filePath)
      deleted += 1
      freedBytes += fileStat.size
    }
    if (deleted > 0) {
      await prisma.auditLog.create({
        data: {
          title: 'Bersihkan backup lama',
          detail: `${deleted} file · ${Math.round(freedBytes / 1024)} KB · retensi ${config.retentionDays} hari`,
          type: 'system',
        },
      })
    }
    res.json({ deleted, freedBytes })
  } catch (error) {
    next(error)
  }
})

router.get('/:key', async (req, res, next) => {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: String(req.params.key) },
    })
    if (!setting) return res.status(404).json({ message: 'Setting not found.' })
    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

router.put('/:key', requireRole('admin'), async (req, res, next) => {
  try {
    const body = settingsSchema.parse(req.body)
    const setting = await prisma.appSetting.upsert({
      where: { key: String(req.params.key) },
      update: { value: body.value as object },
      create: { key: String(req.params.key), value: body.value as object },
    })
    res.json(setting.value)
  } catch (error) {
    next(error)
  }
})

export default router
