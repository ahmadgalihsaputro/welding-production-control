import { Router } from 'express'
import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, readdir, stat } from 'node:fs/promises'
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
