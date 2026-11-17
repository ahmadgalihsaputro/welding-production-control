import { MapPin, RefreshCw, ShieldCheck, UsersRound } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Callout } from '../../components/ui/Callout'
import { DataTable, type Column } from '../../components/ui/DataTable'
import { PageHeader } from '../../components/ui/PageHeader'
import { SearchInput } from '../../components/ui/SearchInput'
import { StatCard } from '../../components/ui/StatCard'
import { useConfirmation } from '../../contexts/ConfirmationContext'
import { describeApiError } from '../../lib/api'
import {
  listParts,
  listUsers,
  updateUser,
  type MasterUser,
  type ProductionPartRecord,
} from '../../lib/masterApi'

export function WorkAreasPage() {
  const { confirm } = useConfirmation()
  const [users, setUsers] = useState<MasterUser[]>([])
  const [parts, setParts] = useState<ProductionPartRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [search, setSearch] = useState('')
  const [skillSearch, setSkillSearch] = useState('')
  const [editingUser, setEditingUser] = useState<MasterUser | null>(null)
  const [selectedPartNumbers, setSelectedPartNumbers] = useState<string[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [nextUsers, nextParts] = await Promise.all([listUsers(), listParts()])
      setUsers(nextUsers)
      setParts(nextParts)
    } catch (loadError) {
      setError(describeApiError(loadError, 'Data skill user gagal dimuat.'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadData()
  }, [loadData])

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return users.filter((user) =>
      !needle ||
      [user.name, user.employeeId, user.username].some((value) => value.toLowerCase().includes(needle)) ||
      user.partSkills.some((skill) =>
        [skill.part.partNumber, skill.part.line].some((value) => value.toLowerCase().includes(needle)),
      ),
    )
  }, [users, search])

  const eligibleParts = useMemo(() => {
    if (!editingUser) return []
    const needle = skillSearch.trim().toLowerCase()
    return parts.filter((part) =>
      (part.type === 'Assy' || part.type === 'Sub_Assy') &&
      (!needle ||
        [part.partNumber, part.line, part.process].some((value) => value.toLowerCase().includes(needle))),
    )
  }, [editingUser, parts, skillSearch])

  const openEditor = (user: MasterUser) => {
    setEditingUser(user)
    setSelectedPartNumbers(user.partSkills.map((skill) => skill.part.partNumber))
    setSkillSearch('')
    setError('')
    setNotice('')
  }

  const closeEditor = () => {
    setEditingUser(null)
    setSelectedPartNumbers([])
    setSkillSearch('')
  }

  const togglePart = (partNumber: string) => {
    setSelectedPartNumbers((current) =>
      current.includes(partNumber)
        ? current.filter((value) => value !== partNumber)
        : [...current, partNumber],
    )
  }

  const saveSkills = async () => {
    if (!editingUser) return
    const confirmed = await confirm({
      title: 'Konfirmasi perubahan skill',
      message: `Simpan ${selectedPartNumbers.length} PN sebagai skill ${editingUser.name}?`,
      confirmLabel: 'Simpan skill',
    })
    if (!confirmed) return

    setSaving(true)
    setError('')
    setNotice('')
    try {
      await updateUser(editingUser.id, { partNumbers: selectedPartNumbers })
      setNotice(`Skill PN ${editingUser.name} berhasil diperbarui.`)
      closeEditor()
      await loadData()
    } catch (saveError) {
      setError(describeApiError(saveError, 'Skill user gagal disimpan.'))
    } finally {
      setSaving(false)
    }
  }

  const columns: Column<MasterUser>[] = [
    {
      key: 'user',
      header: 'User',
      render: (user) => (
        <div className="cell-stack">
          <span className="cell-main">{user.name}</span>
          <span className="cell-sub">{user.employeeId} · {user.roleLabel}</span>
        </div>
      ),
    },
    {
      key: 'skills',
      header: 'Skill line dan PN',
      render: (user) => user.partSkills.length > 0 ? (
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
                  <small>{part.line}</small>
                </span>
              ))}
          </div>
        </details>
      ) : <span className="muted small">Belum ada PN</span>,
    },
    {
      key: 'action',
      header: '',
      align: 'right',
      render: (user) => (
        <Button size="sm" variant="secondary" onClick={() => openEditor(user)}>
          Atur skill
        </Button>
      ),
    },
  ]

  const assignedUsers = users.filter((user) => user.partSkills.length > 0).length
  const lineCount = new Set(parts.map((part) => part.line)).size
  const skillCount = users.reduce((total, user) => total + user.partSkills.length, 0)

  return (
    <div className="page">
      <PageHeader
        eyebrow="Master Data"
        title="Working Area"
        subtitle="Atur kemampuan setiap user dengan memilih line dan part number dari master produksi."
        meta={
          <>
            <span className="page-meta__item"><UsersRound size={12} /> {users.length} user</span>
            <span className="page-meta__item"><MapPin size={12} /> {lineCount} line</span>
            <span className="page-meta__item"><ShieldCheck size={12} /> Admin only</span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            leftIcon={<RefreshCw size={15} />}
            loading={loading}
            onClick={() => void loadData()}
          >
            Muat ulang
          </Button>
        }
      />

      {error && <Callout tone="danger" title="Aksi gagal">{error}</Callout>}
      {notice && <Callout tone="success">{notice}</Callout>}
      {loading && users.length === 0 && <Callout tone="info">Memuat daftar user dan PN…</Callout>}

      <div className="kpi-grid">
        <StatCard label="Total user" value={String(users.length)} suffix="user" icon={UsersRound} tone="orange" />
        <StatCard label="User punya skill" value={String(assignedUsers)} suffix="user" icon={ShieldCheck} tone="green" />
        <StatCard label="Line terdaftar" value={String(lineCount)} suffix="line" icon={MapPin} tone="sky" />
        <StatCard label="Skill PN" value={String(skillCount)} suffix="relasi" icon={UsersRound} tone="amber" />
      </div>

      {editingUser && (
        <section className="card">
          <div className="section-head">
            <div>
              <h2 className="section-title">Skill {editingUser.name}</h2>
              <p className="section-sub">Pilih PN; line dan jenis part mengikuti data Master Part.</p>
            </div>
            <Badge tone="sky">{selectedPartNumbers.length} PN dipilih</Badge>
          </div>
          {eligibleParts.length > 0 ? (
            <>
              <SearchInput
                value={skillSearch}
                onChange={setSkillSearch}
                placeholder="Cari PN, line, atau proses…"
              />
              <div className="stack-sm" style={{ maxHeight: 360, overflowY: 'auto', marginTop: 12 }}>
                {eligibleParts.map((part) => (
                  <label className="checkbox" key={part.partNumber}>
                    <input
                      type="checkbox"
                      checked={selectedPartNumbers.includes(part.partNumber)}
                      onChange={() => togglePart(part.partNumber)}
                    />
                    <span>
                      <strong className="mono">{part.partNumber}</strong>{' '}
                      <span className="muted small">
                        ({part.line} · {part.type === 'Sub_Assy' ? 'Sub Assy' : 'Assy'})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          ) : (
            <Callout tone="warning">Belum ada part produksi yang sesuai role user.</Callout>
          )}
          <div className="form-actions">
            <Button variant="secondary" onClick={closeEditor} disabled={saving}>Batal</Button>
            <Button variant="primary" loading={saving} onClick={() => void saveSkills()}>Simpan skill</Button>
          </div>
        </section>
      )}

      <section className="card">
        <div className="table-toolbar">
          <div>
            <h2 className="section-title">Daftar user</h2>
            <p className="section-sub">Skill hanya bisa dipilih dari PN yang sudah terdaftar.</p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="Cari user atau PN…" className="search-inline" />
        </div>
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(user) => user.id}
          minWidth={720}
          footer={<span className="muted small">Menampilkan {rows.length} dari {users.length} user</span>}
        />
      </section>
    </div>
  )
}
