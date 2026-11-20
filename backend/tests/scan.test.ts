import assert from 'node:assert/strict'
import { test } from 'node:test'

process.env.DATABASE_URL ??= 'postgresql://postgres:postgres@localhost:5432/wpc?schema=public'

const { splitScanCode, getKanbanPartType } = await import('../src/lib/scan.js')

test('prefix pairing code dipisahkan dari barcode', () => {
  assert.deepEqual(splitScanCode('SCN-DEMO001|4650C745'), {
    deviceCode: 'SCN-DEMO001',
    code: '4650C745',
  })
  assert.deepEqual(splitScanCode('  SCN-DEMO001 | 4650C745 '), {
    deviceCode: 'SCN-DEMO001',
    code: '4650C745',
  })
})

test('barcode tanpa prefix tetap diterima', () => {
  assert.deepEqual(splitScanCode(' 4650C745 '), { code: '4650C745' })
  assert.deepEqual(splitScanCode('scn-demo001|4650C745'), { code: 'scn-demo001|4650C745' })
})

test('jenis part dibaca hanya dari payload kanban', () => {
  assert.equal(getKanbanPartType(JSON.stringify({ partType: 'Assy' })), 'Assy')
  assert.equal(getKanbanPartType(JSON.stringify({ partType: 'Sub_Assy' })), 'Sub_Assy')
  assert.equal(getKanbanPartType('4650C745'), null)
  assert.equal(getKanbanPartType(JSON.stringify({ partType: 'Bolt' })), null)
})
