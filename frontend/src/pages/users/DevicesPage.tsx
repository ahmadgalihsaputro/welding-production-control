import { Laptop, Monitor, Plus, Printer, ScanLine, Signal, Tablet, Wifi, WifiOff } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { devices as initialDevices } from '../../data/mock'
import type { Device } from '../../types'

const deviceIcon = {
  Tablet: Tablet,
  PC: Monitor,
  Scanner: ScanLine,
  Printer: Printer,
}

export function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>(initialDevices)

  const toggleStatus = (device: Device) => {
    setDevices((current) =>
      current.map((item) =>
        item.id === device.id
          ? { ...item, status: item.status === 'online' ? 'offline' : 'online' }
          : item,
      ),
    )
  }

  const columns: Column<Device>[] = [
    {
      key: 'device',
      header: 'Device',
      render: (device) => {
        const Icon = deviceIcon[device.type]
        return (
          <div className="user-cell">
            <span className="device-card__icon" style={{ width: 30, height: 30 }}>
              <Icon size={14} />
            </span>
            <div className="user-cell__copy">
              <strong>{device.name}</strong>
              <span>{device.type}</span>
            </div>
          </div>
        )
      },
    },
    { key: 'location', header: 'Lokasi', render: (device) => <span className="stock-location">{device.location}</span> },
    { key: 'assigned', header: 'Assigned to', render: (device) => <span className="muted small">{device.assignedTo}</span> },
    { key: 'seen', header: 'Last seen', render: (device) => <span className="muted small">{device.lastSeen}</span> },
    { key: 'status', header: 'Status', render: (device) => <StatusBadge status={device.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (device) => (
        <Button size="sm" variant="ghost" onClick={() => toggleStatus(device)}>
          {device.status === 'online' ? 'Disconnect' : 'Connect'}
        </Button>
      ),
    },
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="User Management"
        title="Device Management"
        subtitle="Perangkat yang terhubung ke WPC: tablet produksi, scanner supply, printer kanban, dan PC leader. Status koneksi dipantau real-time."
        meta={
          <>
            <span className="page-meta__item">
              <Wifi size={12} /> {devices.filter((device) => device.status === 'online').length} online
            </span>
            <span className="page-meta__item">
              <WifiOff size={12} /> {devices.filter((device) => device.status === 'offline').length} offline
            </span>
          </>
        }
        actions={
          <Button variant="primary" leftIcon={<Plus size={15} />}>
            Daftarkan device
          </Button>
        }
      />

      <div className="kpi-grid">
        <StatCard label="Total device" value={String(devices.length)} suffix="unit" icon={Signal} tone="orange" note="Terdaftar di WPC" />
        <StatCard label="Online" value={String(devices.filter((device) => device.status === 'online').length)} suffix="unit" icon={Wifi} tone="green" note="Terhubung" />
        <StatCard label="Maintenance" value={String(devices.filter((device) => device.status === 'maintenance').length)} suffix="unit" icon={Printer} tone="amber" note="Perlu perhatian" />
        <StatCard label="Offline" value={String(devices.filter((device) => device.status === 'offline').length)} suffix="unit" icon={WifiOff} tone="red" note="Tidak terhubung" />
      </div>

      <div className="device-grid">
        {devices.map((device) => {
          const Icon = deviceIcon[device.type]
          return (
            <div className="device-card" key={device.id}>
              <div className="device-card__top">
                <span className="device-card__icon">
                  <Icon size={16} />
                </span>
                <StatusBadge status={device.status} />
              </div>
              <h3>{device.name}</h3>
              <p>{device.location}</p>
              <div className="info-grid" style={{ marginTop: 10 }}>
                <div className="info-item">
                  <span className="info-label">Tipe</span>
                  <span className="info-value">{device.type}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Assigned</span>
                  <span className="info-value">{device.assignedTo}</span>
                </div>
              </div>
              <div className="device-card__foot">
                <span className="row" style={{ gap: 4 }}>
                  <Laptop size={11} /> {device.lastSeen}
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(device)}>
                  {device.status === 'online' ? 'Disconnect' : 'Connect'}
                </Button>
              </div>
            </div>
          )
        })}
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Daftar perangkat</h2>
            <p className="section-sub">Status dan penugasan device</p>
          </div>
          <Badge tone="sky">{devices.filter((device) => device.status === 'online').length} aktif</Badge>
        </div>
        <DataTable columns={columns} rows={devices} rowKey={(device) => device.id} minWidth={820} />
      </section>

      <Callout tone="info" title="Pairing perangkat">
        Perangkat baru harus dipasangkan dengan kode 6 digit yang dibuat dari menu ini. Kode berlaku
        10 menit dan hanya dapat dipakai satu kali.
      </Callout>
    </div>
  )
}
