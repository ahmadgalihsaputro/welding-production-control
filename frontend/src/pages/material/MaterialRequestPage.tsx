import {
  Boxes,
  ClipboardList,
  FileText,
  PackagePlus,
  Printer,
  ScanBarcode,
  Send,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { materialRequests as initialRequests } from '../../data/mock'
import type { MaterialRequest } from '../../types'
import { formatNumber } from '../../lib/utils'
import { useAuth } from '../../contexts/AuthContext'

const nextStatus: Record<MaterialRequest['status'], MaterialRequest['status']> = {
  waiting: 'prepared',
  prepared: 'picked',
  picked: 'complete',
  complete: 'complete',
}

const nextLabel: Record<MaterialRequest['status'], string> = {
  waiting: 'Tandai disiapkan',
  prepared: 'Tandai diambil',
  picked: 'Selesaikan',
  complete: 'Selesai',
}

export function MaterialRequestPage() {
  const { user } = useAuth()
  const isAdmin = user?.role === 'admin'
  const [requests, setRequests] = useState(initialRequests)
  const [selectedId, setSelectedId] = useState(initialRequests[0].id)
  const [search, setSearch] = useState('')
  const [message, setMessage] = useState('')

  const selected = requests.find((item) => item.id === selectedId) ?? requests[0]
  const totalBoxes = requests.reduce((sum, item) => sum + item.boxes, 0)
  const waiting = requests.filter((item) => item.status === 'waiting').length
  const complete = requests.filter((item) => item.status === 'complete').length

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return requests.filter(
      (item) =>
        !needle ||
        item.code.toLowerCase().includes(needle) ||
        item.partNumber.toLowerCase().includes(needle),
    )
  }, [requests, search])

  const advance = () => {
    if (isAdmin) {
      setMessage('Admin hanya dapat memantau; perubahan status dilakukan Leader.')
      return
    }
    setRequests((current) =>
      current.map((item) =>
        item.id === selected.id ? { ...item, status: nextStatus[item.status] } : item,
      ),
    )
    setMessage(`Status ${selected.code} diperbarui menjadi ${nextStatus[selected.status]}.`)
  }

  const createKanban = () => {
    if (isAdmin) {
      setMessage('Admin hanya dapat memantau; pencetakan Kanban Belanja dilakukan Leader.')
      return
    }
    setMessage(`Kanban Belanja untuk ${selected.partNumber} siap dicetak.`)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title="Permintaan Material"
        subtitle="Buat dan pantau Kanban Belanja berdasarkan kebutuhan aktual Area Assy. Jumlah box dihitung dari standard packaging setiap part number."
        meta={
          <>
            <span className="page-meta__item">
              <ClipboardList size={12} /> {requests.length} request
            </span>
            <span className="page-meta__item">
              <ScanBarcode size={12} /> Kanban Belanja
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<Printer size={15} />} onClick={createKanban} disabled={isAdmin}>
              Cetak Kanban
            </Button>
            <Button variant="primary" leftIcon={<PackagePlus size={15} />} onClick={createKanban} disabled={isAdmin}>
              Buat permintaan
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label="Request aktif"
          value={String(requests.length)}
          suffix="request"
          icon={ClipboardList}
          tone="orange"
          note={`${waiting} menunggu Supply`}
        />
        <StatCard
          label="Total box diminta"
          value={String(totalBoxes)}
          suffix="box"
          icon={Boxes}
          tone="sky"
          note="Seluruh request hari ini"
        />
        <StatCard
          label="Selesai"
          value={String(complete)}
          suffix="request"
          icon={FileText}
          tone="green"
          note="Sudah diterima produksi"
        />
      </div>

      <div className="material-split">
        <section className="card">
          <div className="table-toolbar">
            <div>
              <h2 className="section-title">Daftar permintaan</h2>
              <p className="section-sub">Pilih request untuk melihat detail Kanban</p>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cari kode / PN…"
              className="search-inline"
            />
          </div>

          <div className="stack-sm">
            {rows.map((request) => (
              <button
                key={request.id}
                type="button"
                className={`request-item${request.id === selected.id ? ' is-active' : ''}`}
                onClick={() => setSelectedId(request.id)}
              >
                <div className="request-item__icon">
                  <Boxes size={17} />
                </div>
                <div className="grow">
                  <div className="row row--between">
                    <span className="cell-main">{request.code}</span>
                    <StatusBadge status={request.status} />
                  </div>
                  <div className="row row--between" style={{ marginTop: 3 }}>
                    <span className="tiny muted">
                      {request.partNumber} · {request.boxes} box · {request.createdAt}
                    </span>
                    <span className="tiny muted">{request.requester}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="table-footer">
            <span>
              Total <strong>{totalBoxes}</strong> box dari {requests.length} request
            </span>
            <span>Robot G · Area Assy</span>
          </div>
        </section>

        <div className="stack">
          <section className="card material-request-card">
            <div className="row row--between">
              <span className="request-code">
                <ClipboardList size={13} /> {selected.code}
              </span>
              <StatusBadge status={selected.status} />
            </div>

            <h2 className="job-number" style={{ marginTop: 10 }}>
              {selected.partNumber}
            </h2>
            <p className="job-model">Sub Assy · Tujuan {selected.destination}</p>

            <div className="request-boxes">
              <strong>{selected.boxes}</strong>
              <span>boxes</span>
            </div>
            <p className="small muted">
              Standard {selected.pcsPerBox} pcs/box · Total{' '}
              {formatNumber(selected.boxes * selected.pcsPerBox)} pcs
            </p>

            <div className="info-grid" style={{ marginTop: 16 }}>
              <div className="info-item">
                <span className="info-label">Dibuat oleh</span>
                <span className="info-value info-value--strong">{selected.requester}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Waktu dibuat</span>
                <span className="info-value info-value--strong">{selected.createdAt}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Tujuan</span>
                <span className="info-value">{selected.destination}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">{selected.status}</span>
              </div>
            </div>

            <div className="form-actions">
              <Button variant="secondary" leftIcon={<Printer size={14} />} onClick={createKanban} disabled={isAdmin}>
                Cetak
              </Button>
              <Button
                variant="primary"
                leftIcon={<Send size={14} />}
                onClick={advance}
                disabled={selected.status === 'complete' || isAdmin}
              >
                {nextLabel[selected.status]}
              </Button>
            </div>
          </section>

          <section className="card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Preview Kanban Belanja</h2>
                <p className="section-sub">Template 80 × 100 mm</p>
              </div>
              <Badge tone="warning">Supply</Badge>
            </div>

            <div className="kanban-preview">
              <div className="kanban-preview__head">
                <strong>WPC · KANBAN BELANJA</strong>
                <span>{selected.code}</span>
              </div>
              <h3>{selected.partNumber}</h3>
              <p>Sub Assy Bolt Bracket · Robot G</p>
              <div className="kanban-meta">
                <div>
                  <span>Boxes</span>
                  <strong>{selected.boxes}</strong>
                </div>
                <div>
                  <span>Qty / box</span>
                  <strong>{selected.pcsPerBox} pcs</strong>
                </div>
                <div>
                  <span>Destination</span>
                  <strong>Area Assy</strong>
                </div>
                <div>
                  <span>Created</span>
                  <strong>{selected.createdAt}</strong>
                </div>
              </div>
              <div className="barcode" />
            </div>
          </section>
        </div>
      </div>

      <Callout tone="info" title="Perhitungan box">
        Kebutuhan box dihitung dari kebutuhan aktual Area Assy dibagi standard packaging PN.
        Jika terjadi pembulatan, konfirmasi jumlah box ke Leader sebelum Kanban dicetak.
      </Callout>
    </div>
  )
}
