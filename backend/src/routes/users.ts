import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma.js'
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js'
import {
  isOperatorRole,
  nonOperatorAreaMessage,
  workAreaMismatchForRole,
} from '../lib/workAreas.js'

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

const userInclude = { workAreas: { include: { workArea: true } } } as const

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
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  workAreas: { include: { workArea: true } },
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

router.get('/roles', async (_req, res) => {
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
    res.json(users)
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

    const workAreas = await resolveWorkAreaIds(body.role, body.workAreaIds ?? [])
    if (workAreas.error) {
      return res.status(400).json({ message: workAreas.error })
    }

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
        },
      })

      if (workAreas.ids.length > 0) {
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

    res.status(201).json(user)
  } catch (error) {
    next(error)
  }
})

/* Devices */

router.get('/devices', requireRole('admin', 'leader', 'management'), async (_req, res, next) => {
  try {
    res.json(await prisma.device.findMany({ orderBy: { name: 'asc' } }))
  } catch (error) {
    next(error)
  }
})

const deviceSchema = z.object({
  name: z.string().min(1),
  type: z.enum(['Tablet', 'PC', 'Scanner', 'Printer']),
  location: z.string().min(1),
  assignedTo: z.string().nullable().optional(),
  status: z.enum(['online', 'offline', 'maintenance']).optional(),
})

router.post('/devices', requireRole('admin'), async (req, res, next) => {
  try {
    const body = deviceSchema.parse(req.body)
    const device = await prisma.device.create({
      data: {
        ...body,
        status: body.status ?? 'offline',
        lastSeen: body.status === 'online' ? new Date() : null,
      },
    })
    res.status(201).json(device)
  } catch (error) {
    next(error)
  }
})

router.patch('/devices/:id', requireRole('admin', 'leader'), async (req, res, next) => {
  try {
    const body = deviceSchema.partial().parse(req.body)
    const device = await prisma.device.update({
      where: { id: String(req.params.id) },
      data: {
        ...body,
        ...(body.status ? { lastSeen: body.status === 'online' ? new Date() : undefined } : {}),
      },
    })
    res.json(device)
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
})

router.get('/:id', async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: String(req.params.id) },
      select: userSelect,
    })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json(user)
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

    if (body.workAreaIds !== undefined) {
      const resolved = await resolveWorkAreaIds(nextRole, body.workAreaIds)
      if (resolved.error) return res.status(400).json({ message: resolved.error })
      nextWorkAreaIds = resolved.ids
    } else if (body.role && body.role !== existing.role) {
      if (isOperatorRole(body.role)) {
        const resolved = await resolveWorkAreaIds(
          body.role,
          existing.workAreas.map((assignment) => assignment.workAreaId),
        )
        if (resolved.error) return res.status(400).json({ message: resolved.error })
        nextWorkAreaIds = resolved.ids
      } else {
        nextWorkAreaIds = []
      }
    }

    const data: Record<string, unknown> = { ...body }
    delete data.workAreaIds
    if (body.password) data.password = await bcrypt.hash(body.password, 10)
    if (body.role) data.roleLabel = roleLabels[body.role]

    const user = await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: existing.id },
        data: data as never,
      })

      if (nextWorkAreaIds !== null) {
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

    res.json(user)
  } catch (error) {
    next(error)
  }
})

router.delete('/:id', requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    if (req.user!.id === String(req.params.id)) {
      return res.status(400).json({ message: 'Tidak dapat menghapus akun sendiri.' })
    }
    const user = await prisma.user.findUnique({ where: { id: String(req.params.id) } })
    if (!user) return res.status(404).json({ message: 'User not found.' })

    const [queue, boxes, results] = await Promise.all([
      prisma.queueItem.count({ where: { operatorId: user.id } }),
      prisma.completedBox.count({ where: { operatorUserId: user.id } }),
      prisma.productionShiftRecord.count({ where: { operatorUserId: user.id } }),
    ])
    if (queue + boxes + results > 0) {
      return res.status(400).json({
        message:
          'User masih memiliki transaksi produksi. Nonaktifkan akun ini agar histori tetap utuh.',
      })
    }

    await prisma.user.delete({ where: { id: user.id } })
    await prisma.auditLog.create({
      data: {
        title: `User ${user.employeeId} dihapus`,
        detail: user.name,
        type: 'system',
      },
    })
    res.json({ ok: true })
  } catch (error) {
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
