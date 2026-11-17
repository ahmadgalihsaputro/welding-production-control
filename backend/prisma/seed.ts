import { PrismaClient, type QueueType } from '@prisma/client'
import bcrypt from 'bcryptjs'
import XLSX from 'xlsx'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const prisma = new PrismaClient()

const here = dirname(fileURLToPath(import.meta.url))
const workbookPath =
  [
    resolve(process.cwd(), '../KOMPOSISI RB.G.xlsx'),
    resolve(here, '../../KOMPOSISI RB.G.xlsx'),
  ].find((path) => existsSync(path)) ??
  (() => {
    throw new Error('KOMPOSISI RB.G.xlsx not found at the repository root.')
  })()

const LINE = 'Robot G'

interface SubAssemblyRow {
  process: string
  partNumber: string
  packaging: number | null
  maxStore: number | null
  cycleTime: number | null
  bolts: Array<{ partNumber: string; packaging: number | null }>
  pressParts: Array<{ partNumber: string; packaging: number | null }>
}

interface AssyBlock {
  model: string
  partNumber: string
  packaging: number | null
  maxStore: number | null
  cycleTime: number | null
  subAssemblies: SubAssemblyRow[]
  childParts: Array<{ partNumber: string; packaging: number | null }>
}

interface StockSeed {
  partNumber: string
  description: string
  category: 'Assy' | 'Sub Assy' | 'Press Part' | 'Bolt/Nut' | 'Child Part'
  packaging: number
  maxStore: number
  safetyStock: number
  store: number
  location: string
}

function text(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function integer(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed) : null
}

function positiveNumber(value: unknown): number | null {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null
}

function readComposition(): AssyBlock[] {
  const workbook = XLSX.readFile(workbookPath)
  const sheet = workbook.Sheets['Komposisi']
  if (!sheet) throw new Error('Sheet "Komposisi" is missing from KOMPOSISI RB.G.xlsx.')
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const blocks: AssyBlock[] = []

  let block: AssyBlock | null = null
  let sub: SubAssemblyRow | null = null

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index] ?? []
    const lineProcess = text(row[0])
    const assyModel = text(row[1])

    if ((lineProcess === 'RB.G' || !lineProcess) && assyModel && text(row[2])) {
      block = {
        model: assyModel,
        partNumber: text(row[2]).toUpperCase(),
        packaging: integer(row[3]),
        maxStore: integer(row[4]),
        cycleTime: positiveNumber(row[5]),
        subAssemblies: [],
        childParts: [],
      }
      blocks.push(block)
      sub = null
    }
    if (!block) continue

    const process = text(row[7])
    const subPartNumber = text(row[8]).toUpperCase()
    if (process && process.toUpperCase() !== 'SUPPLIER' && subPartNumber) {
      sub = {
        process,
        partNumber: subPartNumber,
        packaging: integer(row[9]),
        maxStore: integer(row[10]),
        cycleTime: positiveNumber(row[11]),
        bolts: [],
        pressParts: [],
      }
      block.subAssemblies.push(sub)
    }

    const boltPartNumber = text(row[14]).toUpperCase()
    if (boltPartNumber && sub) {
      sub.bolts.push({ partNumber: boltPartNumber, packaging: integer(row[15]) })
    }
    const pressPartNumber = text(row[18]).toUpperCase()
    if (pressPartNumber) {
      if (sub) {
        sub.pressParts.push({ partNumber: pressPartNumber, packaging: integer(row[19]) })
      }
    }
    const childPartNumber = text(row[22]).toUpperCase()
    if (childPartNumber) {
      block.childParts.push({ partNumber: childPartNumber, packaging: integer(row[23]) })
    }
  }

  if (blocks.length === 0) {
    throw new Error('No Assy rows found in the "Komposisi" sheet.')
  }

  return blocks
}

function readShiftRows() {
  const workbook = XLSX.readFile(workbookPath)
  const sheet = workbook.Sheets['Jam Kerja']
  if (!sheet) return []
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })
  const shifts: Array<{
    name: string
    start: string
    end: string
    breakStart: string
    breakEnd: string
    workHours: number
    maxOvertimeMinutes: number
  }> = []

  for (const row of rows) {
    const name = text(row[0])
    const hours = text(row[1])
    if (!/^SHIFT\s+\d+$/i.test(name) || !hours.includes('-')) continue
    const [start, end] = hours.split('-').map((value) => value.trim().replace('.', ':'))
    const [breakStart, breakEnd] = text(row[2])
      .split('-')
      .map((value) => value.trim().replace('.', ':'))
    const overtime = Number(row[6])
    shifts.push({
      name: name.replace(/^SHIFT\s+/i, 'Shift '),
      start,
      end,
      breakStart: breakStart || '',
      breakEnd: breakEnd || '',
      workHours: Number(row[5]) || 0,
      maxOvertimeMinutes: Number.isFinite(overtime) ? Math.round(overtime * 60) : 0,
    })
  }

  return shifts
}

const users = [
  {
    employeeId: 'AD001',
    username: 'admin',
    name: 'Ahmad Galih',
    email: 'ahmad.galih@wpc.local',
    role: 'admin' as const,
    roleLabel: 'Administrator',
    area: 'IT — Manufacturing System',
    line: 'All lines',
    initials: 'AG',
  },
  {
    employeeId: 'LD001',
    username: 'leader',
    name: 'Uuk Riyanto',
    email: 'uuk.riyanto@wpc.local',
    role: 'leader' as const,
    roleLabel: 'Leader Produksi',
    area: 'Welding — Robot G',
    line: 'Robot G',
    initials: 'UR',
  },
  {
    employeeId: 'OA001',
    username: 'operator.assy',
    name: 'Andri Setiawan',
    email: 'andri.setiawan@wpc.local',
    role: 'operator_assy' as const,
    roleLabel: 'Operator Assy',
    area: 'Welding — Assy Robot G',
    line: 'Robot G — Assy',
    initials: 'AS',
  },
  {
    employeeId: 'OS001',
    username: 'operator.subassy',
    name: 'Rizky Anu',
    email: 'rizky.anu@wpc.local',
    role: 'operator_sub_assy' as const,
    roleLabel: 'Operator Sub Assy',
    area: 'Welding — Sub Assy Robot G',
    line: 'Robot G — Sub Assy',
    initials: 'RA',
  },
  {
    employeeId: 'OB001',
    username: 'operator.both',
    name: 'Dedi Kurniawan',
    email: 'dedi.kurniawan@wpc.local',
    role: 'operator_both' as const,
    roleLabel: 'Operator Assy + Sub Assy',
    area: 'Welding — Robot G',
    line: 'Robot G — Assy + Sub Assy',
    initials: 'DK',
  },
  {
    employeeId: 'MG001',
    username: 'management',
    name: 'Puji Utomo',
    email: 'puji.utomo@wpc.local',
    role: 'management' as const,
    roleLabel: 'Management',
    area: 'Plant Management',
    line: 'All lines',
    initials: 'PU',
  },
]

const machines = [
  { code: 'LINE-ROBOT-G', name: 'Robot G', line: 'Robot G', processes: [], status: 'active' },
  { code: 'LINE-ROBOT-H', name: 'Robot H', line: 'Robot H', processes: [], status: 'active' },
  { code: 'LINE-ROBOT-A', name: 'Robot A', line: 'Robot A', processes: [], status: 'active' },
  { code: 'RB-G-WLD-ASSY', name: 'Robot G — Welding Assy', line: 'Robot G', processes: ['Assy Welding'], status: 'active' },
  { code: 'RB-G-WLD-SA', name: 'Robot G — Welding Sub Assy', line: 'Robot G', processes: ['Sub Assy Welding'], status: 'active' },
  { code: 'RB-G-PRS', name: 'Robot G — Press', line: 'Robot G', processes: ['Press Part'], status: 'active' },
  { code: 'CNC-01', name: 'CNC Machining 01', line: 'Robot G', processes: ['Child Part'], status: 'active' },
  { code: 'RB-H-WLD', name: 'Robot H — Welding', line: 'Robot H', processes: ['Assy Welding', 'Sub Assy Welding'], status: 'maintenance' },
  { code: 'QC-01', name: 'QC Inspection Station', line: 'Robot G', processes: ['Inspection'], status: 'active' },
]

const locations = [
  { code: 'R-G/A/01', name: 'Assy Store A', type: 'Store', line: 'Robot G', capacity: 500, status: 'active' },
  { code: 'R-G/A/02', name: 'Assy Store B', type: 'Store', line: 'Robot G', capacity: 300, status: 'active' },
  { code: 'R-G/SA/01', name: 'Sub Assy Store A', type: 'Store', line: 'Robot G', capacity: 800, status: 'active' },
  { code: 'R-G/SA/02', name: 'Sub Assy Store B', type: 'Store', line: 'Robot G', capacity: 600, status: 'active' },
  { code: 'R-G/SA/03', name: 'Sub Assy Store C', type: 'Store', line: 'Robot G', capacity: 600, status: 'active' },
  { code: 'R-G/BUF/01', name: 'Production Buffer', type: 'Buffer', line: 'Robot G', capacity: 200, status: 'active' },
  { code: 'R-G/EXT/01', name: 'External Material Area', type: 'External', line: 'Robot G', capacity: 1000, status: 'active' },
  { code: 'R-G/RET/01', name: 'Return Area', type: 'Return', line: 'Robot G', capacity: 150, status: 'active' },
  { code: 'R-G/P/01', name: 'Press Part Store', type: 'Store', line: 'Robot G', capacity: 500, status: 'active' },
  { code: 'R-G/C/01', name: 'Bolt/Nut Store', type: 'Store', line: 'Robot G', capacity: 500, status: 'active' },
]

const kanbanConfigs = [
  { type: 'Assy', prefix: 'KN-ASSY', format: '{prefix}-{date}-{seq}', fields: ['PN', 'Qty', 'Line', 'Shift'], template: 'A4-landscape', active: true },
  { type: 'Sub_Assy', prefix: 'KN-SA', format: '{prefix}-{date}-{seq}', fields: ['PN', 'Qty', 'Line', 'Shift'], template: 'A4-landscape', active: true },
  { type: 'External', prefix: 'KN-EXT', format: '{prefix}-{date}-{seq}', fields: ['PN', 'Qty', 'Supplier'], template: 'A4-portrait', active: false },
]

const devices = [
  { name: 'Tablet Assy Line 01', type: 'Tablet', location: 'Robot G — Area Assy', assignedTo: 'Andri Setiawan', status: 'online' },
  { name: 'Tablet Sub Assy 02', type: 'Tablet', location: 'Robot G — Sub Assy', assignedTo: 'Rizky Anu', status: 'online' },
  { name: 'Scanner Supply Kiosk 01', type: 'Scanner', location: 'Material Supply', assignedTo: 'Kiosk tanpa akun', status: 'online' },
  { name: 'Printer Kanban Buffer', type: 'Printer', location: 'Production Buffer', assignedTo: 'Leader Produksi', status: 'offline' },
]

const settings: Array<{ key: string; value: unknown }> = [
  {
    key: 'preferences',
    value: { language: 'id', timezone: 'Asia/Jakarta', dateFormat: 'DD/MM/YYYY', density: 'comfortable', autoRefreshSeconds: 60 },
  },
  {
    key: 'notifications',
    value: { materialAlert: true, stockLow: true, machineDown: true, productionDelay: true, email: false, desktop: true },
  },
  {
    key: 'integration',
    value: { fssEnabled: false, fssEndpoint: '', syncIntervalMinutes: 15, lastSyncAt: null },
  },
  {
    key: 'printing',
    value: { defaultTemplate: 'A4-landscape', barcode: 'code128', printer: 'Printer Kanban Buffer', copies: 1 },
  },
  {
    key: 'security',
    value: { sessionMinutes: 480, minPasswordLength: 8, requireUppercase: true, requireNumber: true, auditLog: true },
  },
  {
    key: 'backup',
    value: { automatic: true, schedule: '02:00', retentionDays: 30, lastBackupAt: null },
  },
]

function stockStatus(store: number, safetyStock: number, maxStore: number) {
  if (store <= 0) return 'empty' as const
  if (store <= safetyStock) return 'low' as const
  if (store >= maxStore) return 'full' as const
  return 'safe' as const
}

function buildMasterData(blocks: AssyBlock[]) {
  const parts = new Map<string, { partNumber: string; line: string; type: QueueType; process: string; models: Set<string>; packaging: number | null; maxStore: number | null; cycleTime: number | null }>()
  const stock = new Map<string, StockSeed>()
  const boms = new Map<string, Map<string, number>>()

  const mergeCycleTime = (partNumber: string, current: number | null, incoming: number | null) => {
    if (current !== null && incoming !== null && current !== incoming) {
      throw new Error(`Conflicting cycle times for part ${partNumber}: ${current} and ${incoming}.`)
    }
    return current ?? incoming
  }

  const addStock = (entry: StockSeed) => {
    const current = stock.get(entry.partNumber)
    if (!current || entry.maxStore > current.maxStore) stock.set(entry.partNumber, entry)
  }

  const addBom = (parent: string, component: string, quantity = 1) => {
    if (parent === component) return
    const components = boms.get(parent) ?? new Map<string, number>()
    components.set(component, quantity)
    boms.set(parent, components)
  }

  for (const block of blocks) {
    const existing = parts.get(block.partNumber)
    if (existing) {
      existing.models.add(block.model)
      existing.cycleTime = mergeCycleTime(block.partNumber, existing.cycleTime, block.cycleTime)
    } else {
      parts.set(block.partNumber, {
        partNumber: block.partNumber,
        line: LINE,
        type: 'Assy',
        process: 'RB.G',
        models: new Set([block.model]),
        packaging: block.packaging,
        maxStore: block.maxStore,
        cycleTime: block.cycleTime,
      })
    }

    const assyPackaging = block.packaging ?? 1
    const assyMaxStore = block.maxStore ?? assyPackaging * 4
    addStock({
      partNumber: block.partNumber,
      description: `Assy ${block.model}`,
      category: 'Assy',
      packaging: assyPackaging,
      maxStore: assyMaxStore,
      safetyStock: Math.max(assyPackaging, Math.ceil(assyMaxStore * 0.15)),
      store: Math.floor((assyMaxStore * 0.65) / assyPackaging) * assyPackaging,
      location: 'R-G/A/01',
    })

    for (const sub of block.subAssemblies) {
      for (const press of sub.pressParts) {
        if (sub.partNumber) addBom(sub.partNumber, press.partNumber)
        else addBom(block.partNumber, press.partNumber)
        addStock({
          partNumber: press.partNumber,
          description: `Press Part ${press.partNumber}`,
          category: 'Press Part',
          packaging: press.packaging ?? 1,
          maxStore: (press.packaging ?? 1) * 4,
          safetyStock: Math.max(1, Math.ceil((press.packaging ?? 1) * 0.5)),
          store: (press.packaging ?? 1) * 2,
          location: 'R-G/P/01',
        })
      }

      for (const bolt of sub.bolts) {
        if (!sub.partNumber) continue
        addBom(sub.partNumber, bolt.partNumber)
        addStock({
          partNumber: bolt.partNumber,
          description: `Bolt/Nut ${bolt.partNumber}`,
          category: 'Bolt/Nut',
          packaging: bolt.packaging ?? 1,
          maxStore: (bolt.packaging ?? 1) * 2,
          safetyStock: Math.max(1, Math.ceil((bolt.packaging ?? 1) * 0.2)),
          store: bolt.packaging ?? 1,
          location: 'R-G/C/01',
        })
      }

      if (!sub.partNumber) continue
      const subPackaging = sub.packaging ?? 1
      const subMaxStore = sub.maxStore ?? subPackaging * 4
      const existingSub = parts.get(sub.partNumber)
      if (existingSub) {
        existingSub.models.add(block.model)
        existingSub.cycleTime = mergeCycleTime(sub.partNumber, existingSub.cycleTime, sub.cycleTime)
      } else {
        parts.set(sub.partNumber, {
          partNumber: sub.partNumber,
          line: LINE,
          type: 'Sub_Assy',
          process: sub.process,
          models: new Set([block.model]),
          packaging: sub.packaging,
          maxStore: sub.maxStore,
          cycleTime: sub.cycleTime,
        })
      }
      addStock({
        partNumber: sub.partNumber,
        description: `Sub Assy ${sub.process}`,
        category: 'Sub Assy',
        packaging: subPackaging,
        maxStore: subMaxStore,
        safetyStock: Math.max(subPackaging, Math.ceil(subMaxStore * 0.15)),
        store: Math.floor((subMaxStore * 0.65) / subPackaging) * subPackaging,
        location: 'R-G/SA/01',
      })
      addBom(block.partNumber, sub.partNumber)
    }

    for (const child of block.childParts) {
      addBom(block.partNumber, child.partNumber)
      addStock({
        partNumber: child.partNumber,
        description: `Child Part ${child.partNumber}`,
        category: 'Child Part',
        packaging: child.packaging ?? 1,
        maxStore: (child.packaging ?? 1) * 4,
        safetyStock: Math.max(1, Math.ceil((child.packaging ?? 1) * 0.5)),
        store: child.packaging ?? 1,
        location: 'R-G/EXT/01',
      })
    }
  }

  return { parts, stock, boms }
}

async function syncWorkbookMasterData(
  blocks: AssyBlock[],
  masterData: ReturnType<typeof buildMasterData>,
) {
  const { parts, stock, boms } = masterData
  if (parts.size === 0 || boms.size === 0) {
    throw new Error('Workbook contains no production parts or BOM components; refusing to sync.')
  }

  const bomRows = Array.from(boms.entries()).flatMap(([parentPartNumber, components]) =>
    Array.from(components.entries()).map(([componentPartNumber, quantityPerAssy]) => ({
      parentPartNumber,
      componentPartNumber,
      quantityPerAssy,
    })),
  )
  const shifts = readShiftRows()
  const models = Array.from(new Set(blocks.map((block) => block.model)))

  await prisma.$transaction(async (tx) => {
    for (const part of parts.values()) {
      await tx.productionPart.upsert({
        where: { partNumber: part.partNumber },
        update: {
          line: part.line,
          type: part.type,
          process: part.process,
          models: Array.from(part.models),
          packaging: part.packaging,
          maxStore: part.maxStore,
          cycleTime: part.cycleTime,
        },
        create: {
          partNumber: part.partNumber,
          line: part.line,
          type: part.type,
          process: part.process,
          models: Array.from(part.models),
          packaging: part.packaging,
          maxStore: part.maxStore,
          cycleTime: part.cycleTime,
        },
      })
    }

    for (const part of stock.values()) {
      await tx.stockItem.upsert({
        where: { partNumber: part.partNumber },
        update: {
          description: part.description,
          category: part.category,
          packaging: part.packaging,
          maxStore: part.maxStore,
        },
        create: {
          partNumber: part.partNumber,
          description: part.description,
          category: part.category,
          packaging: part.packaging,
          maxStore: part.maxStore,
          safetyStock: part.safetyStock,
          store: part.store,
          buffer: 0,
          location: part.location,
          status: stockStatus(part.store, part.safetyStock, part.maxStore),
        },
      })
    }

    await tx.bomComponent.deleteMany({
      where: { parentPartNumber: { in: Array.from(parts.keys()) } },
    })
    await tx.bomComponent.createMany({ data: bomRows, skipDuplicates: true })

    for (const model of models) {
      await tx.productionModel.upsert({
        where: { code: model },
        update: { status: 'active' },
        create: { code: model, name: `Model ${model}`, status: 'active' },
      })
    }

    for (const shift of shifts) {
      await tx.shiftConfig.upsert({
        where: { name: shift.name },
        update: shift,
        create: shift,
      })
    }
  }, { timeout: 30000 })

  return bomRows
}

async function main() {
  const blocks = readComposition()
  const masterData = buildMasterData(blocks)
  const { parts, stock } = masterData

  if (process.argv.includes('--workbook-only')) {
    const bomRows = await syncWorkbookMasterData(blocks, masterData)
    console.log(
      `Workbook sync completed: ${blocks.length} Assy rows, ${parts.size} production parts, ${stock.size} stock items, ${bomRows.length} BOM rows.`,
    )
    return
  }

  const password = await bcrypt.hash('wpc123', 10)

  for (const user of users) {
    const existing = await prisma.user.findFirst({
      where: { OR: [{ employeeId: user.employeeId }, { username: user.username }] },
    })
    const data = {
      employeeId: user.employeeId,
      username: user.username,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: user.roleLabel,
      area: user.area,
      line: user.line,
      initials: user.initials,
    }
    if (existing) {
      await prisma.user.update({ where: { id: existing.id }, data })
    } else {
      await prisma.user.create({ data: { ...data, password, status: 'active' } })
    }
  }

  const processes = Array.from(
    new Set(
      blocks.flatMap((block) =>
        block.subAssemblies.map((sub) => sub.process),
      ),
    ),
  ).sort()

  const workAreas = [
    { id: 'Robot G:Assy:RB.G', label: 'Robot G · Assy', line: LINE, type: 'Assy', process: 'RB.G' },
    ...processes.map((process) => ({
      id: `Robot G:Sub_Assy:${process}`,
      label: `Robot G · ${process}`,
      line: LINE,
      type: 'Sub_Assy',
      process,
    })),
  ]

  for (const area of workAreas) {
    await prisma.workArea.upsert({
      where: { id: area.id },
      update: { label: area.label, line: area.line, type: area.type, process: area.process },
      create: area,
    })
  }

  const assyAreas = workAreas.filter((area) => area.type === 'Assy')
  const subAssyAreas = workAreas.filter((area) => area.type === 'Sub_Assy')
  const assignments: Record<string, typeof workAreas> = {
    OA001: assyAreas,
    OS001: subAssyAreas,
    OB001: [...assyAreas, ...subAssyAreas],
  }

  for (const [employeeId, areas] of Object.entries(assignments)) {
    const user = await prisma.user.findUnique({ where: { employeeId } })
    if (!user) continue
    await prisma.userWorkArea.deleteMany({ where: { userId: user.id } })
    await prisma.userWorkArea.createMany({
      data: areas.map((area) => ({ userId: user.id, workAreaId: area.id })),
      skipDuplicates: true,
    })
  }

  const bomRows = await syncWorkbookMasterData(blocks, masterData)

  for (const machine of machines) {
    await prisma.machine.upsert({
      where: { code: machine.code },
      update: machine,
      create: machine,
    })
  }

  for (const location of locations) {
    await prisma.inventoryLocation.upsert({
      where: { code: location.code },
      update: location,
      create: location,
    })
  }

  for (const config of kanbanConfigs) {
    await prisma.kanbanConfig.upsert({
      where: { type: config.type },
      update: config,
      create: config,
    })
  }

  if ((await prisma.device.count()) === 0) {
    await prisma.device.createMany({ data: devices })
  }

  for (const setting of settings) {
    await prisma.appSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value as object },
      create: { key: setting.key, value: setting.value as object },
    })
  }

  for (const block of blocks) {
    const steps = [
      ...block.subAssemblies
        .filter((sub) => sub.partNumber)
        .map((sub, index) => ({
          step: index + 1,
          process: `Sub Assy ${sub.process} (${sub.partNumber})`,
          machine: 'RB-G-WLD-SA',
          cycle: 0,
          status: 'active',
        })),
      {
        step: block.subAssemblies.filter((sub) => sub.partNumber).length + 1,
        process: 'Welding Assy',
        machine: 'RB-G-WLD-ASSY',
        cycle: 0,
        status: 'active',
      },
      {
        step: block.subAssemblies.filter((sub) => sub.partNumber).length + 2,
        process: 'Inspection',
        machine: 'QC-01',
        cycle: 0,
        status: 'active',
      },
    ]

    await prisma.routing.upsert({
      where: {
        partNumber_model_version: {
          partNumber: block.partNumber,
          model: block.model,
          version: '1.0',
        },
      },
      update: { steps, effectiveDate: new Date().toISOString().slice(0, 10) },
      create: {
        partNumber: block.partNumber,
        model: block.model,
        version: '1.0',
        effectiveDate: new Date().toISOString().slice(0, 10),
        steps,
      },
    })
  }

  const today = new Date().toISOString().slice(0, 10)
  await prisma.materialRequest.deleteMany({
    where: { note: 'Permintaan contoh hasil seed' },
  })
  const seededRequests = blocks.slice(0, 5).map((block, index) => ({
    code: `MR-${today.replaceAll('-', '')}-${String(index + 1).padStart(2, '0')}`,
    kind: 'request',
    partNumber: block.partNumber,
    boxes: 2,
    pcsPerBox: block.packaging ?? 1,
    destination: 'Line Assy',
    requester: 'Andri Setiawan',
    note: 'Permintaan contoh hasil seed',
  }))
  for (const request of seededRequests) {
    await prisma.materialRequest.create({ data: request })
  }

  const seedAudit = await prisma.auditLog.findFirst({ where: { title: 'Database WPC di-seed' } })
  if (!seedAudit) {
    await prisma.auditLog.create({
      data: {
        title: 'Database WPC di-seed',
        detail: `${parts.size} production part · ${stock.size} stock item · ${bomRows.length} komponen BOM`,
        type: 'system',
      },
    })
  }

  console.log(
    `Seed completed: ${blocks.length} model assy, ${parts.size} production parts, ${stock.size} stock items, ${bomRows.length} BOM rows.`,
  )
}

main()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
