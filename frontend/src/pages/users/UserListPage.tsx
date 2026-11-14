import {
  MapPin,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserCheck,
  UserRound,
  UsersRound,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { Tabs } from '../../components/ui/Tabs'
import { roleLabels } from '../../data/accounts'
import { describeApiError } from '../../lib/api'
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  listWorkAreas,
  updateUser,
  type MasterUser,
  type RoleOption,
  type UserStatus,
  type WorkAreaRecord,
} from '../../lib/masterApi'
import type { Role } from '../../types'

interface UserFormState {
  id: string | null
  name: string
  employeeId: string
  username: string
  email: string
  password: string
  role: Role
  area: string
  line: string
  initials: string
  status: UserStatus
  workAreaIds: string[]
}

function emptyForm(): UserFormState {
  return {
    id: null,
    name: '',
    employeeId: '',
    username: '',
    email: '',
    password: '',
    role: 'operator_assy',
    area: 'Welding — Robot G',
    line: 'Robot G',
    initials: '',
    status: 'active',
    workAreaIds: [],
  }
}

function isOperatorRole(role: Role): boolean {
  return role === 'operator_assy' || role === 'operator_sub_assy' || role === 'operator_both'
}

function compatibleWorkAreas(role: Role, areas: WorkAreaRecord[]): WorkAreaRecord[] {
  if (role === 'operator_assy') return areas.filter((area) => area.type === 'Assy')
  if (role === 'operator_sub_assy') return areas.filter((area) => area.type === 'Sub_Assy')
  if (role === 'operator_both') return areas
  return []
}

function formatLastLogin(value: string | null): string {
  if (!value) return 'Belum pernah'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Belum pernah'
  return new Intl.DateTimeFormat('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function UserListPage() {
  const [users, setUsers] = useState<MasterUser[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [workAreas, setWorkAreas] = useState<WorkAreaRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextUsers, nextRoles, nextAreas] = await Promise.all([
        listUsers(),
        listRoles(),
        listWorkAreas(),
      ])
      setUsers(nextUsers)
      setRoles(nextRoles)
      setWorkAreas(nextAreas)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data user gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const roleTabs = useMemo(
    () => [
      { value: 'all', label: 'Semua' },
      ...(roles.length > 0
        ? roles.map((role) => ({ value: role.role, label: role.label }))
        : (Object.keys(roleLabels) as Role[]).map((role) => ({
            value: role,
            label: roleLabels[role],
          }))),
    ],
    [roles],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users.filter(
      (user) =>
        (roleFilter === 'all' || user.role === roleFilter) &&
        (!needle ||
          [user.name, user.employeeId, user.username, user.area, user.line].some((value) =>
            value.toLowerCase().includes(needle),
          )),
    )
  }, [users, roleFilter, search])

  const availableWorkAreas = useMemo(
    () => compatibleWorkAreas(form.role, workAreas),
    [form.role, workAreas],
  )

  function updateForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const changeRole = (role: Role) => {
    setForm((current) => {
      const allowed = new Set(compatibleWorkAreas(role, workAreas).map((area) => area.id))
      return {
        ...current,
        role,
        workAreaIds: current.workAreaIds.filter((id) => allowed.has(id)),
      }
    })
  }

  const toggleWorkArea = (id: string) => {
    setForm((current) => ({
      ...current,
      workAreaIds: current.workAreaIds.includes(id)
        ? current.workAreaIds.filter((areaId) => areaId !== id)
        : [...current.workAreaIds, id],
    }))
  }

  const openAddForm = () => {
    setForm(emptyForm())
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const openEditForm = (user: MasterUser) => {
    setForm({
      id: user.id,
      name: user.name,
      employeeId: user.employeeId,
      username: user.username,
      email: user.email ?? '',
      password: '',
      role: user.role,
      area: user.area,
      line: user.line,
      initials: user.initials,
      status: user.status,
      workAreaIds: user.workAreas.map((assignment) => assignment.workAreaId),
    })
    setShowForm(true)
    setError('')
    setNotice('')
  }

  const closeForm = () => {
    setShowForm(false)
    setForm(emptyForm())
  }

  const validateForm = (): string | null => {
    if (!form.name.trim()) return 'Nama lengkap wajib diisi.'
    if (!form.id) {
      if (!form.employeeId.trim()) return 'Employee ID wajib diisi.'
      if (!form.username.trim()) return 'Username wajib diisi.'
      if (form.username.trim().length < 3) return 'Username minimal 3 karakter.'
      if (form.password.length < 8) return 'Password minimal 8 karakter.'
    } else if (form.password && form.password.length < 8) {
      return 'Password baru minimal 8 karakter.'
    }
    if (
      form.email.trim() &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
    ) {
      return 'Format email tidak valid.'
    }
    if (!form.area.trim()) return 'Area wajib diisi.'
    if (!form.line.trim()) return 'Line wajib diisi.'

    if (isOperatorRole(form.role)) {
      if (availableWorkAreas.length === 0) {
        return 'Belum ada area kerja yang sesuai role ini. Tambahkan area terlebih dahulu di Master Data → Work Area.'
      }
      if (form.workAreaIds.length === 0) {
        return 'Pilih minimal satu area kerja untuk akun operator.'
      }
    } else if (form.workAreaIds.length > 0) {
      return 'Role non-operator tidak boleh memiliki area kerja operator.'
    }
    return null
  }

  const saveUser = async () => {
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
      if (form.id) {
        await updateUser(form.id, {
          name: form.name.trim(),
          email: form.email.trim() || null,
          role: form.role,
          area: form.area.trim(),
          line: form.line.trim(),
          ...(form.initials.trim() ? { initials: form.initials.trim() } : {}),
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
          workAreaIds: isOperatorRole(form.role) ? form.workAreaIds : [],
        })
        setNotice('User berhasil diperbarui.')
      } else {
        await createUser({
          employeeId: form.employeeId.trim(),
          username: form.username.trim(),
          name: form.name.trim(),
          ...(form.email.trim() ? { email: form.email.trim() } : {}),
          password: form.password,
          role: form.role,
          area: form.area.trim(),
          line: form.line.trim(),
          ...(form.initials.trim() ? { initials: form.initials.trim() } : {}),
          status: form.status,
          workAreaIds: isOperatorRole(form.role) ? form.workAreaIds : [],
        })
        setNotice('User baru berhasil dibuat dan dapat langsung login.')
      }
      setShowForm(false)
      setForm(emptyForm())
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'User gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (user: MasterUser) => {
    const nextStatus: UserStatus = user.status === 'active' ? 'inactive' : 'active'
    if (
      nextStatus === 'inactive' &&
      !window.confirm(`Nonaktifkan akun ${user.name} (${user.employeeId})?`)
    ) {
      return
    }
    setBusyUserId(user.id)
    setError('')
    setNotice('')
    try {
      await updateUser(user.id, { status: nextStatus })
      setNotice(
        `${user.name} ${nextStatus === 'active' ? 'diaktifkan' : 'dinonaktifkan'}.`,
      )
      await loadData()
    } catch (statusError) {
      setError(describeApiError(statusError, 'Status user gagal diubah.'))
    } finally {
      setBusyUserId(null)
    }
  }

  const removeUser = async (user: MasterUser) => {
    if (
      !window.confirm(
        `Hapus akun ${user.name} (${user.employeeId})? Data yang sudah memiliki transaksi produksi tidak dapat dihapus.`,
      )
    ) {
      return
    }
    setBusyUserId(user.id)
    setError('')
    setNotice('')
    try {
      await deleteUser(user.id)
      setNotice(`Akun ${user.name} dihapus.`)
      await loadData()
    } catch (deleteError) {
      setError(describeApiError(deleteError, 'User gagal dihapus.'))
    } finally {
      setBusyUserId(null)
    }
  }

  const columns: Column<MasterUser>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div className="user-cell">
          <Avatar
            initials={user.initials}
            name={user.name}
            tone={user.role === 'admin' ? 'orange' : 'sky'}
            size="sm"
          />
          <div className="user-cell__copy">
            <strong>{user.name}</strong>
            <span>
              {user.employeeId} · {user.username}
            </span>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      render: (user) => (
        <Badge tone={user.role === 'admin' ? 'orange' : 'sky'}>
          {user.roleLabel || roleLabels[user.role]}
        </Badge>
      ),
    },
    {
      key: 'area',
      header: 'Area / Line',
      render: (user) => (
        <div className="cell-stack">
          <span className="cell-main">{user.area}</span>
          <span className="cell-sub">{user.line}</span>
        </div>
      ),
    },
    {
      key: 'workAreas',
      header: 'Area kerja',
      render: (user) => {
        if (user.workAreas.length === 0) {
          return <span className="muted small">—</span>
        }
        const labels = user.workAreas.map((assignment) => assignment.workArea.label)
        return (
          <div className="row row--wrap" style={{ gap: 4 }}>
            {labels.slice(0, 2).map((label) => (
              <Badge key={label} tone="sky">
                {label}
              </Badge>
            ))}
            {labels.length > 2 && <Badge tone="neutral">+{labels.length - 2}</Badge>}
          </div>
        )
      },
    },
    {
      key: 'lastLogin',
      header: 'Last login',
      render: (user) => (
        <span className="muted small">{formatLastLogin(user.lastLogin)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      render: (user) => <StatusBadge status={user.status} />,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (user) => (
        <div className="table-actions">
          <Button size="sm" variant="ghost" onClick={() => openEditForm(user)}>
            Edit
          </Button>
          <Button
            size="sm"
            variant="ghost"
            loading={busyUserId === user.id}
            onClick={() => void toggleStatus(user)}
          >
            {user.status === 'active' ? 'Nonaktifkan' : 'Aktifkan'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            disabled={busyUserId === user.id}
            onClick={() => void removeUser(user)}
          >
            Hapus
          </Button>
        </div>
      ),
    },
  ]

  const operatorCount = users.filter((user) => isOperatorRole(user.role)).length
  const activeCount = users.filter((user) => user.status === 'active').length

  return (
    <div className="page">
      <PageHeader
        eyebrow="User Management"
        title="User List"
        subtitle="Kelola akun pengguna, role, area kerja, dan status akses langsung dari database. Setiap operator hanya dapat mengakses area yang ditugaskan."
        meta={
          <>
            <span className="page-meta__item">
              <UsersRound size={12} /> {users.length} akun
            </span>
            <span className="page-meta__item">
              <MapPin size={12} /> {workAreas.length} area kerja
            </span>
            <span className="page-meta__item">
              <ShieldCheck size={12} /> Role based access
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              leftIcon={<RefreshCw size={15} />}
              loading={loading}
              onClick={() => void loadData()}
            >
              Muat ulang
            </Button>
            <Button variant="primary" leftIcon={<Plus size={15} />} onClick={openAddForm}>
              Tambah user
            </Button>
          </>
        }
      />

      {error && (
        <Callout tone="danger" title="Aksi gagal">
          {error}
        </Callout>
      )}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && users.length === 0 && (
        <Callout tone="info">Memuat data user dari server…</Callout>
      )}

      <div className="kpi-grid">
        <StatCard
          label="Total user"
          value={String(users.length)}
          suffix="akun"
          icon={UsersRound}
          tone="orange"
          note="Seluruh role"
        />
        <StatCard
          label="User aktif"
          value={String(activeCount)}
          suffix="akun"
          icon={UserCheck}
          tone="green"
          note="Dapat login"
        />
        <StatCard
          label="Operator"
          value={String(operatorCount)}
          suffix="akun"
          icon={UserRound}
          tone="sky"
          note="Assy, Sub Assy, dan gabungan"
        />
        <StatCard
          label="Administrator"
          value={String(users.filter((user) => user.role === 'admin').length)}
          suffix="akun"
          icon={ShieldCheck}
          tone="amber"
          note="Akses penuh"
        />
        <StatCard
          label="Area kerja"
          value={String(workAreas.length)}
          suffix="area"
          icon={MapPin}
          tone="green"
          note="Tersedia untuk operator"
        />
      </div>

      {showForm && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">
                {form.id ? 'Ubah user' : 'Akun baru'}
              </h2>
              <p className="section-sub">
                {form.id
                  ? 'Perbarui data akun. Employee ID dan username tidak dapat diubah.'
                  : 'Akun yang dibuat di sini langsung tersimpan di database dan dapat dipakai login.'}
              </p>
            </div>
            <Badge tone="success">Terhubung database</Badge>
          </div>

          <div className="form-grid">
            <Field label="Nama lengkap" htmlFor="user-name">
              <input
                id="user-name"
                className="input"
                value={form.name}
                onChange={(event) => updateForm('name', event.target.value)}
                placeholder="Nama karyawan"
              />
            </Field>
            <Field label="Employee ID" htmlFor="user-employee" hint="Dibuat sekali, tidak dapat diubah.">
              <input
                id="user-employee"
                className="input"
                value={form.employeeId}
                onChange={(event) => updateForm('employeeId', event.target.value)}
                placeholder="Contoh: OP021"
                disabled={Boolean(form.id)}
              />
            </Field>
            <Field label="Username" htmlFor="user-username" hint="Minimal 3 karakter, unik.">
              <input
                id="user-username"
                className="input"
                value={form.username}
                onChange={(event) => updateForm('username', event.target.value)}
                placeholder="Contoh: operator.assy2"
                autoComplete="off"
                disabled={Boolean(form.id)}
              />
            </Field>
            <Field label="Email" htmlFor="user-email" hint="Opsional.">
              <input
                id="user-email"
                className="input"
                type="email"
                value={form.email}
                onChange={(event) => updateForm('email', event.target.value)}
                placeholder="nama@perusahaan.com"
              />
            </Field>
            <Field
              label={form.id ? 'Password baru' : 'Password'}
              htmlFor="user-password"
              hint={form.id ? 'Kosongkan bila tidak ingin mengganti password.' : 'Minimal 8 karakter.'}
            >
              <input
                id="user-password"
                className="input"
                type="password"
                value={form.password}
                onChange={(event) => updateForm('password', event.target.value)}
                placeholder={form.id ? '••••••••' : 'Minimal 8 karakter'}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Role" htmlFor="user-role">
              <select
                id="user-role"
                className="select"
                value={form.role}
                onChange={(event) => changeRole(event.target.value as Role)}
              >
                {(roles.length > 0
                  ? roles
                  : (Object.keys(roleLabels) as Role[]).map((role) => ({
                      role,
                      label: roleLabels[role],
                    }))
                ).map((option) => (
                  <option key={option.role} value={option.role}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Status akun" htmlFor="user-status">
              <select
                id="user-status"
                className="select"
                value={form.status}
                onChange={(event) => updateForm('status', event.target.value as UserStatus)}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </Field>
            <Field label="Area" htmlFor="user-area" hint="Deskripsi penempatan kerja.">
              <input
                id="user-area"
                className="input"
                value={form.area}
                onChange={(event) => updateForm('area', event.target.value)}
                placeholder="Contoh: Welding — Robot G"
              />
            </Field>
            <Field label="Line" htmlFor="user-line" hint="Contoh: Robot G, Robot H, atau All lines.">
              <input
                id="user-line"
                className="input"
                value={form.line}
                onChange={(event) => updateForm('line', event.target.value)}
                placeholder="Contoh: Robot G"
              />
            </Field>
            <Field label="Initials" htmlFor="user-initials" hint="Maksimal 4 karakter, opsional.">
              <input
                id="user-initials"
                className="input"
                value={form.initials}
                onChange={(event) => updateForm('initials', event.target.value)}
                placeholder="Contoh: AS"
                maxLength={4}
              />
            </Field>
          </div>

          <section className="card section-card" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div>
                <h3 className="section-title">Area kerja yang diizinkan</h3>
                <p className="section-sub">
                  Role membatasi jenis pekerjaan; pilihan di bawah membatasi proses/line operator.
                </p>
              </div>
              <Badge tone={isOperatorRole(form.role) ? 'sky' : 'neutral'}>
                {isOperatorRole(form.role)
                  ? `${form.workAreaIds.length} dipilih`
                  : 'Tidak berlaku'}
              </Badge>
            </div>
            {!isOperatorRole(form.role) ? (
              <p className="muted small">
                Role non-operator tidak menggunakan pemilihan area produksi operator.
              </p>
            ) : availableWorkAreas.length > 0 ? (
              <div className="stack-sm">
                {availableWorkAreas.map((area) => (
                  <label className="checkbox" key={area.id}>
                    <input
                      type="checkbox"
                      checked={form.workAreaIds.includes(area.id)}
                      onChange={() => toggleWorkArea(area.id)}
                    />
                    <span>
                      {area.label}{' '}
                      <span className="muted small">
                        ({area.line} · {area.process})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <Callout tone="warning">
                Belum ada area kerja yang sesuai dengan role ini.{' '}
                <Link to="/master/work-areas" style={{ textDecoration: 'underline' }}>
                  Kelola Work Area
                </Link>
              </Callout>
            )}
          </section>

          <div className="form-actions">
            <Button variant="secondary" onClick={closeForm} disabled={saving}>
              Batal
            </Button>
            <Button
              variant="primary"
              leftIcon={<Plus size={15} />}
              loading={saving}
              onClick={() => void saveUser()}
            >
              {form.id ? 'Simpan perubahan' : 'Simpan user'}
            </Button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <Tabs items={roleTabs} value={roleFilter} onChange={setRoleFilter} ariaLabel="Filter role user" />
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, ID, username, area…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.id}
          minWidth={1080}
          footer={
            <span className="muted small">
              Menampilkan {rows.length} dari {users.length} akun
            </span>
          }
        />
      </section>
    </div>
  )
}
