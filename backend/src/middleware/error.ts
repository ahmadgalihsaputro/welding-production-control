import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { Prisma } from '@prisma/client'

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found.` })
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(422).json({
      message: 'Validasi gagal.',
      errors: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : 'data'
      return res.status(409).json({ message: `Data dengan ${target} tersebut sudah ada.` })
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ message: 'Data tidak ditemukan.' })
    }
    if (err.code === 'P2003') {
      return res.status(400).json({ message: 'Data masih dipakai oleh transaksi lain.' })
    }
  }

  console.error(err)
  if (err instanceof Error) {
    return res.status(400).json({ message: err.message })
  }
  return res.status(500).json({ message: 'Internal server error.' })
}
