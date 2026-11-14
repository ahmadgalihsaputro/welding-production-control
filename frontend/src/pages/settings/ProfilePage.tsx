import { BadgeCheck, Building2, Mail, MapPin, Phone, Save, ShieldCheck, UserRound } from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { useAuth } from '../../contexts/AuthContext'
import { roleLabels } from '../../data/accounts'

export function ProfilePage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name ?? '')
  const [email, setEmail] = useState(user?.email ?? '')
  const [phone, setPhone] = useState('+62 812-3456-7890')
  const [message, setMessage] = useState('')

  if (!user) return null

  return (
    <div className="page">
      <PageHeader
        eyebrow="Settings"
        title="My Profile"
        subtitle="Informasi akun yang digunakan pada seluruh aktivitas produksi, material, dan inventory."
        meta={
          <span className="page-meta__item">
            <ShieldCheck size={12} /> Akun terverifikasi
          </span>
        }
      />

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
            <Badge tone="success" dot>
              Active
            </Badge>
          </div>
        </div>
        <Button variant="secondary" leftIcon={<BadgeCheck size={15} />}>
          Verifikasi akun
        </Button>
      </section>

      <div className="report-split">
        <section className="card settings-card">
          <div className="settings-card__head">
            <h3>Informasi pribadi</h3>
            <p>Perubahan akan tercatat pada audit log.</p>
          </div>
          <div className="form-grid">
            <Field label="Nama lengkap" htmlFor="profile-name">
              <input id="profile-name" className="input" value={name} onChange={(event) => setName(event.target.value)} />
            </Field>
            <Field label="Employee ID" htmlFor="profile-employee" hint="Tidak dapat diubah sendiri.">
              <input id="profile-employee" className="input" value={user.employeeId} readOnly />
            </Field>
            <Field label="Email" htmlFor="profile-email">
              <input id="profile-email" type="email" className="input" value={email} onChange={(event) => setEmail(event.target.value)} />
            </Field>
            <Field label="Nomor telepon" htmlFor="profile-phone">
              <input id="profile-phone" className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Area kerja" htmlFor="profile-area">
              <input id="profile-area" className="input" value={user.area} readOnly />
            </Field>
            <Field label="Line" htmlFor="profile-line">
              <input id="profile-line" className="input" value={user.line} readOnly />
            </Field>
          </div>
          <div className="form-actions">
            <Button variant="secondary">Batalkan</Button>
            <Button
              variant="primary"
              leftIcon={<Save size={15} />}
              onClick={() => setMessage('Profil berhasil diperbarui.')}
            >
              Simpan perubahan
            </Button>
          </div>
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
                  <Badge tone="success" dot>
                    Active
                  </Badge>
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Password terakhir diubah</span>
                <span className="info-value">28 Okt 2026</span>
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
                  <span>{email}</span>
                </div>
              </div>
              <div className="movement">
                <span className="movement__icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent-strong)' }}>
                  <Phone size={14} />
                </span>
                <div className="movement__copy">
                  <strong>Telepon</strong>
                  <span>{phone}</span>
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
