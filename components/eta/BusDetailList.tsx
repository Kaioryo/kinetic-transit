'use client'

import { useMemo } from 'react'
import { Shuttle, StopEta } from '@/lib/types'
import styles from './BusDetailList.module.css'

interface BusDetailListProps {
  shuttle: Shuttle
  stopEtas: StopEta[]
}

// Satu baris halte yang akan dilewati bus terpilih.
interface BusStopRow {
  stop_id: number
  stop_name: string
  eta_minutes: number | null
  distance_km: number
  status: 'on-time' | 'delayed' | 'arriving' | 'stopped'
  is_next: boolean
  just_passed: boolean
}

export default function BusDetailList({ shuttle, stopEtas }: BusDetailListProps) {
  // Rangkai daftar halte bus ini dari stopEtas: tiap arrival membawa shuttle_id,
  // jadi cukup ambil arrival yang cocok di tiap halte, lalu urutkan dari terdekat.
  const rows = useMemo<BusStopRow[]>(() => {
    const out: BusStopRow[] = []
    for (const se of stopEtas) {
      const a = se.arrivals.find((ar) => ar.shuttle_id === shuttle.id)
      if (!a) continue
      out.push({
        stop_id: se.stop_id,
        stop_name: se.stop_name,
        eta_minutes: a.eta_minutes,
        distance_km: a.distance_km,
        status: a.status,
        is_next: a.is_next,
        just_passed: a.just_passed,
      })
    }
    // Urut dari yang paling dekat (jarak sepanjang rute) → itulah halte berikutnya.
    return out.sort((x, y) => x.distance_km - y.distance_km)
  }, [stopEtas, shuttle.id])

  if (shuttle.is_stale) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>⚠️</span>
        <p className={styles.emptyText}>Sinyal bus terputus</p>
        <p className={styles.emptySubtext}>
          Posisi terakhir masih tampil di peta, tapi ETA tidak dapat dihitung sampai GPS kembali.
        </p>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🚌</span>
        <p className={styles.emptyText}>Belum ada data halte untuk bus ini</p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {rows.map((r, i) => (
        <div
          key={r.stop_id}
          className={`${styles.row} ${r.just_passed ? styles.rowPassed : ''} ${
            r.status === 'stopped' ? styles.rowStopped : ''
          }`}
          style={{ animationDelay: `${i * 40}ms` }}
        >
          <div className={styles.left}>
            <span className={styles.seq}>{i + 1}</span>
            <div className={styles.info}>
              <span className={styles.stopName}>
                {r.stop_name}
                {r.is_next && <span className={styles.nextBadge}>BERIKUTNYA</span>}
              </span>
              <span className={styles.meta}>
                {r.just_passed ? 'Baru dilewati' : `${r.distance_km} km`}
              </span>
            </div>
          </div>

          <div className={styles.right}>
            {r.status === 'stopped' ? (
              <span className={styles.stoppedLabel}>Berhenti</span>
            ) : (
              <>
                <span
                  className={styles.etaNumber}
                  style={{
                    color:
                      r.status === 'arriving'
                        ? 'var(--primary)'
                        : r.status === 'delayed'
                          ? 'var(--error)'
                          : 'var(--on-surface)',
                  }}
                >
                  {r.status === 'arriving' ? '~1' : r.eta_minutes}
                </span>
                <span className={styles.etaUnit}>{r.status === 'arriving' ? 'TIBA' : 'MNT'}</span>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
