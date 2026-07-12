'use client'

import { useTransitStore } from '@/lib/store'
import styles from './StatusChip.module.css'

// Indikator kesegaran data. Dulu hardcoded "Live" — sekarang benar-benar
// mencerminkan kondisi: kalau semua bus berhenti mengirim GPS (ESP32 mati /
// hilang sinyal), penumpang harus tahu bahwa data tidak lagi live.
export default function StatusChip() {
  const shuttles = useTransitStore((state) => state.shuttles)

  const liveCount = shuttles.filter((s) => !s.is_stale).length

  let label: string
  let variant: 'live' | 'stale' | 'idle'

  if (shuttles.length === 0) {
    label = 'Tidak ada bus'
    variant = 'idle'
  } else if (liveCount === 0) {
    label = 'Sinyal terputus'
    variant = 'stale'
  } else {
    label = 'Live'
    variant = 'live'
  }

  return (
    <div className={`${styles.chip} ${styles[variant]}`}>
      <span className={styles.dot} />
      <span className={styles.text}>{label}</span>
    </div>
  )
}
