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
import { usePreferences } from '../../contexts/PreferencesContext'

const nextStatus: Record<MaterialRequest['status'], MaterialRequest['status']> = {
  waiting: 'prepared',
  prepared: 'picked',
  picked: 'complete',
  complete: 'complete',
}

export function MaterialRequestPage() {
  const { t } = usePreferences()
  const { user } = useAuth()
  const nextLabel: Record<MaterialRequest['status'], string> = {
    waiting: t('Tandai disiapkan', 'Mark as prepared'),
    prepared: t('Tandai diambil', 'Mark as picked'),
    picked: t('Selesaikan', 'Complete'),
    complete: t('Selesai', 'Completed'),
  }
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
      setMessage(t('Admin hanya dapat memantau; perubahan status dilakukan Leader.', 'Admin can only monitor; status changes are performed by the Leader.'))
      return
    }
    setRequests((current) =>
      current.map((item) =>
        item.id === selected.id ? { ...item, status: nextStatus[item.status] } : item,
      ),
    )
    setMessage(`${t('Status', 'Status')} ${selected.code} ${t('diperbarui menjadi', 'updated to')} ${nextStatus[selected.status]}.`)
  }

  const createKanban = () => {
    if (isAdmin) {
      setMessage(t('Admin hanya dapat memantau; pencetakan Kanban Belanja dilakukan Leader.', 'Admin can only monitor; printing Kanban Belanja is performed by the Leader.'))
      return
    }
    setMessage(`${t('Kanban Belanja untuk', 'Kanban Belanja for')} ${selected.partNumber} ${t('siap dicetak.', 'is ready to print.')}`)
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Material Control"
        title={t('Permintaan Material', 'Material Requests')}
        subtitle={t(
          'Buat dan pantau Kanban Belanja berdasarkan kebutuhan aktual Area Assy. Jumlah box dihitung dari standard packaging setiap part number.',
          'Create and monitor Kanban Belanja based on the actual needs of the Assy Area. The number of boxes is calculated from the standard packaging of each part number.',
        )}
        meta={
          <>
            <span className="page-meta__item">
              <ClipboardList size={12} /> {requests.length} {t('request', 'requests')}
            </span>
            <span className="page-meta__item">
              <ScanBarcode size={12} /> Kanban Belanja
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<Printer size={15} />} onClick={createKanban} disabled={isAdmin}>
              {t('Cetak Kanban', 'Print Kanban')}
            </Button>
            <Button variant="primary" leftIcon={<PackagePlus size={15} />} onClick={createKanban} disabled={isAdmin}>
              {t('Buat permintaan', 'Create request')}
            </Button>
          </>
        }
      />

      {message && <Callout tone="success">{message}</Callout>}

      <div className="kpi-grid kpi-grid--3">
        <StatCard
          label={t('Request aktif', 'Active requests')}
          value={String(requests.length)}
          suffix={t('request', 'requests')}
          icon={ClipboardList}
          tone="orange"
          note={`${waiting} ${t('menunggu Supply', 'awaiting Supply')}`}
        />
        <StatCard
          label={t('Total box diminta', 'Total boxes requested')}
          value={String(totalBoxes)}
          suffix="box"
          icon={Boxes}
          tone="sky"
          note={t('Seluruh request hari ini', 'All requests today')}
        />
        <StatCard
          label={t('Selesai', 'Completed')}
          value={String(complete)}
          suffix={t('request', 'requests')}
          icon={FileText}
          tone="green"
          note={t('Sudah diterima produksi', 'Received by production')}
        />
      </div>

      <div className="material-split">
        <section className="card">
          <div className="table-toolbar">
            <div>
              <h2 className="section-title">{t('Daftar permintaan', 'Request list')}</h2>
              <p className="section-sub">{t('Pilih request untuk melihat detail Kanban', 'Select a request to view Kanban details')}</p>
            </div>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder={t('Cari kode / PN…', 'Search code / PN…')}
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
              {t('Total', 'Total')} <strong>{totalBoxes}</strong> {t('box dari', 'boxes from')} {requests.length} {t('request', 'requests')}
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
            <p className="job-model">Sub Assy · {t('Tujuan', 'Destination')} {selected.destination}</p>

            <div className="request-boxes">
              <strong>{selected.boxes}</strong>
              <span>{t('boxes', 'boxes')}</span>
            </div>
            <p className="small muted">
              {t('Standard', 'Standard')} {selected.pcsPerBox} {t('pcs/box · Total', 'pcs/box · Total')}{' '}
              {formatNumber(selected.boxes * selected.pcsPerBox)} pcs
            </p>

            <div className="info-grid" style={{ marginTop: 16 }}>
              <div className="info-item">
                <span className="info-label">{t('Dibuat oleh', 'Created by')}</span>
                <span className="info-value info-value--strong">{selected.requester}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Waktu dibuat', 'Created at')}</span>
                <span className="info-value info-value--strong">{selected.createdAt}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Tujuan', 'Destination')}</span>
                <span className="info-value">{selected.destination}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Status', 'Status')}</span>
                <span className="info-value">{selected.status}</span>
              </div>
            </div>

            <div className="form-actions">
              <Button variant="secondary" leftIcon={<Printer size={14} />} onClick={createKanban} disabled={isAdmin}>
                {t('Cetak', 'Print')}
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
                <h2 className="section-title">{t('Preview Kanban Belanja', 'Kanban Belanja Preview')}</h2>
                <p className="section-sub">{t('Template 80 × 100 mm', 'Template 80 × 100 mm')}</p>
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
                  <span>{t('Qty / box', 'Qty / box')}</span>
                  <strong>{selected.pcsPerBox} pcs</strong>
                </div>
                <div>
                  <span>{t('Destination', 'Destination')}</span>
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

      <Callout tone="info" title={t('Perhitungan box', 'Box calculation')}>
        {t(
          'Kebutuhan box dihitung dari kebutuhan aktual Area Assy dibagi standard packaging PN. Jika terjadi pembulatan, konfirmasi jumlah box ke Leader sebelum Kanban dicetak.',
          'Box requirements are calculated from the actual Assy Area needs divided by the PN standard packaging. If rounding occurs, confirm the number of boxes with the Leader before the Kanban is printed.',
        )}
      </Callout>
    </div>
  )
}
