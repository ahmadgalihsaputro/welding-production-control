import { CalendarClock, Clock3, Coffee, Sun, Timer } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Toggle } from '../../components/ui/Toggle'
import { shifts as initialShifts } from '../../data/mock'
import {
  readShiftConfigs,
  readWorkdays,
  saveShiftConfigs,
  saveWorkdays,
  shiftWorkMinutes,
  workingDays,
} from '../../data/productionPlanning'
import type { ShiftConfig } from '../../types'

function loadInitialShiftState(): { shifts: ShiftConfig[]; error: string } {
  try {
    return { shifts: readShiftConfigs(), error: '' }
  } catch (error) {
    return {
      shifts: initialShifts.map((shift) => ({ ...shift })),
      error: error instanceof Error ? error.message : 'Data shift gagal dibaca.',
    }
  }
}

function loadInitialWorkdayState(): { workdays: string[]; error: string } {
  try {
    return { workdays: readWorkdays(), error: '' }
  } catch (error) {
    return {
      workdays: [...workingDays.slice(0, 6)],
      error: error instanceof Error ? error.message : 'Data hari kerja gagal dibaca.',
    }
  }
}

export function ShiftsPage() {
  const [shiftState, setShiftState] = useState(loadInitialShiftState)
  const [workdayState, setWorkdayState] = useState(loadInitialWorkdayState)
  const workdays = workdayState.workdays
  const shifts = shiftState.shifts
  const availableMinutes = shifts
    .filter((shift) => shift.active)
    .reduce((sum, shift) => sum + shiftWorkMinutes(shift), 0)

  const updateShift = (id: string, updates: Partial<ShiftConfig>) => {
    const next = shifts.map((shift) => (shift.id === id ? { ...shift, ...updates } : shift))
    try {
      saveShiftConfigs(next)
      setShiftState({ shifts: next, error: '' })
    } catch (error) {
      setShiftState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Perubahan shift gagal disimpan.',
      }))
    }
  }

  const toggleDay = (day: string) => {
    const next = workdays.includes(day)
      ? workdays.filter((item) => item !== day)
      : [...workdays, day]
    try {
      saveWorkdays(next)
      setWorkdayState({ workdays: next, error: '' })
    } catch (error) {
      setWorkdayState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Perubahan hari kerja gagal disimpan.',
      }))
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Shift & Working Hours"
        subtitle="Atur jam kerja, operator, dan batas lembur untuk membantu Admin membagi beban permintaan produksi ke shift."
        meta={
          <span className="page-meta__item">
            <CalendarClock size={12} /> {new Date().toLocaleDateString('id-ID', {
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </span>
        }
      />

      {shiftState.error && (
        <Callout tone="danger" title="Konfigurasi shift bermasalah">
          {shiftState.error}
        </Callout>
      )}
      {workdayState.error && (
        <Callout tone="danger" title="Konfigurasi hari kerja bermasalah">
          {workdayState.error}
        </Callout>
      )}

      <div className="kpi-grid">
        <StatCard label="Shift aktif" value={String(shifts.filter((shift) => shift.active).length)} suffix="shift" icon={Timer} tone="orange" note="Berlaku untuk Robot G & H" />
        <StatCard label="Jam tersedia / hari" value={(availableMinutes / 60).toFixed(1)} suffix="jam" icon={Clock3} tone="sky" note="Termasuk batas lembur" />
        <StatCard label="Hari kerja" value={String(workdays.length)} suffix="hari" icon={Sun} tone="green" note="Senin–Sabtu" />
        <StatCard label="Shift terkonfigurasi" value={String(shifts.length)} suffix="shift" icon={Coffee} tone="amber" note="Shift 1 & Shift 2" />
      </div>

      <div className="device-grid">
        {shifts.map((shift) => (
          <div className="device-card" key={shift.id}>
            <div className="device-card__top">
              <span className="device-card__icon">
                <Clock3 size={16} />
              </span>
              <Toggle
                checked={shift.active}
                onChange={() => updateShift(shift.id, { active: !shift.active })}
                label={`Aktifkan ${shift.name}`}
              />
            </div>
            <h3>{shift.name}</h3>
            <p>{shift.active ? 'Beroperasi hari ini' : 'Tidak digunakan'}</p>

            <div className="shift-config-grid" style={{ marginTop: 11 }}>
              <div className="shift-config-item">
                <span>Jam kerja</span>
                <div className="shift-time-range">
                  <input
                    className="input"
                    type="time"
                    aria-label={`${shift.name} mulai`}
                    value={shift.start}
                    onChange={(event) => {
                      if (event.target.value) updateShift(shift.id, { start: event.target.value })
                    }}
                  />
                  <span aria-hidden="true">—</span>
                  <input
                    className="input"
                    type="time"
                    aria-label={`${shift.name} selesai`}
                    value={shift.end}
                    onChange={(event) => {
                      if (event.target.value) updateShift(shift.id, { end: event.target.value })
                    }}
                  />
                </div>
              </div>
              <div className="shift-config-item">
                <span>Istirahat</span>
                <div className="shift-time-range">
                  <input
                    className="input"
                    type="time"
                    aria-label={`${shift.name} mulai istirahat`}
                    value={shift.breakStart}
                    onChange={(event) => {
                      if (event.target.value) updateShift(shift.id, { breakStart: event.target.value })
                    }}
                  />
                  <span aria-hidden="true">—</span>
                  <input
                    className="input"
                    type="time"
                    aria-label={`${shift.name} selesai istirahat`}
                    value={shift.breakEnd}
                    onChange={(event) => {
                      if (event.target.value) updateShift(shift.id, { breakEnd: event.target.value })
                    }}
                  />
                </div>
              </div>
              <div className="shift-config-item">
                <label htmlFor={`${shift.id}-operators`}>Jumlah operator</label>
                <input
                  id={`${shift.id}-operators`}
                  className="input"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="Belum diatur"
                  value={shift.operatorCount ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    const operatorCount = value === '' ? undefined : Number(value)
                    if (operatorCount === undefined || Number.isInteger(operatorCount) && operatorCount > 0) {
                      updateShift(shift.id, { operatorCount })
                    }
                  }}
                />
              </div>
              <div className="shift-config-item">
                <label htmlFor={`${shift.id}-overtime`}>Batas lembur (opsional, menit)</label>
                <input
                  id={`${shift.id}-overtime`}
                  className="input"
                  type="number"
                  min="0"
                  step="15"
                  placeholder="Tidak ditetapkan"
                  value={shift.maxOvertimeMinutes ?? ''}
                  onChange={(event) => {
                    const value = event.target.value
                    const maxOvertimeMinutes = value === '' ? undefined : Number(value)
                    if (maxOvertimeMinutes === undefined || Number.isInteger(maxOvertimeMinutes) && maxOvertimeMinutes >= 0) {
                      updateShift(shift.id, { maxOvertimeMinutes })
                    }
                  }}
                />
              </div>
            </div>

            <div className="device-card__foot">
              <span>
                {shift.active
                  ? `${(shiftWorkMinutes(shift) / 60).toFixed(1)} jam tersedia · ${shift.operatorCount ?? 'Operator belum diatur'}`
                  : 'Target tidak dialokasikan'}
              </span>
              <Badge tone={shift.active ? 'success' : 'neutral'}>
                {shift.active ? 'Active' : 'Inactive'}
              </Badge>
            </div>
          </div>
        ))}
      </div>

      <div className="report-split">
        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Hari kerja</h2>
              <p className="section-sub">Pilih hari operasional produksi</p>
            </div>
            <Badge tone="neutral">{workdays.length} hari</Badge>
          </div>
          <div className="form-grid">
            {workingDays.map((day) => (
              <label key={day} className="switch-row" style={{ cursor: 'pointer' }}>
                <div className="switch-copy">
                  <strong>{day}</strong>
                  <span>{workdays.includes(day) ? 'Hari kerja' : 'Hari libur'}</span>
                </div>
                <Toggle
                  checked={workdays.includes(day)}
                  onChange={() => toggleDay(day)}
                  label={`Atur ${day}`}
                />
              </label>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Dasar alokasi permintaan</h2>
                <p className="section-sub">Beban kerja memakai cycle time aktual</p>
              </div>
            </div>
            <Callout tone="info">
              Aplikasi tidak memakai rasio target asumsi. Admin membagi permintaan berdasarkan
              estimasi cycle time per pcs dan waktu tersedia pada proses/sumber daya masing-masing.
            </Callout>
          </section>

          <Callout tone="info" title="Aturan shift pada prototipe">
            Shift aktif mengikuti jam lokal perangkat dan hari kerja yang dipilih. Jam istirahat serta
            hari libur dianggap di luar shift; waktu setelah tengah malam pada shift malam mengikuti
            hari mulai shift. Input produksi dan aksi antrean dinonaktifkan di luar shift aktif.
          </Callout>

          <Callout tone="warning" title="Perubahan jam kerja">
            Mengubah jam shift akan memengaruhi perhitungan downtime dan achievement. Lakukan
            hanya saat pergantian hari produksi.
          </Callout>
        </div>
      </div>
    </div>
  )
}
