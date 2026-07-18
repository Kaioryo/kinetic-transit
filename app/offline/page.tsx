'use client'

import { WifiOffIcon } from '@/components/icons/Icons'
import styles from './offline.module.css'

export default function OfflinePage() {
  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <div className={styles.icon}>
          <WifiOffIcon size={64} />
        </div>
        <h1 className={styles.title}>Anda Sedang Offline</h1>
        <p className={styles.description}>
          Koneksi internet tidak tersedia. Data shuttle terakhir mungkin tidak akurat.
        </p>
        <p className={styles.hint}>
          Periksa koneksi internet Anda dan coba lagi.
        </p>
        <button
          className={styles.retryButton}
          onClick={() => window.location.reload()}
        >
          Coba Lagi
        </button>
      </div>
    </div>
  )
}
