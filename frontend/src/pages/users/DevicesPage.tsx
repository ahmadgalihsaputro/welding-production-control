import { Laptop, Monitor, Plus, Printer, RefreshCw, ScanLine, Signal, Tablet, Trash2, Wifi, WifiOff, X, HelpCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import { createDevice, deleteDevice, listDevices, updateDevice, type DeviceInput, type DeviceRecord } from '../../lib/masterApi'
import type { Device } from '../../types'

const deviceIcon = {
  Tablet: Tablet,
  PC: Monitor,
  Scanner: ScanLine,
  Printer: Printer,
}

const statusTone: Record<Device['status'], 'green' | 'red' | 'amber'> = {
  online: 'green',
  offline: 'red',
  maintenance: 'amber',
}

const connectionTypeLabel: Record<'wireless' | 'wired', string> = {
  wireless: 'Wireless',
  wired: 'Wired',
}

export function DevicesPage() {
  const { confirm } = useConfirmation()
  const [devices, setDevices] = useState<DeviceRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<DeviceInput>({
    name: '',
    type: 'Scanner',
    location: '',
    assignedTo: '',
    status: 'offline',
    connectionType: 'wireless',
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listDevices()
      setDevices(data)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Gagal memuat data device.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const resetForm = () => {
    setForm({
      name: '',
      type: 'Scanner',
      location: '',
      assignedTo: '',
      status: 'offline',
      connectionType: 'wireless',
    })
    setEditingId(null)
    setShowForm(false)
    setError('')
    setNotice('')
  }

  const openAddForm = () => {
    resetForm()
    setShowForm(true)
  }

  const openEditForm = (device: DeviceRecord) => {
    setForm({
      name: device.name,
      type: device.type,
      location: device.location,
      assignedTo: device.assignedTo ?? '',
      status: device.status,
      connectionType: device.connectionType ?? 'wireless',
    })
    setEditingId(device.id)
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Nama device wajib diisi.'
    if (!form.location.trim()) return 'Lokasi wajib diisi.'
    if (form.type === 'Scanner' && !form.connectionType) return 'Tipe koneksi (wireless/wired) wajib diisi untuk Scanner.'
    return null
  }

  const saveDevice = async () => {
    const validation = validateForm()
    if (validation) {
      setError(validation)
      setNotice('')
      return
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        await updateDevice(editingId, form)
        setNotice('Device berhasil diperbarui.')
      } else {
        await createDevice(form)
        setNotice('Device baru berhasil didaftarkan.')
      }
      resetForm()
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Device gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (device: DeviceRecord) => {
    const nextStatus: DeviceRecord['status'] = device.status === 'online' ? 'offline' : 'online'
    setBusyId(device.id)
    setError('')
    setNotice('')
    try {
      await updateDevice(device.id, { status: nextStatus })
      setNotice(`${device.name} ${nextStatus === 'online' ? 'dihubungkan' : 'diputuskan'}.`)
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status device gagal diubah.'))
    } finally {
      setBusyId(null)
    }
  }

  const removeDevice = async (device: DeviceRecord) => {
    const confirmed = await confirm({
      title: 'Konfirmasi hapus device',
      message: `Hapus device ${device.name}? Data device akan dihapus permanen.`,
      confirmLabel: 'Hapus device',
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyId(device.id)
    setError('')
    setNotice('')
    try {
      await deleteDevice(device.id)
      setNotice(`Device ${device.name} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'Device gagal dihapus.'))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<DeviceRecord>[] = [
    {
      key: 'device',
      header: 'Device',
      render: (device) => {
        const Icon = deviceIcon[device.type]
        const connBadge = device.type === 'Scanner' && device.connectionType ? (
          <Badge tone="sky" className="ml-2 text-xs">{connectionTypeLabel[device.connectionType]}</Badge>
        ) : null
        return (
          <div className="user-cell">
            <span className="device-card__icon" style={{ width: 30, height: 30 }}>
              <Icon size={14} />
            </span>
            <div className="user-cell__copy">
              <strong>{device.name}</strong>
              <span>{device.type}{connBadge}</span>
            </div>
          </div>
        )
      },
    },
    { key: 'location', header: 'Lokasi', render: (device) => <span className="stock-location">{device.location}</span> },
    { key: 'assigned', header: 'Assigned to', render: (device) => <span className="muted small">{device.assignedTo ?? '—'}</span> },
    { key: 'seen', header: 'Last seen', render: (device) => <span className="muted small">{device.lastSeen ?? 'Belum pernah'}</span> },
    { key: 'status', header: 'Status', render: (device) => <StatusBadge status={device.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (device) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(device)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === device.id}
            onClick={() => void toggleStatus(device)}
          >
            {device.status === 'online' ? 'Disconnect' : 'Connect'}
          </Button>
          <Button
            size="sm"
            variant="danger"
            loading={busyId === device.id}
            onClick={() => void removeDevice(device)}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ),
    },
  ]

  const onlineCount = devices.filter((d) => d.status === 'online').length
  const offlineCount = devices.filter((d) => d.status === 'offline').length
  const maintenanceCount = devices.filter((d) => d.status === 'maintenance').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="User Management"
        title="Device Management"
        subtitle="Perangkat terhubung ke WPC: tablet produksi, scanner supply (wireless/wired), printer kanban, PC leader.\nCara koneksi: Wired = USB/Serial ke PC host; Wireless = WiFi/BLE ke jaringan lokal.\nFungsi Scanner QR: Hasil scan masuk ke antrian produksi (database) via API endpoint."
        meta={
          <>
            <span className="page-meta__item">
              <Wifi size={12} /> {onlineCount} online
            </span>
            <span className="page-meta__item">
              <WifiOff size={12} /> {offlineCount} offline
            </span>
            <span className="page-meta__item">
              <Signal size={12} /> {maintenanceCount} maintenance
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
              Muat ulang
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openAddForm}>
              Daftarkan device
            </Button>
            <Button variant="ghost" size="sm" leftIcon={<HelpCircle size={15} />} onClick={() => alert('Wired: USB/Serial ke PC host (COM port).\nWireless: WiFi (TCP) atau Bluetooth LE.\nScanner kirim data QR ke API /production/requests/scan.\nData masuk antrian produksi database.')}>
              Cara koneksi
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && devices.length === 0 && <Callout tone="info">Memuat data device dari server…</Callout>}

      <div className="kpi-grid">
        <StatCard label="Total device" value={String(devices.length)} suffix="unit" icon={Signal} tone="orange" note="Terdaftar di WPC" />
        <StatCard label="Online" value={String(onlineCount)} suffix="unit" icon={Wifi} tone="green" note="Terhubung" />
        <StatCard label="Maintenance" value={String(maintenanceCount)} suffix="unit" icon={Printer} tone="amber" note="Perlu perhatian" />
        <StatCard label="Offline" value={String(offlineCount)} suffix="unit" icon={WifiOff} tone="red" note="Tidak terhubung" />
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
              {device.type === 'Scanner' && device.connectionType && (
                <Badge tone="sky" className="mb-2 text-xs">
                  {connectionTypeLabel[device.connectionType]}
                </Badge>
              )}
              <div className="info-grid" style={{ marginTop: 10 }}>
                <div className="info-item">
                  <span className="info-label">Tipe</span>
                  <span className="info-value">{device.type}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Assigned</span>
                  <span className="info-value">{device.assignedTo ?? '—'}</span>
                </div>
              </div>
              <div className="device-card__foot">
                <span className="row" style={{ gap: 4 }}>
                  <Laptop size={11} /> {device.lastSeen ?? 'Belum pernah'}
                </span>
                <Button size="sm" variant="ghost" onClick={() => toggleStatus(device)} loading={busyId === device.id}>
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
          <Badge tone="sky">{onlineCount} aktif</Badge>
        </div>
        <DataTable columns={columns} rows={devices} rowKey={(device) => device.id} minWidth={820} />
      </section>

      {showForm && (
        <section className="card" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.3)', padding: 20 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto' }}>
            <div className="section-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h2 className="section-title">{editingId ? 'Ubah device' : 'Daftarkan device baru'}</h2>
                <p className="section-sub">
                  {editingId
                    ? 'Perbarui data device. Koneksi (wireless/wired) hanya untuk tipe Scanner.'
                    : 'Device yang didaftarkan di sini langsung tersimpan ke database dan dapat dipantau statusnya.'}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={resetForm}><X size={16} /></Button>
            </div>

            <div className="form-grid" style={{ marginTop: 16 }}>
              <Field label="Nama device" htmlFor="device-name">
                <input
                  id="device-name"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Contoh: Scanner Supply Kiosk 01"
                />
              </Field>
              <Field label="Tipe device" htmlFor="device-type">
                <select
                  id="device-type"
                  className="select"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as DeviceInput['type'] })}
                >
                  <option value="Tablet">Tablet (Produksi)</option>
                  <option value="PC">PC (Leader Station)</option>
                  <option value="Scanner">Scanner QR (Supply/Pickup)</option>
                  <option value="Printer">Printer Kanban</option>
                </select>
              </Field>
              <Field label="Lokasi" htmlFor="device-location">
                <input
                  id="device-location"
                  className="input"
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                  placeholder="Contoh: Robot G — Area Assy / Material Supply / Leader Room"
                />
              </Field>
              <Field label="Assigned to (opsional)" htmlFor="device-assigned">
                <input
                  id="device-assigned"
                  className="input"
                  value={form.assignedTo ?? ''}
                  onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
                  placeholder="Nama user/team, mis: Supply Kiosk / Andri Setiawan"
                />
              </Field>
              {form.type === 'Scanner' && (
                <Field label="Tipe koneksi" htmlFor="device-connection" hint="Hanya untuk tipe Scanner QR.">
                  <select
                    id="device-connection"
                    className="select"
                    value={form.connectionType ?? 'wireless'}
                    onChange={(e) => setForm({ ...form, connectionType: e.target.value as 'wireless' | 'wired' })}
                  >
                    <option value="wireless">Wireless (Bluetooth/WiFi)</option>
                    <option value="wired">Wired (USB/Serial)</option>
                  </select>
                </Field>
              )}
              <Field label="Status awal" htmlFor="device-status">
                <select
                  id="device-status"
                  className="select"
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as DeviceInput['status'] })}
                >
                  <option value="offline">Offline</option>
                  <option value="online">Online</option>
                  <option value="maintenance">Maintenance</option>
                </select>
              </Field>
            </div>

            <div className="form-actions" style={{ marginTop: 16 }}>
              <Button variant="secondary" onClick={resetForm} disabled={saving}>
                Batal
              </Button>
              <Button variant="primary" leftIcon={<Plus size={15} />} loading={saving} onClick={() => void saveDevice()}>
                {editingId ? 'Simpan perubahan' : 'Simpan device'}
              </Button>
            </div>
          </div>
        </section>
      )}

      <Callout tone="info" title="Pairing & Koneksi Device">
        <div style={{ display: 'grid', gap: 8 }}>
          <div><strong>Scanner Wired (USB/Serial):</strong> Colok ke PC host → install driver virtual COM port → konfigurasikan port di device settings → test scan.</div>
          <div><strong>Scanner Wireless (WiFi/BLE):</strong> Pairing via WiFi (TCP socket ke server) atau Bluetooth LE → masukkan IP server/port atau nama BLE device → test scan.</div>
          <div><strong>Alur Data QR:</strong> Scan QR kanban → device POST ke <code>/api/production/requests/scan</code> → backend validasi → masuk antrian produksi (database) → tampil di halaman antrian.</div>
          <div><strong>Status Online/Offline:</strong> Diupdate manual via tombol Connect/Disconnect atau otomatis via heartbeat (belum diimplementasikan).</div>
        </div>
      </Callout>
    </div>
  )
}