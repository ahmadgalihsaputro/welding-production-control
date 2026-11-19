import {
  CalendarDays,
  Clock3,
  Factory,
  Hourglass,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Target,
  Trash2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { describeApiError } from '../../lib/api'
import { listParts } from '../../lib/masterApi'
import {
  createSchedule,
  deleteSchedule,
  listSchedules,
  type ScheduleInput,
} from '../../lib/productionApi'
import type { ScheduleItem } from '../../types'
import { formatNumber } from '../../lib/utils'

const emptyForm: ScheduleInput = {
  partNumber: '',
  model: '',
  target: 100,
  shift: 1,
  dueTime: '09:00',
  line: 'Robot G',
}

export function SchedulePage() {
  const navigate = useNavigate()
  const { user, activeLine } = useAuth()
  const { confirm } = useConfirmation()
  const { t, formatDate, formatTime } = usePreferences()
  const isAdmin = user?.role === 'admin'
  const isReadOnly = isAdmin || user?.role === 'management'

  const [items, setItems] = useState<ScheduleItem[]>([])
  const [partNumbers, setPartNumbers] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [lines, setLines] = useState<string[]>([])
  const [shift, setShift] = useState('all')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ScheduleInput>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [schedules, parts] = await Promise.all([
        listSchedules({ line: activeLine }),
        listParts({ type: 'Assy' }),
      ])
      setItems(schedules)
      setPartNumbers(Array.from(new Set(parts.map((part) => part.partNumber))).sort())
      setModels(Array.from(new Set(parts.flatMap((part) => part.models))).sort())
      setLines(
        Array.from(
          new Set([
            ...parts.map((part) => part.line),
            ...(activeLine !== 'all' ? [activeLine] : []),
          ]),
        ).sort(),
      )
      setForm((current) => ({ ...current, line: activeLine !== 'all' ? activeLine : current.line }))
    } catch (loadError) {
      setError(describeApiError(loadError, t('Jadwal gagal dimuat dari database.', 'Schedule failed to load from the database.')))
    } finally {
      setLoading(false)
    }
  }, [activeLine, t])

  useEffect(() => {
    void load()
  }, [load])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return items.filter((item) => {
      const matchShift = shift === 'all' || item.shift === Number(shift)
      const matchSearch =
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.model.toLowerCase().includes(needle)
      return matchShift && matchSearch
    })
  }, [items, shift, search])

  const totalTarget = items.reduce((sum, item) => sum + item.target, 0)
  const totalActual = items.reduce((sum, item) => sum + item.actual, 0)
  const running = items.filter((item) => item.status === 'running').length
  const lastSync = items.reduce<string | null>(
    (latest, item) => (!latest || (item.updatedAt ?? '') > latest ? item.updatedAt ?? latest : latest),
    null,
  )
  const lineLabel = activeLine === 'all' ? t('Semua line', 'All Lines') : activeLine

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!form.partNumber.trim() || !form.model.trim() || form.target <= 0 || !form.dueTime) {
      setError(t('Lengkapi part number, model, target, dan jam jatuh tempo.', 'Fill in part number, model, target, and due time.'))
      return
    }
    setSaving(true)
    setError('')
    setNotice('')
    try {
      await createSchedule({
        ...form,
        partNumber: form.partNumber.trim().toUpperCase(),
        model: form.model.trim(),
      })
      setForm(emptyForm)
      setShowForm(false)
      setNotice(t('Jadwal berhasil disimpan ke database.', 'Schedule saved to the database.'))
      await load()
    } catch (saveError) {
      setError(describeApiError(saveError, t('Jadwal gagal disimpan.', 'Failed to save schedule.')))
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (item: ScheduleItem) => {
    const confirmed = await confirm({
      title: t('Hapus jadwal ini?', 'Delete this schedule?'),
      message: `${item.partNumber} · ${t('Shift', 'Shift')} ${item.shift} ${t('akan dihapus permanen dari database.', 'will be permanently deleted from the database.')}`,
      confirmLabel: t('Hapus jadwal', 'Delete schedule'),
      tone: 'danger',
    })
    if (!confirmed) return
    setDeletingId(item.id)
    setError('')
    setNotice('')
    try {
      await deleteSchedule(item.id)
      setNotice(t('Jadwal dihapus dari database.', 'Schedule deleted from the database.'))
      await load()
    } catch (deleteError) {
      setError(describeApiError(deleteError, t('Jadwal gagal dihapus.', 'Failed to delete schedule.')))
    } finally {
      setDeletingId(null)
    }
  }

  const columns: Column<ScheduleItem>[] = [
    {
      key: 'part',
      header: t('Part Number / Model', 'Part Number / Model'),
      render: (item) => (
        <div className="cell-stack">
          <span className="cell-main">{item.partNumber}</span>
          <span className="cell-sub">
            {item.model} · {item.line}
          </span>
        </div>
      ),
    },
    {
      key: 'shift',
      header: t('Shift', 'Shift'),
      render: (item) => <Badge tone="neutral">Shift {item.shift}</Badge>,
    },
    {
      key: 'target',
      header: t('Target', 'Target'),
      align: 'right',
      render: (item) => <span className="mono">{formatNumber(item.target)} pcs</span>,
    },
    {
      key: 'actual',
      header: t('Actual', 'Actual'),
      align: 'right',
      render: (item) => <span className="mono strong">{formatNumber(item.actual)} pcs</span>,
    },
    {
      key: 'progress',
      header: t('Progress', 'Progress'),
      render: (item) => {
        const percent = item.target > 0 ? (item.actual / item.target) * 100 : 0
        return (
          <div style={{ minWidth: 124 }}>
            <ProgressBar
              value={percent}
              tone={item.status === 'complete' ? 'green' : 'gradient'}
              thin
            />
            <div className="progress-meta" style={{ marginTop: 4 }}>
              <span>{percent.toFixed(1).replace('.', ',')}%</span>
              <span>{Math.max(item.target - item.actual, 0)} {t('sisa', 'remaining')}</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'due',
      header: t('Due', 'Due'),
      render: (item) => (
        <span className="row" style={{ gap: 5 }}>
          <Clock3 size={12} className="muted" /> {item.dueTime}
        </span>
      ),
    },
    {
      key: 'status',
      header: t('Status', 'Status'),
      render: (item) => <StatusBadge status={item.status} />,
    },
  ]
  if (!isReadOnly) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: (item) => (
        <div className="table-actions">
          <button
            type="button"
            className="btn-icon"
            aria-label={`${t('Jalankan', 'Run')} ${item.partNumber}`}
            onClick={() => navigate(`/production/assy?job=${encodeURIComponent(item.id)}`)}
          >
            <Play size={14} />
          </button>
          <button
            type="button"
            className="btn-icon"
            aria-label={`${t('Hapus', 'Delete')} ${item.partNumber}`}
            disabled={deletingId === item.id}
            onClick={() => void handleDelete(item)}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    })
  }

  return (
    <div className="page" aria-busy={loading}>
      <PageHeader
        eyebrow={t('Production Control', 'Production Control')}
        title={t('Jadwal Produksi Assy', 'Assy Production Schedule')}
        subtitle={t(
          `Jadwal Assy dari database untuk ${lineLabel}. Perubahan pada halaman ini langsung tersimpan dan dipakai bersama dashboard serta produksi Assy.`,
          `Assy schedule from the database for ${lineLabel}. Changes on this page are saved immediately and shared with the dashboard and Assy production.`,
        )}
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> {formatDate(new Date())}
            </span>
            <span className="page-meta__item">
              <RefreshCw size={12} /> {lastSync ? `${t('Diperbarui', 'Updated')} ${formatTime(lastSync)}` : t('Belum ada data', 'No data yet')}
            </span>
            <span className="page-meta__item">
              <Factory size={12} /> {lineLabel}
            </span>
          </>
        }
        actions={
          !isReadOnly && (
            <>
              <Button
                variant="secondary"
                leftIcon={<RefreshCw size={15} />}
                loading={loading}
                onClick={() => void load()}
              >
                {t('Muat ulang', 'Reload')}
              </Button>
              <Button
                variant="primary"
                leftIcon={<Plus size={15} />}
                onClick={() => setShowForm((value) => !value)}
              >
                {t('Tambah urutan', 'Add Sequence')}
              </Button>
            </>
          )
        }
      />

      {isReadOnly && (
        <Callout tone="info" title={t('Akses pemantauan saja', 'Monitoring Access Only')}>
          {t(
            'Jadwal dan progres dapat dilihat, tetapi role ini tidak dapat menambah, menghapus, atau memulai pekerjaan dari halaman ini.',
            'Schedules and progress can be viewed, but this role cannot add, delete, or start jobs from this page.',
          )}
        </Callout>
      )}
      {loading && <Callout tone="info">{t('Memuat jadwal dari database…', 'Loading schedules from the database...')}</Callout>}
      {error && <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}

      {showForm && !isReadOnly && (
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>{t('Tambah urutan jadwal', 'Add schedule sequence')}</h3>
            <p>{t('Data baru langsung disimpan ke tabel ScheduleItem database.', 'New data is saved directly to the database ScheduleItem table.')}</p>
          </div>
          <form onSubmit={(event) => void handleCreate(event)}>
            <div className="form-grid">
              <Field label={t('Part Number', 'Part Number')} htmlFor="schedule-part">
                <input
                  id="schedule-part"
                  className="input"
                  list="schedule-part-options"
                  value={form.partNumber}
                  onChange={(event) => setForm({ ...form, partNumber: event.target.value })}
                  required
                />
                <datalist id="schedule-part-options">
                  {partNumbers.map((partNumber) => <option key={partNumber} value={partNumber} />)}
                </datalist>
              </Field>
              <Field label={t('Model', 'Model')} htmlFor="schedule-model">
                <input
                  id="schedule-model"
                  className="input"
                  list="schedule-model-options"
                  value={form.model}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  required
                />
                <datalist id="schedule-model-options">
                  {models.map((model) => <option key={model} value={model} />)}
                </datalist>
              </Field>
              <Field label={t('Target', 'Target')} htmlFor="schedule-target">
                <input
                  id="schedule-target"
                  className="input"
                  type="number"
                  min={1}
                  value={form.target}
                  onChange={(event) => setForm({ ...form, target: Number(event.target.value) || 0 })}
                  required
                />
              </Field>
              <Field label={t('Shift', 'Shift')} htmlFor="schedule-shift">
                <select
                  id="schedule-shift"
                  className="select"
                  value={form.shift}
                  onChange={(event) => setForm({ ...form, shift: Number(event.target.value) as 1 | 2 })}
                >
                  <option value={1}>Shift 1</option>
                  <option value={2}>Shift 2</option>
                </select>
              </Field>
              <Field label={t('Jam jatuh tempo', 'Due time')} htmlFor="schedule-due">
                <input
                  id="schedule-due"
                  className="input"
                  type="time"
                  value={form.dueTime}
                  onChange={(event) => setForm({ ...form, dueTime: event.target.value })}
                  required
                />
              </Field>
              <Field label={t('Line', 'Line')} htmlFor="schedule-line">
                <select
                  id="schedule-line"
                  className="select"
                  value={form.line}
                  onChange={(event) => setForm({ ...form, line: event.target.value })}
                >
                  {lines.map((line) => <option key={line} value={line}>{line}</option>)}
                </select>
              </Field>
            </div>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={() => setShowForm(false)} disabled={saving}>
                {t('Batalkan', 'Cancel')}
              </Button>
              <Button type="submit" variant="primary" loading={saving}>
                {t('Simpan jadwal', 'Save schedule')}
              </Button>
            </div>
          </form>
        </section>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label={t('Total target', 'Total Target')}
          value={formatNumber(totalTarget)}
          suffix="pcs"
          icon={Target}
          tone="orange"
          note={`${items.length} ${t('jadwal', 'schedules')} · ${lineLabel}`}
        />
        <StatCard
          label={t('Actual terakumulasi', 'Accumulated Actual')}
          value={formatNumber(totalActual)}
          suffix="pcs"
          icon={PackageCheck}
          tone="sky"
          note={t('dari database', 'from database')}
        />
        <StatCard
          label={t('Sisa target', 'Remaining Target')}
          value={formatNumber(totalTarget - totalActual)}
          suffix="pcs"
          icon={Hourglass}
          tone="amber"
          note={`${running} ${t('pekerjaan running', 'running jobs')}`}
        />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs
              items={[
                { value: 'all', label: t('Semua shift', 'All Shifts') },
                { value: '1', label: 'Shift 1' },
                { value: '2', label: 'Shift 2' },
              ]}
              value={shift}
              onChange={setShift}
              ariaLabel={t('Filter shift', 'Shift filter')}
            />
            <Badge tone="sky" dot>
              {t('Sumber: database', 'Source: database')}
            </Badge>
          </div>
          <div className="toolbar-group">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('Cari PN atau model…', 'Search PN or model…')}
              className="search-inline"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={900}
          emptyMessage={t(
            'Belum ada jadwal untuk line ini. Tambahkan urutan atau muat ulang setelah database di-seed.',
            'No schedules for this line yet. Add a sequence or reload after the database is seeded.',
          )}
          footer={
            <>
              <span>{t('Menampilkan', 'Showing')} <strong>{rows.length}</strong> {t('dari', 'of')} <strong>{items.length}</strong> {t('jadwal database', 'database schedules')}</span>
              <span>{lastSync ? `${t('Diperbarui', 'Updated')} ${formatTime(lastSync)}` : '—'}</span>
            </>
          }
        />
      </section>

      <Callout tone="warning" title={t('Urutan aktual vs jadwal sumber', 'Actual Order vs Source Schedule')}>
        {t(
          'Jika kondisi jig atau mesin mengharuskan perubahan urutan, Leader dapat menyesuaikan urutan aktual. Data jadwal di database tetap menjadi acuan, dan setiap perubahan tercatat pada data produksi.',
          'If jig or machine conditions require a change in order, the Leader can adjust the actual order. Database schedules remain the reference, and changes are recorded in production data.',
        )}
      </Callout>
    </div>
  )
}
