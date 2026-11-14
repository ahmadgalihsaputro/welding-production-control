import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { z } from 'zod'
import { authenticate, type AuthenticatedRequest } from '../middleware/auth.js'
import { prisma } from '../lib/prisma.js'
import { env } from '../config/env.js'

const router = Router()

const loginSchema = z.object({
  identifier: z.string().min(1),
  password: z.string().min(1),
})

const userWithAreas = {
  workAreas: { include: { workArea: true } },
} as const

function toPublicUser(user: {
  id: string
  employeeId: string
  username: string
  name: string
  email: string | null
  role: string
  roleLabel: string
  area: string
  line: string
  initials: string
  status: string
  workAreas: Array<{ workArea: { id: string; label: string; line: string; type: string; process: string } }>
}) {
  return {
    id: user.id,
    employeeId: user.employeeId,
    username: user.username,
    name: user.name,
    email: user.email,
    role: user.role,
    roleLabel: user.roleLabel,
    area: user.area,
    line: user.line,
    initials: user.initials,
    status: user.status,
    workAreas: user.workAreas.map((assignment) => assignment.workArea),
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
  name: z.string().min(1).optional(),
  email: z.string().email().nullable().optional(),
  initials: z.string().min(1).max(4).optional(),
})

router.patch('/profile', authenticate, async (req: AuthenticatedRequest, res, next) => {
  try {
    const body = profileSchema.parse(req.body)
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: body,
      include: userWithAreas,
    })
    await prisma.auditLog.create({
      data: {
        title: 'Profil pengguna diperbarui',
        detail: `${user.name} · ${user.employeeId}`,
        type: 'system',
      },
    })
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
