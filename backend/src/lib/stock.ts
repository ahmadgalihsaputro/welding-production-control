import type { Prisma } from '@prisma/client'

export function stockStatus(store: number, safetyStock: number, maxStore: number) {
  if (store <= 0) return 'empty' as const
  if (store <= safetyStock) return 'low' as const
  if (maxStore > 0 && store >= maxStore) return 'full' as const
  return 'safe' as const
}

interface StockMovementInput {
  partNumber: string
  delta: number
  type: 'Opening' | 'Store In' | 'Supply Issue' | 'Collect Pickup' | 'Return Accepted' | 'Adjustment'
  location?: string
  reference: string
  user: string
  allowNegative?: boolean
}

export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMovementInput,
) {
  const stock = await tx.stockItem.findUnique({ where: { partNumber: input.partNumber } })
  if (!stock) throw new Error(`Stock item ${input.partNumber} tidak ditemukan.`)

  const nextStore = stock.store + input.delta
  if (nextStore < 0 && !input.allowNegative) {
    throw new Error(`Stok ${input.partNumber} tidak cukup (tersedia ${stock.store}).`)
  }

  const updated = await tx.stockItem.update({
    where: { partNumber: stock.partNumber },
    data: {
      store: Math.max(nextStore, 0),
      status: stockStatus(Math.max(nextStore, 0), stock.safetyStock, stock.maxStore),
    },
  })

  const ledger = await tx.ledgerEntry.create({
    data: {
      partNumber: stock.partNumber,
      type: input.type,
      qty: input.delta,
      balance: updated.store,
      location: input.location ?? stock.location,
      reference: input.reference,
      user: input.user,
    },
  })

  return { stock: updated, ledger }
}
