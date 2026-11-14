import { env } from './config/env.js'
import app from './app.js'
import { prisma } from './lib/prisma.js'

const server = app.listen(env.port, '127.0.0.1', () => {
  console.log(`WPC backend listening on http://127.0.0.1:${env.port}`)
})

async function shutdown() {
  await prisma.$disconnect()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
