'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { PinIcon } from '@/components/icons/Icons'
import styles from './page.module.css'

// Lazy-load map agar tidak SSR
const AdminMap = dynamic(() => import('./AdminMap'), { ssr: false, loading: () => <div className={styles.mapPlaceholder}>Memuat peta...</div> })

// ── Types ──────────────────────────────────────────────────────────────────
type Stop = { id: number; name: string; latitude: number | string; longitude: number | string }
type Bus  = { id: number; name: string; license_plate: string; status: string }
type Route = { id: number; name: string }
type Trip = {
  id: number
  bus_id: number
  bus_name: string
  license_plate: string
  route_id: number
  route_name: string
  status: string
  started_at: string | null
  ended_at: string | null
}

// ── Komponen Utama ─────────────────────────────────────────────────────────
export default function AdminDashboard() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'stops' | 'buses' | 'trips'>('stops')

  // Data
  const [stops,  setStops]  = useState<Stop[]>([])
  const [buses,  setBuses]  = useState<Bus[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [trips,  setTrips]  = useState<Trip[]>([])
  const [loading, setLoading] = useState(true)

  // Form Perjalanan
  const [tripForm, setTripForm] = useState({ bus_id: '', route_id: '' })
  const [tripMsg,  setTripMsg]  = useState('')

  // Form Halte
  const [stopForm, setStopForm] = useState({ name: '', latitude: '', longitude: '', route_id: '', stop_order: '' })
  const [editStop, setEditStop] = useState<Stop | null>(null)
  const [stopMsg,  setStopMsg]  = useState('')

  // Form Bus
  const [busForm, setBusForm] = useState({ name: '', license_plate: '', status: 'active' })
  const [editBus, setEditBus] = useState<Bus | null>(null)
  const [busMsg,  setBusMsg]  = useState('')

  // Modal konfirmasi hapus
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'stop' | 'bus'; id: number; name: string } | null>(null)

  // Koordinat yang diklik di peta (untuk form tambah halte)
  const [pickedCoord, setPickedCoord] = useState<{ lat: number; lng: number } | null>(null)

  // ── Fetch Data ────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [sRes, bRes, rRes, tRes] = await Promise.all([
        fetch('/api/admin/stops'),
        fetch('/api/admin/buses'),
        fetch('/api/live'),
        fetch('/api/admin/trips'),
      ])
      if (sRes.status === 401 || bRes.status === 401) { router.push('/admin'); return }
      const [sData, bData, rData, tData] = await Promise.all([sRes.json(), bRes.json(), rRes.json(), tRes.json()])
      setStops(sData)
      setBuses(bData)
      setTrips(Array.isArray(tData) ? tData : [])
      // Ambil data rute dari /api/live (stops sudah include route info)
      const uniqueRoutes: Route[] = []
      const seen = new Set<number>()
      ;(sData as Array<{ route_stops: Array<{ routes: Route }> }>).forEach(s => {
        s.route_stops?.forEach(rs => {
          if (!seen.has(rs.routes.id)) { seen.add(rs.routes.id); uniqueRoutes.push(rs.routes) }
        })
      })
      // Fallback: ambil dari live API jika ada
      if (uniqueRoutes.length === 0 && rData.shuttles) {
        rData.shuttles.forEach((sh: { route_id: number; route_name: string }) => {
          if (!seen.has(sh.route_id)) { seen.add(sh.route_id); uniqueRoutes.push({ id: sh.route_id, name: sh.route_name }) }
        })
      }
      setRoutes(uniqueRoutes.length > 0 ? uniqueRoutes : [
        { id: 1, name: 'Jalur A (IPA/Saintek)' },
        { id: 2, name: 'Jalur B (IPS/Soshum)' },
        { id: 3, name: 'Jalur C (Tengah)' },
      ])
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { fetchAll() }, [fetchAll])

  // Sync koordinat klik peta ke form
  useEffect(() => {
    if (pickedCoord) {
      setStopForm(f => ({ ...f, latitude: pickedCoord.lat.toFixed(6), longitude: pickedCoord.lng.toFixed(6) }))
    }
  }, [pickedCoord])

  // ── Logout ────────────────────────────────────────────────────────────────
  async function handleLogout() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push('/admin')
  }

  // ── CRUD Halte ────────────────────────────────────────────────────────────
  async function handleSaveStop(e: React.FormEvent) {
    e.preventDefault()
    setStopMsg('')
    const payload = editStop
      ? { name: stopForm.name, latitude: stopForm.latitude, longitude: stopForm.longitude }
      : stopForm

    const res = await fetch(editStop ? `/api/admin/stops/${editStop.id}` : '/api/admin/stops', {
      method: editStop ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) {
      setStopMsg(editStop ? 'Halte berhasil diperbarui.' : 'Halte berhasil ditambahkan.')
      setStopForm({ name: '', latitude: '', longitude: '', route_id: '', stop_order: '' })
      setEditStop(null)
      setPickedCoord(null)
      fetchAll()
    } else {
      const d = await res.json()
      setStopMsg(`Error: ${d.error}`)
    }
  }

  function startEditStop(s: Stop) {
    setEditStop(s)
    setStopForm({ name: s.name, latitude: String(s.latitude), longitude: String(s.longitude), route_id: '', stop_order: '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── CRUD Bus ──────────────────────────────────────────────────────────────
  async function handleSaveBus(e: React.FormEvent) {
    e.preventDefault()
    setBusMsg('')
    const res = await fetch(editBus ? `/api/admin/buses/${editBus.id}` : '/api/admin/buses', {
      method: editBus ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(busForm),
    })
    if (res.ok) {
      setBusMsg(editBus ? 'Bus berhasil diperbarui.' : 'Bus berhasil ditambahkan.')
      setBusForm({ name: '', license_plate: '', status: 'active' })
      setEditBus(null)
      fetchAll()
    } else {
      const d = await res.json()
      setBusMsg(`Error: ${d.error}`)
    }
  }

  function startEditBus(b: Bus) {
    setEditBus(b)
    setBusForm({ name: b.name, license_plate: b.license_plate, status: b.status })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Perjalanan (Trip) ─────────────────────────────────────────────────────
  async function handleStartTrip(e: React.FormEvent) {
    e.preventDefault()
    setTripMsg('')
    const res = await fetch('/api/admin/trips', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tripForm),
    })
    if (res.ok) {
      setTripMsg('Perjalanan dimulai. Bus akan muncul di peta begitu GPS-nya masuk.')
      setTripForm({ bus_id: '', route_id: '' })
      fetchAll()
    } else {
      const d = await res.json()
      setTripMsg(`Error: ${d.error}`)
    }
  }

  async function handleEndTrip(tripId: number) {
    setTripMsg('')
    const res = await fetch(`/api/admin/trips/${tripId}`, { method: 'PATCH' })
    if (res.ok) {
      setTripMsg('Perjalanan diakhiri. Bus tidak lagi ditampilkan ke penumpang.')
      fetchAll()
    } else {
      const d = await res.json()
      setTripMsg(`Error: ${d.error}`)
    }
  }

  // ── Hapus ─────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!deleteTarget) return
    const url = deleteTarget.type === 'stop'
      ? `/api/admin/stops/${deleteTarget.id}`
      : `/api/admin/buses/${deleteTarget.id}`
    await fetch(url, { method: 'DELETE' })
    setDeleteTarget(null)
    fetchAll()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={styles.page}>
      {/* ── Header ── */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.headerIcon}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="11" width="18" height="11" rx="2" stroke="currentColor" strokeWidth="2"/>
              <path d="M7 11V7C7 4.79 9.24 3 12 3C14.76 3 17 4.79 17 7V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.headerTitle}>Admin Panel</h1>
            <p className={styles.headerSubtitle}>Kinetic Transit</p>
          </div>
        </div>
        <div className={styles.headerRight}>
          <Link href="/admin/history" className={styles.linkBtn}>Riwayat</Link>
          <Link href="/" className={styles.linkBtn}>Lihat Peta</Link>
          <button onClick={handleLogout} className={styles.logoutBtn}>Logout</button>
        </div>
      </header>

      <main className={styles.main}>
        {/* ── Tab Switcher ── */}
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${activeTab === 'stops' ? styles.tabActive : ''}`} onClick={() => setActiveTab('stops')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.13 2 5 5.13 5 9C5 14.25 12 22 12 22C12 22 19 14.25 19 9C19 5.13 15.87 2 12 2Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
              <circle cx="12" cy="9" r="2.5" stroke="currentColor" strokeWidth="2"/>
            </svg>
            Halte ({stops.length})
          </button>
          <button className={`${styles.tab} ${activeTab === 'buses' ? styles.tabActive : ''}`} onClick={() => setActiveTab('buses')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M4 15V8.5C4 5.46 6.46 3 9.5 3H14.5C17.54 3 20 5.46 20 8.5V15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <path d="M4 15C4 16.1 4.9 17 6 17H18C19.1 17 20 16.1 20 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="8" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="16" cy="19" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M4 11H20" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            Bus ({buses.length})
          </button>
          <button className={`${styles.tab} ${activeTab === 'trips' ? styles.tabActive : ''}`} onClick={() => setActiveTab('trips')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"/>
              <path d="M12 7V12L15 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Perjalanan ({trips.filter(t => t.status === 'active').length} aktif)
          </button>
        </div>

        {/* ══ TAB HALTE ══════════════════════════════════════════════════════ */}
        {activeTab === 'stops' && (
          <div className={styles.tabContent}>
            {/* Form Tambah / Edit Halte */}
            <section className={styles.formSection}>
              <h2 className={styles.sectionTitle}>
                {editStop ? `Edit Halte: ${editStop.name}` : 'Tambah Halte Baru'}
              </h2>

              <form onSubmit={handleSaveStop} className={styles.form}>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Nama Halte <span className={styles.required}>*</span></label>
                    <input
                      className={styles.input}
                      placeholder="Contoh: Halte FMIPA (A04)"
                      value={stopForm.name}
                      onChange={e => setStopForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Latitude <span className={styles.required}>*</span></label>
                    <input
                      className={styles.input}
                      placeholder="-6.927571"
                      type="number"
                      step="any"
                      value={stopForm.latitude}
                      onChange={e => setStopForm(f => ({ ...f, latitude: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Longitude <span className={styles.required}>*</span></label>
                    <input
                      className={styles.input}
                      placeholder="107.772909"
                      type="number"
                      step="any"
                      value={stopForm.longitude}
                      onChange={e => setStopForm(f => ({ ...f, longitude: e.target.value }))}
                      required
                    />
                  </div>

                  {!editStop && (
                    <>
                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Masukkan ke Jalur</label>
                        <select
                          className={styles.input}
                          value={stopForm.route_id}
                          onChange={e => setStopForm(f => ({ ...f, route_id: e.target.value }))}
                        >
                          <option value="">-- Tidak assign ke jalur --</option>
                          {routes.map(r => (
                            <option key={r.id} value={r.id}>{r.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className={styles.inputGroup}>
                        <label className={styles.label}>Urutan ke-</label>
                        <input
                          className={styles.input}
                          placeholder="Contoh: 5"
                          type="number"
                          min="1"
                          value={stopForm.stop_order}
                          onChange={e => setStopForm(f => ({ ...f, stop_order: e.target.value }))}
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Peta klik untuk isi koordinat */}
                {!editStop && (
                  <div className={styles.mapHint}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2"/>
                      <path d="M12 8V12M12 16H12.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                    Klik pada peta di bawah untuk mengisi Latitude & Longitude secara otomatis
                    {pickedCoord && (
                      <span className={styles.coordBadge}>
                        <PinIcon size={12} /> {pickedCoord.lat.toFixed(6)}, {pickedCoord.lng.toFixed(6)}
                      </span>
                    )}
                  </div>
                )}

                {stopMsg && (
                  <p className={`${styles.msg} ${stopMsg.startsWith('Error') ? styles.msgError : styles.msgSuccess}`}>
                    {stopMsg}
                  </p>
                )}

                <div className={styles.formActions}>
                  {editStop && (
                    <button type="button" className={styles.cancelBtn} onClick={() => { setEditStop(null); setStopForm({ name: '', latitude: '', longitude: '', route_id: '', stop_order: '' }) }}>
                      Batal
                    </button>
                  )}
                  <button type="submit" className={styles.saveBtn}>
                    {editStop ? 'Simpan Perubahan' : 'Tambah Halte'}
                  </button>
                </div>
              </form>

              {/* Peta klik koordinat — hanya tampil saat tambah baru */}
              {!editStop && (
                <div className={styles.mapWrapper}>
                  <AdminMap stops={stops} onMapClick={(lat, lng) => setPickedCoord({ lat, lng })} pickedCoord={pickedCoord} />
                </div>
              )}
            </section>

            {/* Tabel Daftar Halte */}
            <section className={styles.tableSection}>
              <h2 className={styles.sectionTitle}>Daftar Halte ({stops.length})</h2>
              {loading ? (
                <div className={styles.loadingRow}>Memuat data...</div>
              ) : stops.length === 0 ? (
                <div className={styles.emptyRow}>Belum ada halte.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nama Halte</th>
                        <th>Latitude</th>
                        <th>Longitude</th>
                        <th>Jalur</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stops.map(s => (
                        <tr key={s.id}>
                          <td className={styles.tdId}>{s.id}</td>
                          <td className={styles.tdName}>{s.name}</td>
                          <td className={styles.tdCoord}>{Number(s.latitude).toFixed(6)}</td>
                          <td className={styles.tdCoord}>{Number(s.longitude).toFixed(6)}</td>
                          <td>
                            {(s as Stop & { route_stops?: Array<{ routes: Route; stop_order: number }> }).route_stops?.map(rs => (
                              <span key={`${rs.routes.id}-${rs.stop_order}`} className={styles.routeBadge}>
                                {rs.routes.name.replace('Jalur ', '')} #{rs.stop_order}
                              </span>
                            )) || '—'}
                          </td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button className={styles.editBtn} onClick={() => startEditStop(s)}>Edit</button>
                              <button className={styles.deleteBtn} onClick={() => setDeleteTarget({ type: 'stop', id: s.id, name: s.name })}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══ TAB BUS ════════════════════════════════════════════════════════ */}
        {activeTab === 'buses' && (
          <div className={styles.tabContent}>
            {/* Form Tambah / Edit Bus */}
            <section className={styles.formSection}>
              <h2 className={styles.sectionTitle}>
                {editBus ? `Edit Bus: ${editBus.name}` : 'Tambah Bus Baru'}
              </h2>

              <form onSubmit={handleSaveBus} className={styles.form}>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Nama Bus <span className={styles.required}>*</span></label>
                    <input
                      className={styles.input}
                      placeholder="Contoh: Odong-odong B"
                      value={busForm.name}
                      onChange={e => setBusForm(f => ({ ...f, name: e.target.value }))}
                      required
                    />
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Plat Nomor <span className={styles.required}>*</span></label>
                    <input
                      className={styles.input}
                      placeholder="Contoh: D 5678 CD"
                      value={busForm.license_plate}
                      onChange={e => setBusForm(f => ({ ...f, license_plate: e.target.value }))}
                      required
                    />
                    <p className={styles.hint}>Harus sama persis dengan plat yang di-hardcode di ESP32</p>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Status</label>
                    <select
                      className={styles.input}
                      value={busForm.status}
                      onChange={e => setBusForm(f => ({ ...f, status: e.target.value }))}
                    >
                      <option value="active">Aktif</option>
                      <option value="inactive">Nonaktif</option>
                      <option value="maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>

                {busMsg && (
                  <p className={`${styles.msg} ${busMsg.startsWith('Error') ? styles.msgError : styles.msgSuccess}`}>
                    {busMsg}
                  </p>
                )}

                <div className={styles.formActions}>
                  {editBus && (
                    <button type="button" className={styles.cancelBtn} onClick={() => { setEditBus(null); setBusForm({ name: '', license_plate: '', status: 'active' }) }}>
                      Batal
                    </button>
                  )}
                  <button type="submit" className={styles.saveBtn}>
                    {editBus ? 'Simpan Perubahan' : 'Tambah Bus'}
                  </button>
                </div>
              </form>
            </section>

            {/* Tabel Daftar Bus */}
            <section className={styles.tableSection}>
              <h2 className={styles.sectionTitle}>Daftar Bus ({buses.length})</h2>
              {loading ? (
                <div className={styles.loadingRow}>Memuat data...</div>
              ) : buses.length === 0 ? (
                <div className={styles.emptyRow}>Belum ada bus.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Nama Bus</th>
                        <th>Plat Nomor</th>
                        <th>Status</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buses.map(b => (
                        <tr key={b.id}>
                          <td className={styles.tdId}>{b.id}</td>
                          <td className={styles.tdName}>{b.name}</td>
                          <td><code className={styles.plateCode}>{b.license_plate}</code></td>
                          <td>
                            {(() => {
                              const statusClass: Record<string, string> = {
                                active: styles.status_active,
                                inactive: styles.status_inactive,
                                maintenance: styles.status_maintenance,
                              }
                              return (
                                <span className={`${styles.statusBadge} ${statusClass[b.status] ?? ''}`}>
                                  {b.status}
                                </span>
                              )
                            })()}
                          </td>
                          <td>
                            <div className={styles.actionBtns}>
                              <button className={styles.editBtn} onClick={() => startEditBus(b)}>Edit</button>
                              <button className={styles.deleteBtn} onClick={() => setDeleteTarget({ type: 'bus', id: b.id, name: b.name })}>Hapus</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}

        {/* ══ TAB PERJALANAN ═════════════════════════════════════════════════ */}
        {activeTab === 'trips' && (
          <div className={styles.tabContent}>
            {/* Mulai Perjalanan Baru */}
            <section className={styles.formSection}>
              <h2 className={styles.sectionTitle}>Mulai Perjalanan Baru</h2>
              <p className={styles.hint} style={{ marginBottom: '1rem' }}>
                Bus hanya tampil ke penumpang kalau punya perjalanan <strong>aktif</strong>.
                Tanpa ini, GPS dari ESP32 tetap tersimpan tapi bus tidak muncul di peta maupun ETA.
              </p>

              <form onSubmit={handleStartTrip} className={styles.form}>
                <div className={styles.formGrid}>
                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Bus <span className={styles.required}>*</span></label>
                    <select
                      className={styles.input}
                      value={tripForm.bus_id}
                      onChange={e => setTripForm(f => ({ ...f, bus_id: e.target.value }))}
                      required
                    >
                      <option value="">-- Pilih bus --</option>
                      {buses.map(b => (
                        <option key={b.id} value={b.id}>{b.name} ({b.license_plate})</option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.inputGroup}>
                    <label className={styles.label}>Jalur <span className={styles.required}>*</span></label>
                    <select
                      className={styles.input}
                      value={tripForm.route_id}
                      onChange={e => setTripForm(f => ({ ...f, route_id: e.target.value }))}
                      required
                    >
                      <option value="">-- Pilih jalur --</option>
                      {routes.map(r => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {tripMsg && (
                  <p className={`${styles.msg} ${tripMsg.startsWith('Error') ? styles.msgError : styles.msgSuccess}`}>
                    {tripMsg}
                  </p>
                )}

                <div className={styles.formActions}>
                  <button type="submit" className={styles.saveBtn}>Mulai Perjalanan</button>
                </div>
              </form>
            </section>

            {/* Daftar Perjalanan */}
            <section className={styles.tableSection}>
              <h2 className={styles.sectionTitle}>
                Perjalanan ({trips.filter(t => t.status === 'active').length} aktif)
              </h2>
              {loading ? (
                <div className={styles.loadingRow}>Memuat data...</div>
              ) : trips.length === 0 ? (
                <div className={styles.emptyRow}>Belum ada perjalanan.</div>
              ) : (
                <div className={styles.tableWrapper}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Bus</th>
                        <th>Jalur</th>
                        <th>Status</th>
                        <th>Mulai</th>
                        <th>Aksi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trips.map(t => (
                        <tr key={t.id}>
                          <td className={styles.tdId}>{t.id}</td>
                          <td className={styles.tdName}>
                            {t.bus_name}
                            <br />
                            <code className={styles.plateCode}>{t.license_plate}</code>
                          </td>
                          <td>{t.route_name}</td>
                          <td>
                            <span className={`${styles.statusBadge} ${t.status === 'active' ? styles.status_active : styles.status_inactive}`}>
                              {t.status}
                            </span>
                          </td>
                          <td className={styles.tdCoord}>
                            {t.started_at ? new Date(t.started_at).toLocaleString('id-ID') : '—'}
                          </td>
                          <td>
                            {t.status === 'active' ? (
                              <button className={styles.deleteBtn} onClick={() => handleEndTrip(t.id)}>
                                Akhiri
                              </button>
                            ) : (
                              <span style={{ opacity: 0.4 }}>—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      {/* ── Modal Konfirmasi Hapus ── */}
      {deleteTarget && (
        <>
          <div className={styles.modalBackdrop} onClick={() => setDeleteTarget(null)} />
          <div className={styles.modal}>
            <div className={styles.modalIcon}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M3 6H21M8 6V4H16V6M19 6L18.2 19.1C18.1 20.2 17.1 21 16 21H8C6.9 21 5.9 20.2 5.8 19.1L5 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h3 className={styles.modalTitle}>Hapus {deleteTarget.type === 'stop' ? 'Halte' : 'Bus'}?</h3>
            <p className={styles.modalBody}>
              <strong>{deleteTarget.name}</strong> akan dihapus permanen dari database.
              {deleteTarget.type === 'stop' && ' Halte ini juga akan dihapus dari semua jalur rute.'}
              {deleteTarget.type === 'bus' && ' Trip aktif bus ini akan diakhiri.'}
            </p>
            <div className={styles.modalActions}>
              <button className={styles.cancelBtn} onClick={() => setDeleteTarget(null)}>Batal</button>
              <button className={styles.deleteConfirmBtn} onClick={confirmDelete}>Ya, Hapus</button>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
