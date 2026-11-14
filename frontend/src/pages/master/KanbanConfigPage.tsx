import { Barcode, Eye, Plus, Printer, QrCode, ScanLine, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { Toggle } from '../../components/ui/Toggle'
import { kanbanConfigs as initialConfigs } from '../../data/mock'
import type { KanbanConfig } from '../../types'

export function KanbanConfigPage() {
  const [configs, setConfigs] = useState<KanbanConfig[]>(initialConfigs)
  const [selected, setSelected] = useState(initialConfigs[0].id)
  const active = configs.find((config) => config.id === selected) ?? configs[0]

  const toggleConfig = (id: string) => {
    setConfigs((current) =>
      current.map((config) =>
        config.id === id ? { ...config, active: !config.active } : config,
      ),
    )
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Kanban Configuration"
        subtitle="Format nomor kanban, field wajib, dan template label untuk setiap jenis kanban. Nomor kanban menjadi identitas unik satu container material."
        meta={
          <>
            <span className="page-meta__item">
              <Barcode size={12} /> {configs.length} tipe kanban
            </span>
            <span className="page-meta__item">
              <Printer size={12} /> Label 100 × 150 mm
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />}>
            Tambah format
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Tipe kanban" value={String(configs.length)} suffix="format" icon={Barcode} tone="orange" note="Produksi & material" />
        <StatCard label="Format aktif" value={String(configs.filter((config) => config.active).length)} suffix="format" icon={ScanLine} tone="green" note="Dapat dicetak" />
        <StatCard label="Prefix unik" value="6" suffix="prefix" icon={QrCode} tone="sky" note="KN, SK, MR, RK, PK, DL" />
        <StatCard label="Template label" value="3" suffix="ukuran" icon={Printer} tone="amber" note="100×150, 80×100, external" />
      </div>

      <div className="report-split">
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Format kanban</h2>
              <p className="section-sub">Kelola jenis dan status kanban</p>
            </div>
            <Badge tone="neutral">Configuration</Badge>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            {configs.map((config) => (
              <button
                key={config.id}
                type="button"
                className={`request-item${selected === config.id ? ' is-active' : ''}`}
                onClick={() => setSelected(config.id)}
                style={{ width: '100%', textAlign: 'left' }}
              >
                <span className="request-item__icon">
                  <Barcode size={15} />
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row row--between" style={{ gap: 8 }}>
                    <strong style={{ fontSize: 11.5 }}>{config.type}</strong>
                    <Badge tone={config.active ? 'success' : 'neutral'}>
                      {config.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="cell-sub mono" style={{ marginTop: 3 }}>
                    {config.prefix} · {config.format}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Preview label</h2>
                <p className="section-sub">{active.type}</p>
              </div>
              <Toggle
                checked={active.active}
                onChange={() => toggleConfig(active.id)}
                label={`Aktifkan ${active.type}`}
              />
            </div>

            <div className="kanban-preview">
              <div className="kanban-preview__head">
                <strong>WPC · KANBAN</strong>
                <span>{active.prefix}-2611-001</span>
              </div>
              <h3>5220BA42</h3>
              <p>Assy bracket main · Robot G</p>
              <div className="kanban-meta">
                <div>
                  <span>Qty</span>
                  <strong>39 pcs</strong>
                </div>
                <div>
                  <span>Shift</span>
                  <strong>Shift 1</strong>
                </div>
                <div>
                  <span>Operator</span>
                  <strong>Adi Nugroho</strong>
                </div>
                <div>
                  <span>Tanggal</span>
                  <strong>12 Nov 2026</strong>
                </div>
              </div>
              <div className="barcode" />
            </div>
          </section>

          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Field &amp; format</h2>
                <p className="section-sub">Nomor: {active.format}</p>
              </div>
              <Button size="sm" variant="secondary" leftIcon={<Settings2 size={13} />}>
                Edit
              </Button>
            </div>
            <div className="row row--wrap" style={{ gap: 5 }}>
              {active.fields.map((field) => (
                <Badge key={field} tone="sky">
                  {field}
                </Badge>
              ))}
            </div>
            <div className="info-grid" style={{ marginTop: 14 }}>
              <div className="info-item">
                <span className="info-label">Template</span>
                <span className="info-value">{active.template}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Prefix</span>
                <span className="info-value mono info-value--strong">{active.prefix}</span>
              </div>
            </div>
          </section>
        </div>
      </div>

      <Callout tone="info" title="Urutan nomor kanban">
        Nomor berjalan direset setiap awal bulan (YYMM). Pastikan prefix tidak bentrok antar jenis
        kanban agar scanner dapat membedakan dokumen.
      </Callout>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Semua format</h2>
            <p className="section-sub">Ringkasan konfigurasi kanban</p>
          </div>
        </div>
        <div className="device-grid">
          {configs.map((config) => (
            <div className="device-card" key={config.id}>
              <div className="device-card__top">
                <span className="device-card__icon">
                  <ScanLine size={16} />
                </span>
                <Badge tone={config.active ? 'success' : 'neutral'}>
                  {config.active ? 'Active' : 'Inactive'}
                </Badge>
              </div>
              <h3>{config.type}</h3>
              <p className="mono">{config.format}</p>
              <div className="device-card__foot">
                <span>{config.fields.length} field</span>
                <span className="row" style={{ gap: 4 }}>
                  <Eye size={11} /> {config.template}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
