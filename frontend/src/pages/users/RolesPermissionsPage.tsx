import { Check, Minus, ShieldCheck, SlidersHorizontal, UsersRound, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { StatCard } from '../../components/ui/StatCard'
import { permissionMatrix } from '../../data/mock'
import { roleLabels } from '../../data/accounts'
import { describeApiError } from '../../lib/api'
import { listUsers, type MasterUser } from '../../lib/masterApi'
import type { Role } from '../../types'

const roleOrder: Role[] = [
  'operator_assy',
  'operator_sub_assy',
  'operator_both',
  'leader',
  'admin',
  'management',
]
const roleTone: Record<Role, 'orange' | 'sky' | 'success' | 'warning' | 'neutral'> = {
  operator_assy: 'sky',
  operator_sub_assy: 'orange',
  operator_both: 'success',
  leader: 'orange',
  admin: 'warning',
  management: 'neutral',
}

function PermissionMark({ value }: { value: string }) {
  if (value === 'yes') {
    return (
      <span className="permission-mark permission-mark--yes" title="Diizinkan">
        <Check size={12} />
      </span>
    )
  }
  if (value === 'limited') {
    return (
      <span className="permission-mark permission-mark--limited" title="Terbatas">
        <Minus size={12} />
      </span>
    )
  }
  return (
    <span className="permission-mark permission-mark--no" title="Tidak diizinkan">
      <X size={12} />
    </span>
  )
}

export function RolesPermissionsPage() {
  const [users, setUsers] = useState<MasterUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    listUsers()
      .then((next) => {
        if (active) setUsers(next)
      })
      .catch((loadError) => {
        if (active) setError(describeApiError(loadError, 'Data user gagal dimuat.'))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  const usersForRole = (role: Role) => users.filter((user) => user.role === role)

  const columns: Column<(typeof permissionMatrix)[number]>[] = [
    {
      key: 'feature',
      header: 'Fitur',
      render: (row) => <span className="cell-main">{row.feature}</span>,
    },
    ...roleOrder.map((role) => ({
      key: role,
      header: roleLabels[role],
      align: 'center' as const,
      render: (row: (typeof permissionMatrix)[number]) => <PermissionMark value={row[role]} />,
    })),
  ]

  return (
    <div className="page">
      <PageHeader
        eyebrow="User Management"
        title="Roles & Permissions"
        subtitle="Matriks hak akses per role. Permission menentukan menu yang tampil, route yang dapat dibuka, dan aksi yang boleh dilakukan."
        meta={
          <>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> 6 role
            </span>
            <span className="page-meta__item">
              <SlidersHorizontal size={12} /> {permissionMatrix.length} fitur
            </span>
          </>
        }
        actions={<Badge tone="neutral">Read-only reference</Badge>}
      />

      {error && (
        <Callout tone="danger" title="Data user gagal dimuat">
          {error}
        </Callout>
      )}
      {loading && (
        <Callout tone="info">Memuat jumlah akun per role dari server…</Callout>
      )}
      <Callout tone="warning">Matriks berikut hanya referensi produk, bukan aturan yang dijalankan aplikasi. Aturan akses nyata mengikuti menu dan endpoint yang tersedia untuk tiap role.</Callout>

      <div className="kpi-grid kpi-grid--3">
        <StatCard label="Role terdefinisi" value="6" suffix="role" icon={ShieldCheck} tone="orange" note="Operator sampai management" />
        <StatCard label="Fitur dikontrol" value={String(permissionMatrix.length)} suffix="fitur" icon={SlidersHorizontal} tone="sky" note="Referensi produk" />
        <StatCard label="Akun terhubung" value={String(users.length)} suffix="akun" icon={UsersRound} tone="green" note="Aktif & inactive" />
      </div>

      <div className="device-grid">
        {roleOrder.map((role) => {
          const roleUsers = usersForRole(role)
          const count = roleUsers.length
          const user = roleUsers[0]
          return (
            <div className="device-card" key={role}>
              <div className="device-card__top">
                <div className="user-cell">
                  <Avatar initials={user?.initials ?? '—'} name={roleLabels[role]} tone={role === 'admin' ? 'orange' : 'sky'} size="sm" />
                  <div className="user-cell__copy">
                    <strong>{roleLabels[role]}</strong>
                    <span>{count} akun</span>
                  </div>
                </div>
                <Badge tone={roleTone[role]}>{role}</Badge>
              </div>
              <p style={{ marginTop: 10 }}>
                {role === 'operator_assy' && 'Antrian Assy, print kanban, input produksi, lihat jadwal.'}
                {role === 'operator_sub_assy' && 'Antrian Sub Assy, print kanban, input produksi, lihat jadwal.'}
                {role === 'operator_both' && 'Antrian dan produksi Assy serta Sub Assy Robot G.'}
                {role === 'leader' && 'Monitoring penuh, approval, master data, laporan.'}
                {role === 'admin' && 'Kelola sistem, alokasikan permintaan ke shift, dan pantau produksi; tidak dapat mencetak kanban atau input hasil produksi.'}
                {role === 'management' && 'Read-only dashboard dan seluruh laporan.'}
              </p>
              <div className="device-card__foot">
                <span>{permissionMatrix.filter((row) => row[role] === 'yes').length} akses penuh</span>
                <span>{permissionMatrix.filter((row) => row[role] === 'limited').length} terbatas</span>
              </div>
            </div>
          )
        })}
      </div>

      <section className="card">
        <div className="section-head">
          <div>
            <h2 className="section-title">Permission matrix</h2>
            <p className="section-sub">Centang penuh, minus terbatas, silang tidak diizinkan</p>
          </div>
          <div className="row row--wrap" style={{ gap: 10 }}>
            <span className="row" style={{ gap: 5 }}>
              <PermissionMark value="yes" /> <span className="muted small">Diizinkan</span>
            </span>
            <span className="row" style={{ gap: 5 }}>
              <PermissionMark value="limited" /> <span className="muted small">Terbatas</span>
            </span>
            <span className="row" style={{ gap: 5 }}>
              <PermissionMark value="no" /> <span className="muted small">Tidak</span>
            </span>
          </div>
        </div>
        <DataTable
          columns={columns}
          rows={permissionMatrix}
          rowKey={(row) => row.feature}
          minWidth={820}
          compact
          footer={
            <span className="muted small">
              Matriks ini referensi produk dan belum dapat diedit dari UI. Penegakan akses
              dilakukan oleh backend berdasarkan role akun.
            </span>
          }
        />
      </section>

      <Callout tone="info" title="Sumber data">
        Jumlah akun per role dibaca langsung dari tabel User. Untuk mengubah role atau area kerja
        user, gunakan menu User List. Matriks permission di atas hanya dokumentasi referensi.
      </Callout>

      <Callout tone="warning" title="Prinsip least privilege">
        Berikan akses minimum yang dibutuhkan. Perubahan pada role Admin sebaiknya disetujui dua
        orang dan dicatat pada audit log.
      </Callout>
    </div>
  )
}
