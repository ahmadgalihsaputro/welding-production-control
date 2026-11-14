import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { prisma } from '../lib/prisma.js'

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string
    employeeId: string
    username: string
    name: string
    role: string
    roleLabel: string
  }
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid authorization header.' })
  }

  try {
    const token = header.slice(7)
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string }
    prisma.user.findUnique({ where: { id: payload.sub } }).then((user) => {
      if (!user || user.status !== 'active') {
        return res.status(401).json({ message: 'User is inactive or not found.' })
      }
      req.user = {
        id: user.id,
        employeeId: user.employeeId,
        username: user.username,
        name: user.name,
        role: user.role,
        roleLabel: user.roleLabel,
      }
      next()
    }).catch(next)
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token.' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'You do not have permission to perform this action.' })
    }
    next()
  }
}