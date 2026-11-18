import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { authenticate, requireRole, type AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'
import { currentUserShift } from '../lib/userShift.js'

const router = Router()

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const userWithAreas = {
  workAreas: { include: { workArea: true } },
  partSkills: { include: { part: true } },
} as const

function toPublicUser(user: {
  id: string
  employeeId: string
  username: string
  name: string
  email: string | null
  phone: string | null
  role: string
  roleLabel: string
  area: string
  line: string
  initials: string
  status: string
  shiftMode: string
  shiftBase: number
  shiftAnchorDate: Date | null
  workAreas: Array<{ workArea: { id: string; label: string; line: string; type: string; process: string } }>
  partSkills: Array<{ part: { partNumber: string; line: string; type: string; process: string } }>
}) {
  const skills = user.partSkills
    .map((skill) => skill.part)
    .filter((part) => part.type === 'Assy' || part.type === 'Sub_Assy')
  const groupedAreas = new Map<string, {
    id: string
    label: string
    line: string
    type: string
    process: string
    partNumbers: string[]
  }>()
  for (const part of skills) {
    const key = `${part.line}:${part.type}`
    const area = groupedAreas.get(key) ?? {
      id: key,
      label: `${part.line} · ${part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'}`,
      line: part.line,
      type: part.type,
      process: '',
      partNumbers: [],
    }
    area.partNumbers.push(part.partNumber)
    groupedAreas.set(key, area)
  }

  return {
    id: user.id,
    employeeId: user.employeeId,
    username: user.username,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    roleLabel: user.roleLabel,
    area: user.area,
    line: user.line,
    initials: user.initials,
    status: user.status,
    shiftMode: user.shiftMode,
    shiftBase: user.shiftBase,
    shiftAnchorDate: user.shiftAnchorDate?.toISOString().slice(0, 10) ?? null,
    currentShift: currentUserShift(user),
    workAreas: groupedAreas.size > 0
      ? Array.from(groupedAreas.values())
      : user.workAreas.map((assignment) => ({
          ...assignment.workArea,
          partNumbers: [] as string[],
        })),
    partSkills: skills,
  }
}

router.post('/login', async (req, res, next) => {
  try {
    const { identifier, password } = loginSchema.parse(req.body)
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: { equals: identifier, mode: 'insensitive' } },
          { employeeId: identifier.toUpperCase() },
        ],
      },
      include: userWithAreas,
    })

    if (!user || user.status !== 'active' || !(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ message: 'Invalid credentials.' })
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() },
    })

    const token = jwt.sign({ sub: user.id, role: user.role }, env.jwtSecret, {
      expiresIn: env.jwtExpiresIn as jwt.SignOptions['expiresIn'],
    })

    return res.json({
      token,
      user: toPublicUser(user),
    })
  } catch (error) {
    next(error)
  }
})

router.get('/me', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: userWithAreas,
    })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    res.json(toPublicUser(user))
  } catch (error) {
    next(error)
  }
})

const profileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  email: z.string().trim().email().nullable().optional(),
  phone: z.string().trim().max(30).nullable().optional(),
  initials: z.string().min(1).max(4).optional(),
})

router.patch('/profile', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = profileSchema.parse(req.body)
    const user = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { id: req.user!.id } })
      if (!existing) return null

      const updated = await tx.user.update({
        where: { id: existing.id },
        data: body,
        include: userWithAreas,
      })
      await tx.auditLog.create({
        data: {
          title: 'Profil pengguna diperbarui',
          detail: `${updated.name} · ${updated.employeeId}`,
          type: 'system',
        },
      })
      return updated
    })
    if (!user) return res.status(404).json({ message: 'Akun pengguna tidak ditemukan.' })

    res.json(toPublicUser(user))
  } catch (error) {
    next(error)
  }
})

const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
})

router.post('/change-password', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = passwordSchema.parse(req.body)
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } })
    if (!user) return res.status(404).json({ message: 'User not found.' })
    if (!(await bcrypt.compare(body.currentPassword, user.password))) {
      return res.status(400).json({ message: 'Password saat ini tidak sesuai.' })
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { password: await bcrypt.hash(body.newPassword, 10) },
    })
    await prisma.auditLog.create({
      data: {
        title: 'Password pengguna diubah',
        detail: `${user.name} · ${user.employeeId}`,
        type: 'system',
      },
    })
    res.json({ ok: true })
  } catch (error) {
    next(error)
  }
})

export default router
