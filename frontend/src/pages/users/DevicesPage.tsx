import { Copy, Monitor, Plus, Printer, RefreshCw, ScanLine, Signal, Tablet, Trash2, Wifi, WifiOff, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
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

const deviceIcon = {
  Tablet: Tablet,
  PC: Monitor,
  Scanner: ScanLine,
  Printer: Printer,
}

const connectionTypeLabel: Record<'wireless' | 'bluetooth' | 'wired', string> = {
  wireless: 'Wireless',
  bluetooth: 'Bluetooth',
  wired: 'Wired',
}

const emptyForm: DeviceInput = {
  name: '',
  type: 'Scanner',
  model: '',
  location: '',
  assignedTo: '',
  status: 'offline',
  connectionType: 'wireless',
  pairingCode: null,
  isDefault: false,
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
  const [form, setForm] = useState<DeviceInput>(emptyForm)
  const dialogRef = useRef<HTMLDialogElement>(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setDevices(await listDevices())
    } catch (loadError) {
      setError(describeApiError(loadError, t('Gagal memuat data device.', 'Failed to load device data.')))
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    void loadData()
  }, [loadData])

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (showForm && !dialog.open) dialog.showModal()
    if (!showForm && dialog.open) dialog.close()
  }, [showForm])

  const resetForm = () => {
    setForm(emptyForm)
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
      pairingCode: device.pairingCode,
      isDefault: device.isDefault,
    })
    setEditingId(device.id)
    setError('')
    setNotice('')
    setShowForm(true)
  }

  const copyPairingCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code)
      setError('')
      setNotice(`${code} ${t('tersalin.', 'copied.')}`)
    } catch {
      setNotice('')
      setError(t('Gagal menyalin kode pairing.', 'Failed to copy pairing code.'))
    }
  }

  const saveDevice = async () => {
    if (!form.name.trim()) {
      setError(t('Nama device wajib diisi.', 'Device name is required.'))
      return
    }
    if (!form.location.trim()) {
      setError(t('Lokasi wajib diisi.', 'Location is required.'))
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
      assignedTo: form.assignedTo?.trim() || null,
      connectionType: form.type === 'Scanner' || form.type === 'Printer' ? form.connectionType : null,
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
        return (
          <div className="user-cell">
            <span className="device-card__icon" aria-hidden="true">
              <Icon size={14} />
            </span>
            <div className="user-cell__copy">
              <strong title={device.name}>{device.name}</strong>
              <span title={`${device.type}${device.model ? ` · ${device.model}` : ''}`}>
                {device.type}{device.model ? ` · ${device.model}` : ''}
              </span>
              <div className="row row--wrap">
                {supportsConnection && device.connectionType && (
                  <Badge tone="sky">{connectionTypeLabel[device.connectionType]}</Badge>
                )}
                {device.type === 'Printer' && device.isDefault && (
                  <Badge tone="orange">{t('Default', 'Default')}</Badge>
                )}
              </div>
            </div>
          </div>
        )
      },
    },
    { key: 'location', header: t('Lokasi', 'Location'), render: (device) => <span className="stock-location">{device.location}</span> },
    { key: 'assigned', header: t('Penugasan', 'Assignment'), render: (device) => <span className="muted small">{device.assignedTo ?? '—'}</span> },
    {
      key: 'pairing',
      header: t('Pairing', 'Pairing'),
      render: (device) => device.type === 'Scanner' && device.pairingCode ? (
        <button
          type="button"
          className="pairing-code"
          onClick={() => void copyPairingCode(device.pairingCode!)}
          title={t('Salin kode pairing', 'Copy pairing code')}
        >
          <span className="mono">{device.pairingCode}</span>
          <Copy size={12} aria-hidden="true" />
        </button>
      ) : (
        <span className="muted">—</span>
      ),
    },
    { key: 'seen', header: t('Terakhir aktif', 'Last seen'), render: (device) => <span className="muted small">{device.lastSeen ?? t('Belum pernah', 'Never')}</span> },
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

  const onlineCount = devices.filter((device) => device.status === 'online').length
  const offlineCount = devices.filter((device) => device.status === 'offline').length
  const maintenanceCount = devices.filter((device) => device.status === 'maintenance').length

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('User Management', 'User Management')}
        title={t('Device Management', 'Device Management')}
        subtitle={t('Daftarkan tablet, scanner, printer, dan PC. Scanner mendapat kode pairing untuk scan kanban tanpa login.', 'Register tablets, scanners, printers, and PCs. Scanners get a pairing code for login-free kanban scanning.')}
        meta={
          <>
            <span className="page-meta__item"><Wifi size={12} /> {onlineCount} {t('online', 'online')}</span>
            <span className="page-meta__item"><WifiOff size={12} /> {offlineCount} {t('offline', 'offline')}</span>
            <span className="page-meta__item"><Signal size={12} /> {maintenanceCount} {t('maintenance', 'maintenance')}</span>
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

      <Callout tone="info" title={t('Cara pairing scanner', 'Scanner pairing')}>
        {t('Salin kode pada kolom Pairing, lalu set sebagai prefix di scanner (misalnya ', 'Copy the code in the Pairing column and set it as the scanner prefix (for example ')}
        <span className="mono">SCN-XXXXXXXX|</span>
        {t('). Scan berikutnya dikenali otomatis tanpa login. Hubungkan scanner lewat WiFi, Bluetooth, atau kabel.', '). Subsequent scans are identified automatically without login. Connect the scanner via WiFi, Bluetooth, or cable.')}
      </Callout>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">{t('Daftar perangkat', 'Devices')}</h2>
            <p className="section-sub">{t('Status, koneksi, dan penugasan device', 'Device status, connection, and assignment')}</p>
          </div>
          <Badge tone="sky">{onlineCount} {t('aktif', 'active')}</Badge>
        </div>
        <DataTable columns={columns} rows={devices} rowKey={(device) => device.id} minWidth={980} />
      </section>

      <dialog
        ref={dialogRef}
        className="device-dialog glass glass--strong"
        onCancel={resetForm}
        aria-labelledby="device-form-title"
      >
        <div className="section-head">
          <div>
            <h2 className="section-title" id="device-form-title">
              {editingId ? t('Ubah device', 'Edit device') : t('Daftarkan device', 'Register device')}
            </h2>
            <p className="section-sub">
              {editingId
                ? t('Perbarui data device yang terdaftar.', 'Update the registered device.')
                : t('Device baru langsung tersimpan ke database.', 'New devices are saved to the database immediately.')}
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={resetForm} aria-label={t('Tutup', 'Close')}>
            <X size={16} />
          </Button>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); void saveDevice() }}>
          <div className="form-grid">
            <Field label={t('Nama device', 'Device name')} htmlFor="device-name">
              <input
                id="device-name"
                className="input"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Contoh: Scanner Supply Kiosk 01"
                autoFocus
              />
            </Field>
            <Field label={t('Tipe device', 'Device type')} htmlFor="device-type">
              <select
                id="device-type"
                className="select"
                value={form.type}
                onChange={(event) => setForm({ ...form, type: event.target.value as DeviceInput['type'] })}
              >
                <option value="Tablet">Tablet (Produksi)</option>
                <option value="PC">PC (Leader Station)</option>
                <option value="Scanner">Scanner QR (Supply/Pickup)</option>
                <option value="Printer">Printer Kanban</option>
              </select>
            </Field>
            {(form.type === 'Scanner' || form.type === 'Printer') && (
              <Field label={t('Model perangkat', 'Device model')} htmlFor="device-model" hint="Contoh: Zebra DS2208 / Zebra ZT230.">
                <input
                  id="device-model"
                  className="input"
                  value={form.model ?? ''}
                  onChange={(event) => setForm({ ...form, model: event.target.value })}
                  placeholder="Model scanner atau printer"
                />
              </Field>
            )}
            <Field label={t('Lokasi', 'Location')} htmlFor="device-location">
              <input
                id="device-location"
                className="input"
                value={form.location}
                onChange={(event) => setForm({ ...form, location: event.target.value })}
                placeholder="Contoh: Material Supply / Robot G — Area Assy"
              />
            </Field>
            <Field label={t('Penugasan (opsional)', 'Assignment (optional)')} htmlFor="device-assigned">
              <input
                id="device-assigned"
                className="input"
                value={form.assignedTo ?? ''}
                onChange={(event) => setForm({ ...form, assignedTo: event.target.value })}
                placeholder="Nama user/team, mis: Supply Kiosk / Andri Setiawan"
              />
            </Field>
            {(form.type === 'Scanner' || form.type === 'Printer') && (
              <Field label={t('Tipe koneksi', 'Connection type')} htmlFor="device-connection" hint="WiFi, Bluetooth, atau kabel (USB/Serial/LAN).">
                <select
                  id="device-connection"
                  className="select"
                  value={form.connectionType ?? 'wireless'}
                  onChange={(event) => setForm({ ...form, connectionType: event.target.value as DeviceInput['connectionType'] })}
                >
                  <option value="wireless">Wireless (WiFi)</option>
                  <option value="bluetooth">Bluetooth (BLE)</option>
                  <option value="wired">Wired (USB/Serial/LAN)</option>
                </select>
              </Field>
            )}
            <Field label={t('Status', 'Status')} htmlFor="device-status">
              <select
                id="device-status"
                className="select"
                value={form.status}
                onChange={(event) => setForm({ ...form, status: event.target.value as DeviceInput['status'] })}
              >
                <option value="offline">Offline</option>
                <option value="online">Online</option>
                <option value="maintenance">Maintenance</option>
              </select>
            </Field>
            {form.type === 'Printer' && (
              <Field label={t('Printer default', 'Default printer')} htmlFor="device-default" hint="Dipakai sebagai printer utama pada pengaturan cetak.">
                <select
                  id="device-default"
                  className="select"
                  value={form.isDefault ? 'yes' : 'no'}
                  onChange={(event) => setForm({ ...form, isDefault: event.target.value === 'yes' })}
                >
                  <option value="no">{t('Bukan default', 'Not default')}</option>
                  <option value="yes">{t('Jadikan default', 'Make default')}</option>
                </select>
              </Field>
            )}
            {form.type === 'Scanner' && form.pairingCode && (
              <Field
                label={t('Kode pairing scanner', 'Scanner pairing code')}
                htmlFor="device-pairing"
                className="span-2"
                hint={t('Set sebagai prefix di scanner: kode ini diikuti tanda | lalu barcode. Scan langsung dikenali tanpa login.', 'Set as the scanner prefix: this code followed by | then the barcode. Scans are identified without login.')}
              >
                <div className="row">
                  <input id="device-pairing" className="input mono" value={form.pairingCode} readOnly />
                  <Button type="button" variant="secondary" onClick={() => void copyPairingCode(form.pairingCode!)}>
                    <Copy size={14} /> {t('Salin', 'Copy')}
                  </Button>
                </div>
              </Field>
            )}
          </div>

          <div className="form-actions">
            <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
              {t('Batal', 'Cancel')}
            </Button>
            <Button type="submit" variant="primary" leftIcon={<Plus size={15} />} loading={saving}>
              {editingId ? t('Simpan perubahan', 'Save changes') : t('Simpan device', 'Save device')}
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
