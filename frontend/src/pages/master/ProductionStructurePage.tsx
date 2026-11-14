import {
  Boxes,
  ChevronRight,
  Cog,
  Factory,
  GitBranch,
  Layers3,
  Network,
  Plus,
  Workflow,
} from 'lucide-react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface StructureNode {
  id: string
  name: string
  meta: string
  children?: StructureNode[]
}

const tree: StructureNode[] = [
  {
    id: 'line-g',
    name: 'Robot G',
    meta: 'Line utama · 3 proses · 12 stasiun',
    children: [
      {
        id: 'proc-bolt',
        name: 'Bolt process',
        meta: 'Machine A · 4 stasiun',
        children: [
          { id: 'st-b1', name: 'Station B1', meta: 'Assy bracket main · cycle 38 s' },
          { id: 'st-b2', name: 'Station B2', meta: 'Sub Assy bolt bracket · cycle 36 s' },
        ],
      },
      {
        id: 'proc-nut',
        name: 'Nut process',
        meta: 'Machine B · 3 stasiun',
        children: [
          { id: 'st-n1', name: 'Station N1', meta: 'Sub Assy nut bracket · cycle 42 s' },
          { id: 'st-n2', name: 'Station N2', meta: 'Assy bracket upper · cycle 40 s' },
        ],
      },
      {
        id: 'proc-final',
        name: 'Final process',
        meta: 'Machine C · 5 stasiun',
        children: [
          { id: 'st-f1', name: 'Station F1', meta: 'Final inspection · cycle 25 s' },
          { id: 'st-f2', name: 'Station F2', meta: 'Packaging & kanban · cycle 20 s' },
        ],
      },
    ],
  },
  {
    id: 'line-h',
    name: 'Robot H',
    meta: 'Line pendukung · 2 proses · 6 stasiun',
    children: [
      {
        id: 'proc-bolt-h',
        name: 'Bolt process',
        meta: 'Machine E · 3 stasiun',
        children: [{ id: 'st-h1', name: 'Station H1', meta: 'Flexible welding cell' }],
      },
      {
        id: 'proc-final-h',
        name: 'Final process',
        meta: 'Machine F · 3 stasiun',
        children: [{ id: 'st-h2', name: 'Station H2', meta: 'Final inspection' }],
      },
    ],
  },
]

const mapping = [
  { id: 'map-1', process: 'Bolt process', line: 'Robot G', station: 'Station B1–B4', machine: 'Machine A', output: '5220K814', status: 'active' },
  { id: 'map-2', process: 'Nut process', line: 'Robot G', station: 'Station N1–N3', machine: 'Machine B', output: '50162B000P', status: 'active' },
  { id: 'map-3', process: 'Final process', line: 'Robot G', station: 'Station F1–F5', machine: 'Machine C', output: '5220BA42', status: 'active' },
  { id: 'map-4', process: 'Press part', line: 'Robot G', station: 'Station P1–P2', machine: 'Machine D', output: '4650C745', status: 'maintenance' },
  { id: 'map-5', process: 'RB.H · Dummy mapping', line: 'Robot H', station: 'Station H1–H3', machine: 'Machine E', output: '5312C009', status: 'active' },
  { id: 'map-6', process: 'RB.H · Dummy mapping', line: 'Robot H', station: 'Station H1–H3', machine: 'Machine F', output: '5312C010', status: 'active' },
]

function TreeNode({ node, depth = 0 }: { node: StructureNode; depth?: number }) {
  return (
    <div>
      <div className={`tree-node${depth === 0 ? ' is-root' : ''} tree-node--${depth === 0 ? 'line' : node.children ? 'process' : 'station'}`}>
        <div className="tree-node__main">
          <span className="tree-node__icon">
            {depth === 0 ? (
              <Factory size={14} />
            ) : node.children ? (
              <Workflow size={14} />
            ) : (
              <Cog size={14} />
            )}
          </span>
          <div className="tree-node__copy">
            <strong>{node.name}</strong>
            <span>{node.meta}</span>
          </div>
        </div>
        {depth === 0 ? (
          <Badge tone="success" dot>
            Active
          </Badge>
        ) : (
          <ChevronRight size={13} className="muted" />
        )}
      </div>

      {node.children && (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductionStructurePage() {
  const columns: Column<(typeof mapping)[number]>[] = [
    {
      key: 'process',
      header: 'Process',
      render: (row) => (
        <div className="cell-stack">
          <span className="cell-main">{row.process}</span>
          <span className="cell-sub">{row.station}</span>
        </div>
      ),
    },
    { key: 'line', header: 'Line', render: (row) => <Badge tone="neutral">{row.line}</Badge> },
    { key: 'machine', header: 'Machine', render: (row) => <span className="mono">{row.machine}</span> },
    { key: 'output', header: 'Output part', render: (row) => <span className="mono strong">{row.output}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Production Structure"
        subtitle="Hierarki line, process, station, dan machine yang menjadi dasar routing produksi serta pemetaan output part number."
        meta={
          <>
            <span className="page-meta__item">
              <Network size={12} /> 2 line aktif
            </span>
            <span className="page-meta__item">
              <GitBranch size={12} /> Version 2026.11
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />}>
            Tambah struktur
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Production line" value="3" suffix="line" icon={Factory} tone="orange" note="Robot G, H & external" />
        <StatCard label="Process" value="7" suffix="proses" icon={Workflow} tone="sky" note="Bolt, nut, final, press" />
        <StatCard label="Station" value="18" suffix="stasiun" icon={Layers3} tone="green" note="Terhubung ke routing" />
        <StatCard label="Output part" value="12" suffix="PN" icon={Boxes} tone="amber" note="Assy & sub assy" />
      </div>

      <div className="structure-layout">
        <section className="card section-card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Struktur organisasi produksi</h2>
              <p className="section-sub">Line → process → station</p>
            </div>
            <Badge tone="sky">Live</Badge>
          </div>
          <div className="org-tree">
            {tree.map((node) => (
              <TreeNode key={node.id} node={node} />
            ))}
          </div>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card section-card">
            <div className="section-head">
              <div>
                <h2 className="section-title">Aturan struktur</h2>
                <p className="section-sub">Berlaku untuk seluruh line</p>
              </div>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Kode line</span>
                <span className="info-value info-value--strong">R-G / R-H / EXT</span>
              </div>
              <div className="info-item">
                <span className="info-label">Kode process</span>
                <span className="info-value">BOLT · NUT · FINAL</span>
              </div>
              <div className="info-item">
                <span className="info-label">Kode station</span>
                <span className="info-value">[LINE]-[PROC]-[NN]</span>
              </div>
              <div className="info-item">
                <span className="info-label">Level maksimum</span>
                <span className="info-value">Line → Process → Station</span>
              </div>
              <div className="info-item">
                <span className="info-label">Terakhir diubah</span>
                <span className="info-value">10 Nov 2026 · Dimas Prakoso</span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  <StatusBadge status="active" />
                </span>
              </div>
            </div>
          </section>

          <Callout tone="info" title="Dampak perubahan">
            Mengubah struktur dapat memengaruhi routing, BOM, dan pemetaan kanban. Pastikan
            tidak ada work order aktif pada station yang diubah.
          </Callout>
        </div>
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Pemetaan process &amp; machine</h2>
            <p className="section-sub">Output part number per process</p>
          </div>
          <Button variant="secondary" size="sm" leftIcon={<Plus size={14} />}>
            Tambah mapping
          </Button>
        </div>
        <DataTable columns={columns} rows={mapping} rowKey={(row) => row.id} minWidth={720} />
      </section>
    </div>
  )
}
