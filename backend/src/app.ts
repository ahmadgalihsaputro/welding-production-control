import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import morgan from 'morgan'
import authRoutes from './routes/auth.js'
import usersRoutes from './routes/users.js'
import settingsRoutes from './routes/settings.js'
import dashboardRoutes from './routes/dashboard.js'
import productionRoutes from './routes/production.js'
import materialRoutes from './routes/material.js'
import inventoryRoutes from './routes/inventory.js'
import masterRoutes from './routes/master.js'
import reportRoutes from './routes/report.js'
import { errorHandler, notFoundHandler } from './middleware/error.js'

declare global {
  interface BigInt {
    toJSON(): string
  }
}

BigInt.prototype.toJSON = function toJSON(this: bigint) {
  return this.toString()
}

const app = express()

app.use(helmet())
app.use(cors({ origin: process.env.CORS_ORIGIN ?? 'http://localhost:5173', credentials: true }))
app.use(morgan('dev'))
app.use(express.json())

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'wpc-backend' })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', usersRoutes)
app.use('/api/settings', settingsRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/production', productionRoutes)
app.use('/api/material', materialRoutes)
app.use('/api/inventory', inventoryRoutes)
app.use('/api/master', masterRoutes)
app.use('/api/report', reportRoutes)

app.use(notFoundHandler)
app.use(errorHandler)

export default app
