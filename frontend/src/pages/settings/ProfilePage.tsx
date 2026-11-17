import { Building2, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import { roleLabels } from '../../data/accounts'
import { describeApiError } from '../../lib/api'

export function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!user) return
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone ?? '')
  }, [user])

  if (!user) return null

  const resetForm = () => {
    setName(user.name)
    setEmail(user.email)
    setPhone(user.phone ?? '')
    setMessage('')
    setError('')
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      setMessage('Profil berhasil disimpan ke database.')
    } catch (saveError) {
      setError(describeApiError(saveError, 'Profil gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="My Profile"
        subtitle="Informasi akun yang digunakan pada seluruh aktivitas produksi, material, dan inventory."
        meta={
          <span className="page-meta__item">
            <ShieldCheck size={12} /> Tersinkron dengan database
          </span>
        }
      />

      {error && <Callout tone="danger" title="Profil gagal disimpan">{error}</Callout>}
      {message && <Callout tone="success">{message}</Callout>}

      <section className="card profile-banner">
        <Avatar initials={user.initials} name={user.name} tone="orange" size="xl" />
        <div className="profile-banner__copy">
          <h2>{user.name}</h2>
          <p>{user.roleLabel} · {user.area}</p>
          <div className="profile-banner__meta">
            <span className="profile-badge">
              <UserRound size={11} /> <strong>{user.employeeId}</strong>
            </span>
            <span className="profile-badge">
              <Building2 size={11} /> {user.line}
            </span>
            <Badge tone={user.status === 'active' ? 'success' : 'neutral'} dot>
              {user.status === 'active' ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </section>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>Informasi pribadi</h3>
            <p>Data profil tersimpan pada akun Anda di database.</p>
          </div>
          <form onSubmit={(event) => void saveProfile(event)}>
            <div className="form-grid">
            <Field label="Nama lengkap" htmlFor="profile-name">
              <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Employee ID" htmlFor="profile-employee" hint="Tidak dapat diubah sendiri.">
              <input id="profile-employee" className="input" value={user.employeeId} readOnly />
            </Field>
            <Field label="Email" htmlFor="profile-email">
              <input id="profile-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Nomor telepon" htmlFor="profile-phone">
              <input id="profile-phone" type="tel" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Area kerja" htmlFor="profile-area">
              <input id="profile-area" className="input" value={user.area} readOnly />
            </Field>
            <Field label="Line" htmlFor="profile-line">
              <input id="profile-line" className="input" value={user.line} readOnly />
            </Field>
            </div>
            <div className="form-actions">
              <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>Batalkan</Button>
              <Button
                type="submit"
                variant="primary"
                leftIcon={<Save size={15} />}
                loading={saving}
              >
                Simpan perubahan
              </Button>
            </div>
          </form>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Informasi akun</h3>
              <p>Detail role dan akses</p>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">Username</span>
                <span className="info-value mono">{user.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Role</span>
                <span className="info-value">
                  <Badge tone="orange">{roleLabels[user.role]}</Badge>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Status</span>
                <span className="info-value">
                  <Badge tone={user.status === 'active' ? 'success' : 'neutral'} dot>
                    {user.status === 'active' ? 'Active' : 'Inactive'}
                  </Badge>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Pengaturan shift</span>
                <span className="info-value">
                  {user.shiftMode === 'rotating'
                    ? `Rotasi mingguan · ${user.currentShift ? `Shift ${user.currentShift}` : 'Belum aktif'}`
                    : 'Non-shift'}
                </span>
              </div>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>Kontak</h3>
              <p>Kanal komunikasi terkait akun</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <Mail size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Email</strong>
                  <span>{email || 'Belum diisi'}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <Phone size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Telepon</strong>
                  <span>{phone || 'Belum diisi'}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <MapPin size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Lokasi kerja</strong>
                  <span>{user.line} · {user.area}</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
