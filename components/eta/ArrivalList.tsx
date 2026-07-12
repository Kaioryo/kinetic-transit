'use client'

import { StopEta } from '@/lib/types'
import ArrivalCard from './ArrivalCard'
import styles from './ArrivalList.module.css'

interface ArrivalListProps {
  /** Kedatangan untuk halte yang sedang dipilih. null = halte belum dipilih. */
  stopEta: StopEta | null
  /** true kalau sebuah halte sudah dipilih tapi tidak ada bus menuju ke sana. */
  hasSelectedStop: boolean
}

export default function ArrivalList({ stopEta, hasSelectedStop }: ArrivalListProps) {
  // Belum ada halte dipilih (menunggu lokasi / user belum pilih).
  if (!hasSelectedStop) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>📍</span>
        <p className={styles.emptyText}>Menentukan halte terdekat…</p>
        <p className={styles.emptySubtext}>
          Izinkan akses lokasi, atau pilih halte lewat tombol Ganti
        </p>
      </div>
    )
  }

  // Halte dipilih, tapi tidak ada bus aktif yang menuju ke sana.
  if (!stopEta || stopEta.arrivals.length === 0) {
    return (
      <div className={styles.empty}>
        <span className={styles.emptyIcon}>🚏</span>
        <p className={styles.emptyText}>Belum ada bus menuju halte ini</p>
        <p className={styles.emptySubtext}>
          Tidak ada bus yang sedang beroperasi di jalur halte ini
        </p>
      </div>
    )
  }

  return (
    <div className={styles.list}>
      {stopEta.arrivals.map((a, index) => (
        <ArrivalCard key={a.shuttle_id} arrival={a} index={index} />
      ))}
    </div>
  )
}
