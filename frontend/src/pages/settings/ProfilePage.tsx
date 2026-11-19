import { Building2, Lock, Mail, MapPin, Pencil, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { usePreferences } from '../../contexts/PreferencesContext'
import { roleLabels } from '../../data/accounts'
import { describeApiError } from '../../lib/api'

export function ProfilePage() {
  const { user, updateProfile, hasRole } = useAuth()
  const { confirm } = useConfirmation()
  const { t } = usePreferences()
  const canEdit = hasRole('admin')
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [message, setMessage] = useState('')
  const [submitError, setSubmitError] = useState('')
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
    setSubmitError('')
  }

  const saveProfile = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!canEdit) return
    if (!name.trim()) {
      setSubmitError(t('Nama lengkap wajib diisi.', 'Full name is required.'))
      return
    }
    const confirmed = await confirm({
      title: t('Simpan perubahan profil?', 'Save profile changes?'),
      message: t('Nama, email, dan nomor telepon akan diperbarui pada database akun Anda.', 'Name, email, and phone number will be updated in your account database.'),
      confirmLabel: t('Simpan perubahan', 'Save changes'),
    })
    if (!confirmed) return

    setSaving(true)
    setMessage('')
    setSubmitError('')
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
      })
      setMessage(t('Profil berhasil disimpan ke database.', 'Profile saved to the database.'))
      window.setTimeout(() => setMessage(''), 4000)
    } catch (saveError) {
      setSubmitError(describeApiError(saveError, t('Profil gagal disimpan.', 'Failed to save profile.')))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={t('Pengaturan', 'Settings')}
        title={t('Profil Saya', 'My Profile')}
        subtitle={t('Informasi akun yang digunakan pada seluruh aktivitas produksi, material, dan inventory.', 'Account information used across production, material, and inventory activities.')}
        meta={
          <>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> {t('Tersinkron dengan database', 'Synced with the database')}
            </span>
            <span className="page-meta__item">
              {canEdit ? <Pencil size={12} /> : <Lock size={12} />}
              {canEdit ? t('Dapat diedit', 'Editable') : t('Hanya baca', 'Read-only')}
            </span>
          </>
        }
      />

      {submitError && <Callout tone="danger" title={t('Profil gagal disimpan', 'Failed to save profile')}>{submitError}</Callout>}
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
              {user.status === 'active' ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')}
            </Badge>
          </div>
        </div>
      </section>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>{t('Informasi pribadi', 'Personal information')}</h3>
            <p>{t('Data profil tersimpan pada akun Anda di database.', 'Profile data is stored in your account in the database.')}</p>
          </div>

          {!canEdit && (
            <Callout tone="info">
              {t('Profil hanya dapat diubah oleh akun dengan role Admin. Hubungi Admin bila ada data yang perlu diperbarui.', 'Profiles can only be changed by an Admin account. Contact an Admin if data needs updating.')}
            </Callout>
          )}

          <form onSubmit={saveProfile}>
            <div className="form-grid">
              <Field label={t('Nama lengkap', 'Full name')} htmlFor="profile-name">
                <input
                  id="profile-name"
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  readOnly={!canEdit}
                  required
                />
              </Field>
              <Field label={t('Email', 'Email')} htmlFor="profile-email">
                <input
                  id="profile-email"
                  type="email"
                  className="input"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  readOnly={!canEdit}
                />
              </Field>
              <Field label={t('Nomor telepon', 'Phone number')} htmlFor="profile-phone">
                <input
                  id="profile-phone"
                  type="tel"
                  className="input"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  readOnly={!canEdit}
                />
              </Field>
              <Field label={t('Employee ID', 'Employee ID')} htmlFor="profile-employee">
                <input id="profile-employee" className="input" value={user.employeeId} readOnly />
              </Field>
              <Field label={t('Area kerja', 'Work area')} htmlFor="profile-area">
                <input id="profile-area" className="input" value={user.area} readOnly />
              </Field>
              <Field label={t('Line', 'Line')} htmlFor="profile-line">
                <input id="profile-line" className="input" value={user.line} readOnly />
              </Field>
            </div>

            {canEdit && (
              <div className="form-actions">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saving}>
                  {t('Batalkan', 'Cancel')}
                </Button>
                <Button type="submit" variant="primary" leftIcon={<Save size={15} />} loading={saving}>
                  {t('Simpan perubahan', 'Save changes')}
                </Button>
              </div>
            )}
          </form>
        </section>

        <div style={{ display: 'grid', gap: 16 }}>
          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Informasi akun', 'Account information')}</h3>
              <p>{t('Detail role dan akses', 'Role and access details')}</p>
            </div>
            <div className="info-grid">
              <div className="info-item">
                <span className="info-label">{t('Username', 'Username')}</span>
                <span className="info-value mono">{user.username}</span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Role', 'Role')}</span>
                <span className="info-value">
                  <Badge tone="orange">{roleLabels[user.role]}</Badge>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Status', 'Status')}</span>
                <span className="info-value">
                  <Badge tone={user.status === 'active' ? 'success' : 'neutral'} dot>
                    {user.status === 'active' ? t('Aktif', 'Active') : t('Nonaktif', 'Inactive')}
                  </Badge>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">{t('Pengaturan shift', 'Shift setting')}</span>
                <span className="info-value">
                  {user.shiftMode === 'rotating'
                    ? t(`Rotasi mingguan · ${user.currentShift ? `Shift ${user.currentShift}` : 'Belum aktif'}`, `Weekly rotation · ${user.currentShift ? `Shift ${user.currentShift}` : 'Not active'}`)
                    : t('Non-shift', 'Non-shift')}
                </span>
              </div>
            </div>
          </section>

          <section className="card settings-card">
            <div className="settings-card__head">
              <h3>{t('Kontak', 'Contact')}</h3>
              <p>{t('Kanal komunikasi terkait akun', 'Account communication channels')}</p>
            </div>
            <div className="movement-list">
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--sky-soft)', color: 'var(--sky-deep)' }}>
                  <Mail size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Email', 'Email')}</strong>
                  <span>{email || t('Belum diisi', 'Not filled in')}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <Phone size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Telepon', 'Phone')}</strong>
                  <span>{phone || t('Belum diisi', 'Not filled in')}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
                  <MapPin size={14} />
                </span>
                <div className="movement__copy">
                  <strong>{t('Lokasi kerja', 'Work location')}</strong>
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
