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
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { Field } from '../../components/ui/Field'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { roleLabels } from '../../data/accounts'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  createUser,
  deleteUser,
  listRoles,
  listUsers,
  listParts,
  updateUser,
  type MasterUser,
  type RoleOption,
  type UserStatus,
  type ProductionPartRecord,
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
  line: string
  initials: string
  status: UserStatus
  partNumbers: string[]
  shiftMode: 'rotating' | 'non_shift'
  shiftBase: 1 | 2
  shiftAnchorDate: string
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
    line: 'Robot G',
    initials: '',
    status: 'active',
    partNumbers: [],
    shiftMode: 'rotating',
    shiftBase: 1,
    shiftAnchorDate: currentWeekStart(),
  }
}

function currentWeekStart(): string {
  const date = new Date()
  date.setHours(0, 0, 0, 0)
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function isOperatorRole(role: Role): boolean {
  return role === 'operator_assy' || role === 'operator_sub_assy' || role === 'operator_both'
}

function compatibleParts(role: Role, parts: ProductionPartRecord[]): ProductionPartRecord[] {
  if (role === 'operator_assy') return parts.filter((part) => part.type === 'Assy')
  if (role === 'operator_sub_assy') return parts.filter((part) => part.type === 'Sub_Assy')
  if (role === 'operator_both') return parts
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
  const { confirm } = useConfirmation()
  const [users, setUsers] = useState<MasterUser[]>([])
  const [roles, setRoles] = useState<RoleOption[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [busyUserId, setBusyUserId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<UserFormState>(emptyForm)
  const [roleFilter, setRoleFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [skillSearch, setSkillSearch] = useState('')

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextUsers, nextRoles, nextParts] = await Promise.all([
        listUsers(),
        listRoles(),
        listParts(),
      ])
      setUsers(nextUsers)
      setRoles(nextRoles)
      setParts(nextParts)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data user gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

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

  const availableParts = useMemo(
    () => compatibleParts(form.role, parts),
    [form.role, parts],
  )
  const filteredSkillParts = useMemo(() => {
    const needle = skillSearch.trim().toLowerCase()
    return availableParts.filter((part) =>
      !needle ||
      [part.partNumber, part.line, part.process].some((value) => value.toLowerCase().includes(needle)),
    )
  }, [availableParts, skillSearch])

  const changeRole = (role: Role) => {
    const allowed = new Set(compatibleParts(role, parts).map((part) => part.partNumber))
    setForm((current) => ({
      ...current,
      role,
      partNumbers: current.partNumbers.filter((partNumber) => allowed.has(partNumber)),
    }))
  }

  const togglePart = (partNumber: string) => {
    setForm((current) => ({
      ...current,
      partNumbers: current.partNumbers.includes(partNumber)
        ? current.partNumbers.filter((number) => number !== partNumber)
        : [...current.partNumbers, partNumber],
    }))
  }

  function updateForm<K extends keyof UserFormState>(key: K, value: UserFormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
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
      line: user.line || user.area,
      initials: user.initials,
      status: user.status,
      partNumbers: user.partSkills.map((skill) => skill.part.partNumber),
      shiftMode: user.shiftMode,
      shiftBase: user.shiftBase,
      shiftAnchorDate: user.shiftAnchorDate ?? currentWeekStart(),
    })
    setSkillSearch('')
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
    if (!form.line.trim()) return 'Line wajib diisi.'

    if (isOperatorRole(form.role)) {
      if (availableParts.length === 0) {
        return 'Belum ada PN produksi yang sesuai role ini. Tambahkan part terlebih dahulu di Master Data → Part Number.'
      }
      if (form.partNumbers.length === 0) {
        return 'Pilih minimal satu PN yang dapat dikerjakan user.'
      }
    } else if (form.partNumbers.length > 0) {
      return 'Role non-operator tidak boleh memiliki skill PN produksi.'
    }
    if (form.shiftMode === 'rotating' && !form.shiftAnchorDate) {
      return 'Tanggal awal rotasi shift wajib diisi.'
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
          area: form.line.trim(),
          line: form.line.trim(),
          ...(form.initials.trim() ? { initials: form.initials.trim() } : {}),
          status: form.status,
          ...(form.password ? { password: form.password } : {}),
          partNumbers: isOperatorRole(form.role) ? form.partNumbers : [],
          shiftMode: form.shiftMode,
          shiftBase: form.shiftBase,
          shiftAnchorDate: form.shiftMode === 'rotating' ? form.shiftAnchorDate : null,
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
          area: form.line.trim(),
          line: form.line.trim(),
          ...(form.initials.trim() ? { initials: form.initials.trim() } : {}),
          status: form.status,
          partNumbers: isOperatorRole(form.role) ? form.partNumbers : [],
          shiftMode: form.shiftMode,
          shiftBase: form.shiftBase,
          ...(form.shiftMode === 'rotating' ? { shiftAnchorDate: form.shiftAnchorDate } : {}),
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
      !(await confirm({
        title: 'Nonaktifkan akun?',
        message: `Nonaktifkan akun ${user.name} (${user.employeeId})?`,
        confirmLabel: 'Nonaktifkan',
        tone: 'danger',
      }))
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
    if (user.role === 'admin' && administratorCount <= 1) {
      setError('Akun administrator terakhir tidak dapat dihapus. Tambahkan administrator lain terlebih dahulu.')
      setNotice('')
      return
    }
    if (
      !(await confirm({
        title: 'Hapus akun?',
        message: `Hapus akun ${user.name} (${user.employeeId})? Data yang sudah memiliki transaksi produksi tidak dapat dihapus.`,
        confirmLabel: 'Hapus akun',
        tone: 'danger',
      }))
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

  const administratorCount = users.filter((user) => user.role === 'admin').length

  const columns: Column<MasterUser>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div className="cell-stack user-list-cell">
          <span className="cell-main">{user.name}</span>
          <span className="cell-sub">{user.employeeId} · {user.username}</span>
          <div className="user-list-cell__meta">
            <Badge tone={user.role === 'admin' ? 'orange' : 'sky'}>
              {user.roleLabel || roleLabels[user.role]}
            </Badge>
            <StatusBadge status={user.status} />
          </div>
          <span className="cell-sub">
            {user.line} · {user.currentShift ? `Shift ${user.currentShift}` : 'Non-shift'} · Login {formatLastLogin(user.lastLogin)}
          </span>
        </div>
      ),
    },
    {
      key: 'skills',
      header: 'Skill PN',
      render: (user) => {
        if (user.partSkills.length === 0) {
          return <span className="muted small">Belum ada PN</span>
        }
        return (
          <details className="work-skill-list">
            <summary>
              <Badge tone="sky">{user.partSkills.length} skill</Badge>
              <span className="muted small">Lihat daftar</span>
            </summary>
            <div className="work-skill-list__items">
              {user.partSkills
                .slice()
                .sort((left, right) => left.part.partNumber.localeCompare(right.part.partNumber))
                .map(({ part }) => (
                  <span key={part.partNumber}>
                    <strong className="mono">{part.partNumber}</strong>
                    <small>{part.line} · {part.type === 'Sub_Assy' ? 'Sub Assy' : part.type.replace('_', ' ')}</small>
                  </span>
                ))}
            </div>
          </details>
        )
      },
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
            disabled={busyUserId === user.id || (user.role === 'admin' && administratorCount <= 1)}
            title={user.role === 'admin' && administratorCount <= 1
              ? 'Minimal harus ada satu akun administrator.'
              : undefined}
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
        subtitle="Kelola akun dan skill pengguna dalam satu daftar ringkas."
        meta={
          <>
            <span className="page-meta__item">
              <UsersRound size={12} /> {users.length} akun
            </span>
            <span className="page-meta__item">
              <MapPin size={12} /> {parts.length} PN untuk skill
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
          value={String(administratorCount)}
          suffix="akun"
          icon={ShieldCheck}
          tone="amber"
          note="Akses penuh"
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
            <Field label="Line / Area Kerja" htmlFor="user-line" hint="Area kerja sama dengan line, contoh: Robot G.">
              <input
                id="user-line"
                className="input"
                value={form.line}
                onChange={(event) => updateForm('line', event.target.value)}
                placeholder="Robot G"
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
                <h3 className="section-title">Skill produksi user</h3>
                <p className="section-sub">
                  Pilih PN yang boleh dikerjakan. Line, tipe, dan proses mengikuti master part.
                </p>
              </div>
              <Badge tone={isOperatorRole(form.role) ? 'sky' : 'neutral'}>
                {isOperatorRole(form.role) ? `${form.partNumbers.length} PN dipilih` : 'Tidak berlaku'}
              </Badge>
            </div>
            {!isOperatorRole(form.role) ? (
              <p className="muted small">Role non-operator tidak menggunakan skill produksi operator.</p>
            ) : availableParts.length > 0 ? (
              <>
                <SearchInput
                  value={skillSearch}
                  onChange={setSkillSearch}
                  placeholder="Cari PN, line, atau proses…"
                />
                <div className="stack-sm" style={{ maxHeight: 260, overflowY: 'auto', marginTop: 10 }}>
                  {filteredSkillParts.map((part) => (
                    <label className="checkbox" key={part.partNumber}>
                      <input
                        type="checkbox"
                        checked={form.partNumbers.includes(part.partNumber)}
                        onChange={() => togglePart(part.partNumber)}
                      />
                      <span>
                        <strong className="mono">{part.partNumber}</strong>{' '}
                        <span className="muted small">
                          ({part.line} · {part.process} · {part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'})
                        </span>
                      </span>
                    </label>
                  ))}
                  {filteredSkillParts.length === 0 && <span className="muted small">PN tidak ditemukan.</span>}
                </div>
              </>
            ) : (
              <Callout tone="warning">Belum ada part produksi yang sesuai role ini.</Callout>
            )}
          </section>

          <section className="card section-card" style={{ marginTop: 12 }}>
            <div className="section-head">
              <div>
                <h3 className="section-title">Shift kerja</h3>
                <p className="section-sub">Shift 1 dan 2 berganti otomatis tiap minggu sejak tanggal awal.</p>
              </div>
              <Badge tone={form.shiftMode === 'rotating' ? 'success' : 'neutral'}>
                {form.shiftMode === 'rotating' ? `Shift ${form.shiftBase} awal` : 'Non-shift'}
              </Badge>
            </div>
            <div className="form-grid">
              <Field label="Status shift" htmlFor="user-shift-mode">
                <select
                  id="user-shift-mode"
                  className="select"
                  value={form.shiftMode}
                  onChange={(event) => updateForm('shiftMode', event.target.value as UserFormState['shiftMode'])}
                >
                  <option value="rotating">Rotasi shift mingguan</option>
                  <option value="non_shift">Non-shift</option>
                </select>
              </Field>
              {form.shiftMode === 'rotating' && (
                <>
                  <Field label="Shift pada minggu awal" htmlFor="user-shift-base">
                    <select
                      id="user-shift-base"
                      className="select"
                      value={form.shiftBase}
                      onChange={(event) => updateForm('shiftBase', Number(event.target.value) as 1 | 2)}
                    >
                      <option value={1}>Shift 1</option>
                      <option value={2}>Shift 2</option>
                    </select>
                  </Field>
                  <Field label="Tanggal awal minggu" htmlFor="user-shift-anchor" hint="Gunakan tanggal Senin pada minggu shift awal.">
                    <input
                      id="user-shift-anchor"
                      className="input"
                      type="date"
                      value={form.shiftAnchorDate}
                      onChange={(event) => updateForm('shiftAnchorDate', event.target.value)}
                      required
                    />
                  </Field>
                </>
              )}
            </div>
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
        <div className="section-head">
          <div>
            <h2 className="section-title">Daftar user</h2>
            <p className="section-sub">Detail akun diringkas per user; buka daftar skill untuk melihat semua PN.</p>
          </div>
          <Badge tone="neutral">{rows.length} dari {users.length} user</Badge>
        </div>
        <div className="table-toolbar user-list-toolbar">
          <select
            className="select user-list-role-filter"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            aria-label="Filter role user"
          >
            <option value="all">Semua role</option>
            {(roles.length > 0
              ? roles
              : (Object.keys(roleLabels) as Role[]).map((role) => ({
                  role,
                  label: roleLabels[role],
                }))
            ).map((option) => (
              <option key={option.role} value={option.role}>{option.label}</option>
            ))}
          </select>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Cari nama, ID, username, line…"
            className="search-inline"
          />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.id}
          minWidth={760}
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
