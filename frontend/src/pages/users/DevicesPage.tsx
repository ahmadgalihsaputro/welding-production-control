import { Laptop, Monitor, Plus, Printer, RefreshCw, ScanLine, Signal, Tablet, Trash2, Wifi, WifiOff, X } from 'lucide-react'
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
import { usePreferences } from '../../contexts/PreferencesContext'
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
  const { t } = usePreferences()
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
    model: '',
    location: '',
    assignedTo: '',
    status: 'offline',
    connectionType: 'wireless',
    isDefault: false,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await listDevices()
      setDevices(data)
    } catch (loadError) {
      setError(describeApiError(loadError, t('Gagal memuat data device.', 'Failed to load device data.')))
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
      model: '',
      location: '',
      assignedTo: '',
      status: 'offline',
      connectionType: 'wireless',
      isDefault: false,
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
      model: device.model ?? '',
      location: device.location,
      assignedTo: device.assignedTo ?? '',
      status: device.status,
      connectionType: device.connectionType ?? 'wireless',
      isDefault: device.isDefault,
    })
    setEditingId(device.id)
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const validateForm = (): string | null => {
    if (!form.name.trim()) return t('Nama device wajib diisi.', 'Device name is required.')
    if (!form.location.trim()) return t('Lokasi wajib diisi.', 'Location is required.')
    if (form.type === 'Scanner' && !form.connectionType) return t('Tipe koneksi (wireless/wired) wajib diisi untuk Scanner.', 'Connection type (wireless/wired) is required for Scanner.')
    return null
  }

  const saveDevice = async () => {
    const validation = validateForm()
    if (validation) {
      setError(validation)
      setNotice('')
      return
    }

    const confirmed = await confirm({
      title: editingId
        ? t('Simpan perubahan device?', 'Save device changes?')
        : t('Daftarkan device baru?', 'Register new device?'),
      message: `${editingId ? t('Perbarui', 'Update') : t('Daftarkan', 'Register')} ${form.name.trim()} (${form.type}) ${t('pada database device?', 'in the device database?')}`,
      confirmLabel: editingId ? t('Simpan perubahan', 'Save changes') : t('Daftarkan device', 'Register device'),
    })
    if (!confirmed) return

    const payload: DeviceInput = {
      ...form,
      model: form.model?.trim() || null,
      connectionType:
        form.type === 'Scanner' || form.type === 'Printer' ? form.connectionType : null,
      isDefault: form.type === 'Printer' ? Boolean(form.isDefault) : false,
    }

    setSaving(true)
    setError('')
    setNotice('')
    try {
      if (editingId) {
        await updateDevice(editingId, payload)
        setNotice(t('Device berhasil diperbarui.', 'Device updated successfully.'))
      } else {
        await createDevice(payload)
        setNotice(t('Device baru berhasil didaftarkan.', 'New device registered successfully.'))
      }
      resetForm()
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, t('Device gagal disimpan.', 'Failed to save device.')))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (device: DeviceRecord) => {
    const nextStatus: DeviceRecord['status'] = device.status === 'online' ? 'offline' : 'online'
    const confirmed = await confirm({
      title: nextStatus === 'online'
        ? t('Hubungkan device?', 'Connect device?')
        : t('Putuskan device?', 'Disconnect device?'),
      message: `${nextStatus === 'online' ? t('Hubungkan', 'Connect') : t('Putuskan', 'Disconnect')} ${device.name}? ${t('Status koneksi akan diperbarui di database.', 'The connection status will be updated in the database.')}`,
      confirmLabel: nextStatus === 'online' ? t('Hubungkan', 'Connect') : t('Putuskan', 'Disconnect'),
      tone: nextStatus === 'online' ? 'primary' : 'danger',
    })
    if (!confirmed) return
    setBusyId(device.id)
    setError('')
    setNotice('')
    try {
      await updateDevice(device.id, { status: nextStatus })
      setNotice(`${device.name} ${nextStatus === 'online' ? t('dihubungkan', 'connected') : t('diputuskan', 'disconnected')}.`)
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, t('Status device gagal diubah.', 'Failed to change device status.')))
    } finally {
      setBusyId(null)
    }
  }

  const removeDevice = async (device: DeviceRecord) => {
    const confirmed = await confirm({
      title: t('Konfirmasi hapus device', 'Confirm device deletion'),
      message: `${t('Hapus device', 'Delete device')} ${device.name}? ${t('Data device akan dihapus permanen.', 'The device data will be permanently deleted.')}`,
      confirmLabel: t('Hapus device', 'Delete device'),
      tone: 'danger',
    })
    if (!confirmed) return
    setBusyId(device.id)
    setError('')
    setNotice('')
    try {
      await deleteDevice(device.id)
      setNotice(`${t('Device', 'Device')} ${device.name} ${t('dihapus.', 'deleted.')}`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, t('Device gagal dihapus.', 'Failed to delete device.')))
    } finally {
      setBusyId(null)
    }
  }

  const columns: Column<DeviceRecord>[] = [
    {
      key: 'device',
      header: t('Device', 'Device'),
      render: (device) => {
        const Icon = deviceIcon[device.type]
        const supportsConnection = device.type === 'Scanner' || device.type === 'Printer'
        const connBadge = supportsConnection && device.connectionType ? (
          <Badge tone="sky" className="ml-2 text-xs">{connectionTypeLabel[device.connectionType]}</Badge>
        ) : null
        return (
          <div className="user-cell">
            <span className="device-card__icon" style={{ width: 30, height: 30 }}>
              <Icon size={14} />
            </span>
            <div className="user-cell__copy">
              <strong>{device.name}</strong>
              <span>
                {device.type}
                {device.model ? ` · ${device.model}` : ''}
                {connBadge}
                {device.type === 'Printer' && device.isDefault && (
                  <Badge tone="orange" className="ml-2 text-xs">{t('Default', 'Default')}</Badge>
                )}
              </span>
            </div>
          </div>
        )
      },
    },
    { key: 'location', header: t('Lokasi', 'Location'), render: (device) => <span className="stock-location">{device.location}</span> },
    { key: 'assigned', header: t('Assigned to', 'Assigned to'), render: (device) => <span className="muted small">{device.assignedTo ?? '—'}</span> },
    { key: 'seen', header: t('Last seen', 'Last seen'), render: (device) => <span className="muted small">{device.lastSeen ?? t('Belum pernah', 'Never')}</span> },
    { key: 'status', header: t('Status', 'Status'), render: (device) => <StatusBadge status={device.status} /> },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (device) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(device)}>
            {t('Edit', 'Edit')}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyId === device.id}
            onClick={() => void toggleStatus(device)}
          >
            {device.status === 'online' ? t('Disconnect', 'Disconnect') : t('Connect', 'Connect')}
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
        eyebrow={t('User Management', 'User Management')}
        title={t('Device Management', 'Device Management')}
        subtitle={t('Perangkat terhubung ke WPC: tablet produksi, scanner supply (wireless/wired), printer kanban (wireless/wired), PC leader. Printer yang terdaftar di sini dipakai oleh konfigurasi Kanban dan Barcode & Printing.', 'Devices connected to WPC: production tablets, supply scanners (wireless/wired), kanban printers (wireless/wired), leader PCs. Printers registered here are used by Kanban configuration and Barcode & Printing.')}
        meta={
          <>
            <span className="page-meta__item">
              <Wifi size={12} /> {onlineCount} {t('online', 'online')}
            </span>
            <span className="page-meta__item">
              <WifiOff size={12} /> {offlineCount} {t('offline', 'offline')}
            </span>
            <span className="page-meta__item">
              <Signal size={12} /> {maintenanceCount} {t('maintenance', 'maintenance')}
            </span>
          </>
        }
        actions={
          <>
            <Button variant="secondary" leftIcon={<RefreshCw size={15} />} loading={loading} onClick={() => void loadData()}>
              {t('Muat ulang', 'Reload')}
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openAddForm}>
              {t('Daftarkan device', 'Register device')}
            </Button>
          </>
        }
      />

      {error && <Callout tone="danger" title={t('Aksi gagal', 'Action failed')}>{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && devices.length === 0 && <Callout tone="info">{t('Memuat data device dari server…', 'Loading device data from the server…')}</Callout>}

      <div className="kpi-grid">
        <StatCard label={t('Total device', 'Total devices')} value={String(devices.length)} suffix="unit" icon={Signal} tone="orange" note={t('Terdaftar di WPC', 'Registered in WPC')} />
        <StatCard label={t('Online', 'Online')} value={String(onlineCount)} suffix="unit" icon={Wifi} tone="green" note={t('Terhubung', 'Connected')} />
        <StatCard label={t('Maintenance', 'Maintenance')} value={String(maintenanceCount)} suffix="unit" icon={Printer} tone="amber" note={t('Perlu perhatian', 'Needs attention')} />
        <StatCard label={t('Offline', 'Offline')} value={String(offlineCount)} suffix="unit" icon={WifiOff} tone="red" note={t('Tidak terhubung', 'Not connected')} />
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
              <div className="row row--wrap" style={{ gap: 6 }}>
                {(device.type === 'Scanner' || device.type === 'Printer') && device.connectionType && (
                  <Badge tone="sky" className="text-xs">
                    {connectionTypeLabel[device.connectionType]}
                  </Badge>
                )}
                {device.type === 'Printer' && device.isDefault && <Badge tone="orange">Default printer</Badge>}
              </div>
              <div className="info-grid" style={{ marginTop: 10 }}>
                <div className="info-item">
                  <span className="info-label">Tipe</span>
                  <span className="info-value">{device.type}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Model</span>
                  <span className="info-value">{device.model ?? '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Assigned</span>
                  <span className="info-value">{device.assignedTo ?? '—'}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Kanban</span>
                  <span className="info-value">
                    {device.type === 'Printer' ? `${device.kanbanConfigCount} konfigurasi` : '—'}
                  </span>
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
                    ? 'Perbarui data device. Koneksi (wireless/wired) berlaku untuk Scanner dan Printer.'
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
              {(form.type === 'Scanner' || form.type === 'Printer') && (
                <Field label="Model perangkat" htmlFor="device-model" hint="Contoh: Zebra DS2208 / Zebra ZT230.">
                  <input
                    id="device-model"
                    className="input"
                    value={form.model ?? ''}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="Model scanner atau printer"
                  />
                </Field>
              )}
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
              {(form.type === 'Scanner' || form.type === 'Printer') && (
                <Field label="Tipe koneksi" htmlFor="device-connection" hint="Scanner: USB/Serial atau WiFi/BLE. Printer: USB/LAN atau WiFi.">
                  <select
                    id="device-connection"
                    className="select"
                    value={form.connectionType ?? 'wireless'}
                    onChange={(e) => setForm({ ...form, connectionType: e.target.value as 'wireless' | 'wired' })}
                  >
                    <option value="wireless">Wireless (WiFi/Bluetooth)</option>
                    <option value="wired">Wired (USB/Serial/LAN)</option>
                  </select>
                </Field>
              )}
              {form.type === 'Printer' && (
                <Field label="Printer default" htmlFor="device-default" hint="Dipakai sebagai printer utama pada pengaturan cetak.">
                  <select
                    id="device-default"
                    className="select"
                    value={form.isDefault ? 'yes' : 'no'}
                    onChange={(e) => setForm({ ...form, isDefault: e.target.value === 'yes' })}
                  >
                    <option value="no">Bukan default</option>
                    <option value="yes">Jadikan printer default</option>
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
          <div><strong>Scanner Wired (USB/Serial):</strong> Colok ke PC host, lalu gunakan driver virtual COM port pada halaman supply scan.</div>
          <div><strong>Scanner Wireless (WiFi/BLE):</strong> Hubungkan scanner ke jaringan lokal atau pairing Bluetooth sebelum dipakai.</div>
          <div><strong>Printer Wired (USB/LAN):</strong> Hubungkan printer ke PC host atau jaringan kabel, lalu pilih sebagai default.</div>
          <div><strong>Printer Wireless:</strong> Hubungkan printer ke WiFi yang sama dengan jaringan aplikasi.</div>
          <div><strong>Status Online/Offline:</strong> Diperbarui saat tombol Hubungkan/Putuskan ditekan dan tersimpan di database.</div>
        </div>
      </Callout>
    </div>
  )
}