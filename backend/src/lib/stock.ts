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
}

export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMovementInput,
) {
  // updateMany dengan syarat stok tersedia bersifat atomik: dua scanner tidak bisa membaca angka lama yang sama.
  const moved = await tx.stockItem.updateMany({
    where: {
      partNumber: input.partNumber,
      ...(input.delta >= 0 ? {} : { store: { gte: -input.delta } }),
    },
    data: { store: { increment: input.delta } },
  })
  if (moved.count === 0) {
    const stock = await tx.stockItem.findUnique({ where: { partNumber: input.partNumber } })
    if (!stock) throw new Error(`Stock item ${input.partNumber} tidak ditemukan.`)
    throw new Error(`Stok ${input.partNumber} tidak cukup (tersedia ${stock.store}).`)
  }

  const stock = await tx.stockItem.findUniqueOrThrow({ where: { partNumber: input.partNumber } })
  const updated = await tx.stockItem.update({
    where: { partNumber: input.partNumber },
    data: { status: stockStatus(stock.store, stock.safetyStock, stock.maxStore) },
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
