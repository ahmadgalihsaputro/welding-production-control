import assert from 'node:assert/strict'
import { test } from 'node:test'
import type { Prisma } from '@prisma/client'
import { applyStockMovement, stockStatus } from '../src/lib/stock.js'

function mockTx(count: number, store = 0) {
  const calls = { updateMany: 0, findUnique: 0, ledger: 0 }
  const tx = {
    stockItem: {
      updateMany: async (args: { where: Record<string, unknown> }) => {
        calls.updateMany++
        assert.equal(args.where.partNumber, 'AAA')
        assert.deepEqual(args.where.store, { gte: 5 })
        return { count }
      },
      findUnique: async () => ({ partNumber: 'AAA', store, safetyStock: 10, maxStore: 100, location: 'WH' }),
      findUniqueOrThrow: async () => ({ partNumber: 'AAA', store, safetyStock: 10, maxStore: 100, location: 'WH' }),
      update: async () => ({ partNumber: 'AAA', store, status: 'safe' }),
    },
    ledgerEntry: {
      create: async () => {
        calls.ledger++
        return { id: 'ledger-1' }
      },
    },
  }
  return { tx: tx as unknown as Prisma.TransactionClient, calls }
}

const input = {
  partNumber: 'AAA',
  delta: -5,
  type: 'Supply Issue' as const,
  reference: 'TEST-1',
  user: 'test',
}

test('stok tidak cukup menolak mutasi tanpa menulis ledger', async () => {
  const { tx, calls } = mockTx(0, 3)
  await assert.rejects(applyStockMovement(tx, input), /tidak cukup/)
  assert.equal(calls.ledger, 0)
})

test('mutasi berhasil menulis ledger dengan saldo hasil update', async () => {
  const { tx, calls } = mockTx(1, 15)
  const result = await applyStockMovement(tx, input)
  assert.equal(result.ledger.id, 'ledger-1')
  assert.equal(calls.ledger, 1)
})

test('status stok mengikuti safety stock dan max store', () => {
  assert.equal(stockStatus(0, 10, 100), 'empty')
  assert.equal(stockStatus(10, 10, 100), 'low')
  assert.equal(stockStatus(100, 10, 100), 'full')
  assert.equal(stockStatus(50, 10, 100), 'safe')
})
