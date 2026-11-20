import assert from 'node:assert/strict'
import { test } from 'node:test'
import { currentUserShift, jakartaDateKey } from '../src/lib/userShift.js'

test('tanggal memakai hari Jakarta, bukan UTC', () => {
  assert.equal(jakartaDateKey(new Date('2026-01-01T17:30:00.000Z')), '2026-01-02')
  assert.equal(jakartaDateKey(new Date('2026-01-01T16:30:00.000Z')), '2026-01-01')
})

test('shift bergilir tiap minggu dari tanggal anchor', () => {
  const user = {
    shiftMode: 'rotating',
    shiftBase: 1,
    shiftAnchorDate: new Date('2026-01-05T00:00:00.000Z'),
  }
  assert.equal(currentUserShift(user, new Date('2026-01-05T04:00:00.000Z')), 1)
  assert.equal(currentUserShift(user, new Date('2026-01-12T04:00:00.000Z')), 2)
  assert.equal(currentUserShift(user, new Date('2026-01-19T04:00:00.000Z')), 1)
  assert.equal(
    currentUserShift({ ...user, shiftMode: 'static' }, new Date('2026-01-12T04:00:00.000Z')),
    null,
  )
})
