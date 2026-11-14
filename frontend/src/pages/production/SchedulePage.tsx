import {
  CalendarDays,
  Clock3,
  Factory,
  Hourglass,
  MoreHorizontal,
  PackageCheck,
  Play,
  Plus,
  RefreshCw,
  Target,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { useAuth } from '../../contexts/AuthContext'
import { scheduleItems } from '../../data/mock'
import type { ScheduleItem } from '../../types'
import { formatNumber } from '../../lib/utils'

const shiftTabs = [
  { value: 'all', label: 'Semua shift' },
  { value: '1', label: 'Shift 1' },
  { value: '2', label: 'Shift 2' },
]

export function SchedulePage() {
  const navigate = useNavigate()
  const { user, activeLine } = useAuth()
  const isAdmin = user?.role === 'admin'
  const isReadOnly = isAdmin || user?.role === 'management'
  const [shift, setShift] = useState('all')
  const [search, setSearch] = useState('')
  const [synced, setSynced] = useState(false)
  const lineRows = useMemo(
    () => scheduleItems.filter((item) => activeLine === 'all' || item.line === activeLine),
    [activeLine],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return lineRows.filter((item) => {
    const matchShift = shift === 'all' || item.shift === Number(shift)
      const matchSearch =
        !needle ||
        item.partNumber.toLowerCase().includes(needle) ||
        item.model.toLowerCase().includes(needle)
      return matchShift && matchSearch
    })
  }, [shift, search, lineRows])

  const totalTarget = lineRows.reduce((sum, item) => sum + item.target, 0)
  const totalActual = lineRows.reduce((sum, item) => sum + item.actual, 0)
  const running = lineRows.filter((item) => item.status === 'running').length

  const columns: Column<ScheduleItem>[] = [
    {
      key: 'part',
      header: 'Part Number / Model',
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
      header: 'Shift',
      render: (item) => <Badge tone="neutral">Shift {item.shift}</Badge>,
    },
    {
      key: 'target',
      header: 'Target',
      align: 'right',
      render: (item) => <span className="mono">{formatNumber(item.target)} pcs</span>,
    },
    {
      key: 'actual',
      header: 'Actual',
      align: 'right',
      render: (item) => <span className="mono strong">{formatNumber(item.actual)} pcs</span>,
    },
    {
      key: 'progress',
      header: 'Progress',
      render: (item) => {
        const percent = (item.actual / item.target) * 100
        return (
          <div style={{ minWidth: 124 }}>
            <ProgressBar
              value={percent}
              tone={item.status === 'complete' ? 'green' : 'gradient'}
              thin
            />
            <div className="progress-meta" style={{ marginTop: 4 }}>
              <span>{percent.toFixed(1).replace('.', ',')}%</span>
              <span>{Math.max(item.target - item.actual, 0)} sisa</span>
            </div>
          </div>
        )
      },
    },
    {
      key: 'due',
      header: 'Due',
      render: (item) => (
        <span className="row" style={{ gap: 5 }}>
          <Clock3 size={12} className="muted" /> {item.dueTime}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (item) => <StatusBadge status={item.status} />,
    },
  ]
  if (!isReadOnly) {
    columns.push({
      key: 'actions',
      header: '',
      align: 'right',
      render: () => (
        <div className="table-actions">
          <button
            type="button"
            className="btn-icon"
            aria-label="Mulai pekerjaan"
            onClick={() => navigate('/production/assy')}
          >
            <Play size={14} />
          </button>
          <button type="button" className="btn-icon" aria-label="Aksi lain">
            <MoreHorizontal size={15} />
          </button>
        </div>
      ),
    })
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Production Control"
        title="Jadwal Produksi Assy"
        subtitle={`Jadwal dari FSS untuk ${activeLine === 'all' ? 'semua line' : activeLine}. Urutan sumber tetap menjadi acuan, sedangkan urutan aktual dapat disesuaikan Leader dengan catatan alasan.`}
        meta={
          <>
            <span className="page-meta__item">
              <CalendarDays size={12} /> 12 November 2026
            </span>
            <span className="page-meta__item">
              <RefreshCw size={12} /> Last sync 07:00
            </span>
            <span className="page-meta__item">
              <Factory size={12} /> {activeLine === 'all' ? 'Semua line' : activeLine}
            </span>
          </>
        }
        actions={!isReadOnly && (
          <>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={15} />}
              onClick={() => setSynced(true)}
            >
              Sync FSS
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />}>
              Tambah urutan
            </Button>
          </>
        )}
      />

      {isReadOnly && (
        <Callout tone="info" title="Akses pemantauan saja">
          Jadwal dan progres dapat dilihat, tetapi role ini tidak dapat memulai pekerjaan atau
          mengubah urutan produksi dari halaman ini.
        </Callout>
      )}

      {synced && (
        <Callout tone="success" title="Sinkronisasi berhasil">
          Jadwal terbaru sudah diterima dari FSS.
        </Callout>
      )}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Total target"
          value={formatNumber(totalTarget)}
          suffix="pcs"
          icon={Target}
          tone="orange"
          note="Assy · Shift 1 & 2"
        />
        <StatCard
          label="Actual hari ini"
          value={formatNumber(totalActual)}
          suffix="pcs"
          icon={PackageCheck}
          tone="sky"
          trend={{ label: '+8,2%', direction: 'up' }}
          note="vs kemarin"
        />
        <StatCard
          label="Sisa target"
          value={formatNumber(totalTarget - totalActual)}
          suffix="pcs"
          icon={Hourglass}
          tone="amber"
          note={`${running} pekerjaan running`}
        />
      </div>

      <section className="card">
        <div className="table-toolbar">
          <div className="toolbar-group">
            <Tabs
              items={shiftTabs}
              value={shift}
              onChange={setShift}
              ariaLabel="Filter shift"
            />
            <Badge tone="sky" dot>
              Sumber: FSS
            </Badge>
          </div>
          <div className="toolbar-group">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari PN atau model…"
              className="search-inline"
            />
          </div>
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          minWidth={900}
          footer={
            <>
              <span>Menampilkan <strong>{rows.length}</strong> jadwal untuk line terpilih</span>
              <span>FSS · 12 Nov 2026 07:00</span>
            </>
          }
        />
      </section>

      <Callout tone="warning" title="Urutan aktual vs jadwal sumber">
        Jika kondisi jig atau mesin mengharuskan perubahan urutan, Leader dapat menyesuaikan
        urutan aktual. Data jadwal dari FSS tidak diubah, dan setiap perubahan wajib menyimpan
        alasan serta siapa yang mengubahnya.
      </Callout>
    </div>
  )
}
