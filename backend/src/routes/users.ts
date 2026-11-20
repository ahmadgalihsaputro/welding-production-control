import { randomUUID } from 'node:crypto'
import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import type { Prisma } from '@prisma/client'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js'
import {
  isOperatorRole,
  nonOperatorAreaMessage,
  workAreaMismatchForRole,
} from '../lib/workAreas.js'
import { currentUserShift } from '../lib/userShift.js'

const router = Router()

router.use(authenticate)

const roleEnum = z.enum([
  'operator_assy',
  'operator_sub_assy',
  'operator_both',
  'leader',
  'admin',
  'management',
])

type Role = z.infer<typeof roleEnum>

const roleLabels: Record<Role, string> = {
  operator_assy: 'Operator Assy',
  operator_sub_assy: 'Operator Sub Assy',
  operator_both: 'Operator Assy + Sub Assy',
  leader: 'Leader Produksi',
  admin: 'Administrator',
  management: 'Management',
}

const userInclude = {
  workAreas: { include: { workArea: true } },
  partSkills: { include: { part: true } },
} as const

const userSelect = {
  id: true,
  employeeId: true,
  username: true,
  name: true,
  email: true,
  role: true,
  roleLabel: true,
  area: true,
  line: true,
  status: true,
  initials: true,
  shiftMode: true,
  shiftBase: true,
  shiftAnchorDate: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  workAreas: { include: { workArea: true } },
  partSkills: {
    include: {
      part: {
        select: {
          partNumber: true,
          line: true,
          type: true,
          process: true,
          models: true,
        },
      },
    },
  },
} as const

function initialsOf(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('')
}

async function resolveWorkAreaIds(role: Role, requestedIds: string[]) {
  const workAreaIds = Array.from(new Set(requestedIds))
  if (!isOperatorRole(role)) {
    if (workAreaIds.length > 0) {
      return { ids: [] as string[], error: nonOperatorAreaMessage(role) }
    }
    return { ids: [] as string[], error: null }
  }
  if (workAreaIds.length === 0) {
    return { ids: [] as string[], error: 'Pilih minimal satu area kerja untuk akun operator.' }
  }

  const areas = await prisma.workArea.findMany({ where: { id: { in: workAreaIds } } })
  if (areas.length !== workAreaIds.length) {
    return { ids: [] as string[], error: 'Ada area kerja yang tidak ditemukan.' }
  }

  const mismatch = workAreaMismatchForRole(role, areas)
  if (mismatch) return { ids: [] as string[], error: mismatch }
  return { ids: workAreaIds, error: null }
}

async function resolvePartNumbers(role: Role, requestedPartNumbers: string[]) {
  const partNumbers = Array.from(
    new Set(requestedPartNumbers.map((partNumber) => partNumber.trim().toUpperCase()).filter(Boolean)),
  )
  if (!isOperatorRole(role)) {
    if (partNumbers.length > 0) {
      return { partNumbers: [] as string[], error: nonOperatorAreaMessage(role) }
    }
    return { partNumbers: [] as string[], error: null }
  }
  if (partNumbers.length === 0) {
    return { partNumbers: [] as string[], error: 'Pilih minimal satu PN yang dapat dikerjakan user.' }
  }

  const parts = await prisma.productionPart.findMany({
    where: {
      partNumber: { in: partNumbers },
      type: { in: ['Assy', 'Sub_Assy'] },
    },
    select: { partNumber: true },
  })
  if (parts.length !== partNumbers.length) {
    const known = new Set(parts.map((part) => part.partNumber))
    const missing = partNumbers.filter((partNumber) => !known.has(partNumber))
    return {
      partNumbers: [] as string[],
      error: `PN tidak terdaftar atau bukan part Assy/Sub Assy: ${missing.join(', ')}.`,
    }
  }
  return { partNumbers, error: null }
}

async function syncPartSkills(
  tx: Prisma.TransactionClient,
  userId: string,
  partNumbers: string[],
) {
  const parts = await tx.productionPart.findMany({
    where: { partNumber: { in: partNumbers } },
    select: { partNumber: true, line: true, type: true, process: true },
  })
  const uniqueAreas = new Map(
    parts.map((part) => [
      `${part.line}:${part.type}:${part.process}`,
      { line: part.line, type: part.type, process: part.process },
    ]),
  )
  const areas = await Promise.all(
    Array.from(uniqueAreas.values()).map((area) =>
      tx.workArea.upsert({
        where: {
          line_type_process: {
            line: area.line,
            type: area.type,
            process: area.process,
          },
        },
        update: {},
        create: {
          label: `${area.line} · ${area.process}`,
          ...area,
        },
      }),
    ),
  )
  await tx.userPartSkill.deleteMany({ where: { userId } })
  if (partNumbers.length > 0) {
    await tx.userPartSkill.createMany({
      data: partNumbers.map((partNumber) => ({ userId, partNumber })),
    })
  }
  await tx.userWorkArea.deleteMany({ where: { userId } })
  if (areas.length > 0) {
    await tx.userWorkArea.createMany({
      data: areas.map((area) => ({ userId, workAreaId: area.id })),
    })
  }
}

router.get('/roles', requireRole('admin', 'leader', 'management'), async (_req, res) => {
  res.json(
    (Object.keys(roleLabels) as Role[]).map((role) => ({
      role,
      label: roleLabels[role],
    })),
  )
})

router.get('/', requireRole('admin', 'leader', 'management'), async (req, res, next) => {
  try {
    const role = typeof req.query.role === 'string' ? req.query.role : undefined
    const status = typeof req.query.status === 'string' ? req.query.status : undefined
    const users = await prisma.user.findMany({
      where: {
        ...(role ? { role: role as Role } : {}),
        ...(status ? { status } : {}),
      },
      select: userSelect,
      orderBy: { employeeId: 'asc' },
    })
    res.json(users.map((user) => ({ ...user, currentShift: currentUserShift(user) })))
  } catch (error) {
    next(error)
  }
})

const createUserSchema = z.object({
  employeeId: z.string().min(1),
  username: z.string().min(3),
  name: z.string().min(1),
  email: z.string().email().optional(),
  password: z.string().min(8),
  role: roleEnum,
  area: z.string().min(1),
  line: z.string().min(1),
  initials: z.string().min(1).max(4).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  workAreaIds: z.array(z.string()).optional(),
  partNumbers: z.array(z.string()).optional(),
  shiftMode: z.enum(['rotating', 'non_shift']).default('non_shift'),
  shiftBase: z.union([z.literal(1), z.literal(2)]).default(1),
  shiftAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine((body) => body.shiftMode !== 'rotating' || Boolean(body.shiftAnchorDate), {
  message: 'Tanggal awal rotasi shift wajib diisi.',
  path: ['shiftAnchorDate'],
})

router.post('/', requireRole('admin'), async (req, res, next) => {
  try {
    const body = createUserSchema.parse(req.body)
    const employeeId = body.employeeId.trim().toUpperCase()
    const username = body.username.trim().toLowerCase()
    const duplicate = await prisma.user.findFirst({
      where: {
        OR: [
          { employeeId },
          { username: { equals: username, mode: 'insensitive' } },
        ],
      },
      select: { employeeId: true, username: true },
    })
    if (duplicate) {
      return res.status(409).json({
        message:
          duplicate.employeeId === employeeId
            ? 'Employee ID sudah terdaftar.'
            : 'Username sudah terdaftar.',
      })
    }

    const partSkillResult = body.partNumbers === undefined
      ? null
      : await resolvePartNumbers(body.role, body.partNumbers)
    if (partSkillResult?.error) {
      return res.status(400).json({ message: partSkillResult.error })
    }
    const workAreas = partSkillResult
      ? { ids: [] as string[], error: null }
      : await resolveWorkAreaIds(body.role, body.workAreaIds ?? [])
    if (workAreas.error) return res.status(400).json({ message: workAreas.error })

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          employeeId,
          username,
          name: body.name.trim(),
          email: body.email,
          password: await bcrypt.hash(body.password, 10),
          role: body.role,
          roleLabel: roleLabels[body.role],
          area: body.area.trim(),
          line: body.line.trim(),
          initials: body.initials ?? initialsOf(body.name),
          status: body.status ?? 'active',
          shiftMode: body.shiftMode,
          shiftBase: body.shiftBase,
          shiftAnchorDate: body.shiftAnchorDate
            ? new Date(`${body.shiftAnchorDate}T00:00:00.000Z`)
            : null,
        },
      })

      if (partSkillResult) {
        await syncPartSkills(tx, created.id, partSkillResult.partNumbers)
      } else if (workAreas.ids.length > 0) {
        await tx.userWorkArea.createMany({
          data: workAreas.ids.map((workAreaId) => ({ userId: created.id, workAreaId })),
        })
      }

      await tx.auditLog.create({
        data: {
          title: `User ${created.employeeId} dibuat`,
          detail: `${created.name} · ${created.roleLabel}`,
          type: 'system',
        },
      })

      return tx.user.findUniqueOrThrow({
        where: { id: created.id },
        select: userSelect,
      })
    })

    res.status(201).json({ ...user, currentShift: currentUserShift(user) })
  } catch (error) {
    next(error)
  }
})

/* Devices */

router.get('/devices', requireRole('admin', 'leader', 'management'), async (_req, res, next) => {
  try {
    const devices = await prisma.device.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { kanbanConfigs: true } } },
    })
    res.json(
      devices.map(({ _count, ...device }) => ({
        ...device,
        kanbanConfigCount: _count.kanbanConfigs,
      })),
    )
  } catch (error) {
    next(error)
  }
})

const deviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Tablet', 'PC', 'Scanner', 'Printer']),
  model: z.string().nullable().optional(),
  location: z.string().min(1),
  assignedTo: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).optional(),
  connectionType: z.enum(['wireless', 'bluetooth', 'wired']).nullable().optional(),
  pairingCode: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
})

async function saveDevice(id: string | null, body: z.infer<typeof deviceSchema>) {
  return prisma.$transaction(async (tx) => {
    const type = body.type ?? (id
      ? (await tx.device.findUniqueOrThrow({ where: { id } })).type
      : undefined)
    if (body.isDefault && type === 'Printer') {
      await tx.device.updateMany({
        where: { type: 'Printer', isDefault: true, ...(id ? { NOT: { id } } : {}) },
        data: { isDefault: false },
      })
    }
    const pairingCode = body.pairingCode ?? (id ? undefined : type === 'Scanner' ? `SCN-${randomUUID().slice(0, 8).toUpperCase()}` : null)
    const data = {
      ...body,
      ...(pairingCode !== undefined ? { pairingCode } : {}),
      ...(body.status ? { lastSeen: body.status === 'online' ? new Date() : undefined } : {}),
    }
    return id
      ? tx.device.update({ where: { id }, data })
      : tx.device.create({
          data: {
            ...data,
            name: body.name,
            type: body.type,
            location: body.location,
            status: body.status ?? 'offline',
          },
        })
  })
}

router.post('/devices', requireRole('admin'), async (req, res, next) => {
  try {
    const body = deviceSchema.parse(req.body)
    res.status(201).json(await saveDevice(null, body))
  } catch (error) {
    next(error)
  }
})

router.patch('/devices/:id', requireRole('admin', 'leader'), async (req, res, next) => {
  try {
    const body = deviceSchema.partial().parse(req.body)
    res.json(await saveDevice(String(req.params.id), body as z.infer<typeof deviceSchema>))
  } catch (error) {
    next(error)
  }
})

router.delete('/devices/:id', requireRole('admin'), async (req, res, next) => {
  try {
    await prisma.device.delete({ where: { id: String(req.params.id) } })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  role: roleEnum.optional(),
  area: z.string().min(1).optional(),
  line: z.string().min(1).optional(),
  initials: z.string().min(1).max(4).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  password: z.string().min(8).optional(),
  workAreaIds: z.array(z.string()).optional(),
  partNumbers: z.array(z.string()).optional(),
  shiftMode: z.enum(['rotating', 'non_shift']).optional(),
  shiftBase: z.union([z.literal(1), z.literal(2)]).optional(),
  shiftAnchorDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

router.get('/:id', requireRole('admin', 'leader', 'management'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: userSelect,
    })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json({ ...user, currentShift: currentUserShift(user) })
  } catch (error) {
    next(error)
  }
})

router.patch('/:id', requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = updateUserSchema.parse(req.body)
    const existing = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      include: userInclude,
    })
    if (!existing) return res.status(404).json({ message: 'User not found.' })

    if (body.status === 'inactive' && req.user!.id === existing.id) {
      return res.status(400).json({ message: 'Tidak dapat menonaktifkan akun sendiri.' })
    }

    const nextRole = body.role ?? (existing.role as Role)
    let nextWorkAreaIds: string[] | null = null
    let nextPartNumbers: string[] | null = null

    if (body.partNumbers !== undefined) {
      const resolved = await resolvePartNumbers(nextRole, body.partNumbers)
      if (resolved.error) return res.status(400).json({ message: resolved.error })
      nextPartNumbers = resolved.partNumbers
    } else if (body.workAreaIds !== undefined) {
      const resolved = await resolveWorkAreaIds(nextRole, body.workAreaIds)
      if (resolved.error) return res.status(400).json({ message: resolved.error })
      nextWorkAreaIds = resolved.ids
    } else if (body.role && body.role !== existing.role) {
      if (isOperatorRole(body.role)) {
        const resolved = await resolvePartNumbers(
          body.role,
          existing.partSkills.map((skill) => skill.partNumber),
        )
        if (resolved.error) return res.status(400).json({ message: resolved.error })
        nextPartNumbers = resolved.partNumbers
      } else {
        nextPartNumbers = []
      }
    }

    const data: Record<string, unknown> = { ...body }
    delete data.workAreaIds
    delete data.partNumbers
    const shiftMode = body.shiftMode ?? existing.shiftMode
    const shiftAnchorDate = body.shiftAnchorDate === undefined
      ? existing.shiftAnchorDate
      : body.shiftAnchorDate
        ? new Date(`${body.shiftAnchorDate}T00:00:00.000Z`)
        : null
    if (shiftMode === 'rotating' && !shiftAnchorDate) {
      return res.status(400).json({ message: 'Tanggal awal rotasi shift wajib diisi.' })
    }
    data.shiftAnchorDate = shiftAnchorDate
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    if (body.role) data.roleLabel = roleLabels[body.role]

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: data as never,
      })

      if (nextPartNumbers !== null) {
        await syncPartSkills(tx, existing.id, nextPartNumbers)
      } else if (nextWorkAreaIds !== null) {
        await tx.userWorkArea.deleteMany({ where: { userId: existing.id } })
        if (nextWorkAreaIds.length > 0) {
          await tx.userWorkArea.createMany({
            data: nextWorkAreaIds.map((workAreaId) => ({
              userId: existing.id,
              workAreaId,
            })),
          })
        }
      }

      await tx.auditLog.create({
        data: {
          title: `User ${existing.employeeId} diperbarui`,
          detail: `${body.name ?? existing.name} · ${body.role ? roleLabels[body.role] : existing.roleLabel}`,
          type: 'system',
        },
      })

      return tx.user.findUniqueOrThrow({
        where: { id: existing.id },
        select: userSelect,
      })
    })

    res.json({ ...user, currentShift: currentUserShift(user) })
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (req.user!.id === String(req.params.id)) {
      return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri.' })
    }
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: String(req.params.id) } })
      if (!user) return { status: 404, message: 'User not found.' }

      if (user.role === 'admin') {
        const administratorCount = await tx.user.count({ where: { role: 'admin' } })
        if (administratorCount <= 1) {
          return {
            status: 409,
            message: 'Akun administrator terakhir tidak dapat dihapus. Tambahkan administrator lain terlebih dahulu.',
          }
        }
      }

      const [queue, boxes, results] = await Promise.all([
        tx.queueItem.count({ where: { operatorId: user.id } }),
        tx.completedBox.count({ where: { operatorUserId: user.id } }),
        tx.productionShiftRecord.count({ where: { operatorUserId: user.id } }),
      ])
      if (queue + boxes + results > 0) {
        return {
          status: 400,
          message: 'User masih memiliki transaksi produksi. Nonaktifkan akun ini agar histori tetap utuh.',
        }
      }

      await tx.user.delete({ where: { id: user.id } })
      await tx.auditLog.create({
        data: {
          title: `User ${user.employeeId} dihapus`,
          detail: user.name,
          type: 'system',
        },
      })
      return { status: 200, message: '' }
    }, { isolationLevel: 'Serializable' })

    if (result.status !== 200) {
      return res.status(result.status).json({ message: result.message })
    }
    res.json({ ok: true })
  } catch (error) {
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'P2034'
    ) {
      return res.status(409).json({
        message: 'Data user berubah bersamaan. Muat ulang daftar sebelum mencoba lagi.',
      })
    }
    next(error)
  }
})

router.put('/:id/work-areas', requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = z.object({ workAreaIds: z.array(z.string()) }).parse(req.body)
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      include: userInclude,
    })
    if (!user) return res.status(404).json({ message: 'User not found.' })

    const resolved = await resolveWorkAreaIds(user.role as Role, body.workAreaIds)
    if (resolved.error) return res.status(400).json({ message: resolved.error })

    await prisma.$transaction([
      prisma.userWorkArea.deleteMany({ where: { userId: user.id } }),
      prisma.userWorkArea.createMany({
        data: resolved.ids.map((workAreaId) => ({
          userId: user.id,
          workAreaId,
        })),
      }),
    ])

    const updated = await prisma.user.findUnique({
      where: { id: user.id },
      select: userSelect,
    })
    res.json(updated)
  } catch (error) {
    next(error)
  }
})

export default router
