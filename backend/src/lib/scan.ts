import { randomUUID } from 'node:crypto'
import { z } from 'zod'
import { prisma } from './prisma.js'

const kanbanBarcodeSchema = z.object({
  version: z.literal(1),
  partNumber: z.string().min(1),
  line: z.string().min(1),
  qty: z.number().int().positive(),
  operator: z.string().min(1),
  shift: z.number().int().min(1).max(2),
  model: z.string().min(1),
  storeLocation: z.string().min(1),
  kanbanType: z.enum(['KD', 'Reguler']),
  partType: z.enum(['Assy', 'Sub_Assy']),
  process: z.string().min(1),
  nextProcess: z.string().min(1),
})

const supplierCategories = new Set(['Press Part', 'Child Part', 'Nut', 'Bolt', 'Bolt/Nut'])

export type ScanActor = { name: string }
export type ScanResult<T> = { ok: true; value: T } | { ok: false; status: number; message: string }

// Scanner HID mengirim kode pairing sebagai prefix tiap hasil scan: SCN-XXXXXXXX|<barcode>
const scanPrefixPattern = /^(SCN-[A-Z0-9-]+)\s*\|/

export function splitScanCode(rawCode: string): { deviceCode?: string; code: string } {
  const trimmed = rawCode.trim()
  const match = trimmed.match(scanPrefixPattern)
  return match
    ? { deviceCode: match[1], code: trimmed.slice(match[0].length).trim() }
    : { code: trimmed }
}

export function getKanbanPartType(code: string): 'Assy' | 'Sub_Assy' | null {
  try {
    const payload: unknown = JSON.parse(code.trim())
    if (payload && typeof payload === 'object') {
      const partType = (payload as Record<string, unknown>).partType
      if (partType === 'Assy' || partType === 'Sub_Assy') return partType
    }
  } catch {
    // QR part number polos bukan payload kanban.
  }
  return null
}

export async function createProductionScanRequest(
  code: string,
  actor: ScanActor,
): Promise<ScanResult<{ id: string; code: string; partNumber: string; type: string }>> {
  let decoded: unknown
  try {
    decoded = JSON.parse(code.trim())
  } catch {
    return { ok: false, status: 400, message: 'Barcode Kanban tidak berisi payload JSON yang valid.' }
  }
  const parsedBarcode = kanbanBarcodeSchema.safeParse(decoded)
  if (!parsedBarcode.success) {
    return { ok: false, status: 400, message: 'Payload barcode Kanban tidak lengkap atau tidak valid.' }
  }
  const barcode = parsedBarcode.data
  const partNumber = barcode.partNumber.trim().toUpperCase()
  const model = barcode.model.trim().toUpperCase()
  const part = await prisma.productionPart.findUnique({ where: { partNumber } })
  if (
    !part ||
    part.status !== 'active' ||
    (part.type !== 'Assy' && part.type !== 'Sub_Assy') ||
    part.type !== barcode.partType
  ) {
    return { ok: false, status: 400, message: 'Part number atau jenis part pada barcode tidak sesuai Master Part.' }
  }
  if (!part.models.includes(model) || part.line !== barcode.line || part.process !== barcode.process) {
    return {
      ok: false,
      status: 400,
      message: `Data line, proses, atau model pada barcode tidak sesuai Master Part untuk ${partNumber}.`,
    }
  }
  const config = await prisma.kanbanPartConfig.findUnique({
    where: { partNumber_model: { partNumber, model } },
  })
  if (
    !config ||
    config.storeLocation !== barcode.storeLocation ||
    config.kanbanType !== barcode.kanbanType ||
    config.nextProcess !== barcode.nextProcess ||
    barcode.qty > config.quantity
  ) {
    return { ok: false, status: 400, message: 'Konfigurasi barcode sudah berubah atau tidak sesuai Master Kanban.' }
  }
  const location = await prisma.inventoryLocation.findUnique({ where: { code: barcode.storeLocation } })
  if (!location || location.status !== 'active') {
    return { ok: false, status: 400, message: 'Store Location pada barcode tidak aktif atau tidak terdaftar.' }
  }
  const canonicalBarcode = JSON.stringify({
    version: 1,
    partNumber,
    line: part.line,
    qty: barcode.qty,
    operator: barcode.operator.trim(),
    shift: barcode.shift,
    model,
    storeLocation: config.storeLocation,
    kanbanType: config.kanbanType,
    partType: part.type,
    process: part.process,
    nextProcess: config.nextProcess,
  })
  const [existingItem, existingRequest] = await Promise.all([
    prisma.queueItem.findFirst({
      where: { barcodePayload: canonicalBarcode, status: { not: 'complete' } },
    }),
    prisma.productionRequest.findFirst({
      where: { barcodePayload: canonicalBarcode, status: 'pending' },
    }),
  ])
  if (existingItem || existingRequest) {
    return {
      ok: false,
      status: 409,
      message: `Kanban ${partNumber} · ${model} sedang diproses dan tidak dapat discan ulang.`,
    }
  }

  const request = await prisma.productionRequest.create({
    data: {
      code: `SCAN-${randomUUID()}`,
      barcodePayload: canonicalBarcode,
      partNumber,
      model,
      type: part.type,
      line: part.line,
      process: part.type === 'Sub_Assy' ? part.process : null,
      qty: barcode.qty,
      sourceShift: barcode.shift,
      status: 'pending',
    },
  })
  await prisma.auditLog.create({
    data: {
      title: `Permintaan ${partNumber} menunggu alokasi`,
      detail: `${partNumber} · ${barcode.qty} pcs · scan ${part.type} oleh ${actor.name}`,
      type: part.type,
      line: part.line,
      process: part.type === 'Sub_Assy' ? part.process : null,
    },
  })
  return { ok: true, value: request }
}

// QR supplier berisi part number polos; payload kanban produksi membawa qty eksplisit.
// shortcut: part number polos memakai packaging sebagai qty satu kanban, upgrade saat QR supply punya qty.
export async function createSupplierQueueRequest(
  code: string,
  actor: ScanActor,
  note?: string,
): Promise<ScanResult<{ id: string; code: string; partNumber: string; pcsPerBox: number }>> {
  const trimmed = code.trim()
  let partNumber = trimmed.toUpperCase()
  let qty: number | undefined
  if (trimmed.startsWith('{')) {
    try {
      const payload: unknown = JSON.parse(trimmed)
      if (payload && typeof payload === 'object') {
        const record = payload as Record<string, unknown>
        if (typeof record.partNumber === 'string') partNumber = record.partNumber.trim().toUpperCase()
        if (Number.isInteger(record.qty) && (record.qty as number) > 0) qty = record.qty as number
      }
    } catch {
      // Bukan JSON, dibaca sebagai part number polos.
    }
  }
  if (!partNumber) return { ok: false, status: 400, message: 'Kode scan tidak valid.' }

  const stock = await prisma.stockItem.findUnique({ where: { partNumber } })
  if (!stock) {
    return {
      ok: false,
      status: 404,
      message: `Part number ${partNumber} belum terdaftar di Master Data → Inventory Location.`,
    }
  }
  if (!supplierCategories.has(stock.category)) {
    return {
      ok: false,
      status: 400,
      message: `Antrian supplier hanya untuk Press Part, Child Part, Nut, dan Bolt. ${partNumber} adalah ${stock.category}.`,
    }
  }
  const quantity = qty ?? (stock.packaging > 0 ? stock.packaging : 1)
  const requestCode = `SQ-${randomUUID()}`
  const request = await prisma.$transaction(async (tx) => {
    const created = await tx.materialRequest.create({
      data: {
        code: requestCode,
        kind: 'receiving',
        partNumber,
        boxes: 1,
        pcsPerBox: quantity,
        destination: 'Supplier',
        requester: actor.name,
        note: note ?? `Kanban ${partNumber} menunggu masuk stok.`,
        status: 'waiting',
      },
    })
    await tx.auditLog.create({
      data: {
        title: `Scan kanban supplier ${partNumber}`,
        detail: `${quantity} pcs masuk antrian supplier · ${requestCode} · scanner ${actor.name}`,
        type: 'inventory',
      },
    })
    return created
  })
  return { ok: true, value: request }
}
