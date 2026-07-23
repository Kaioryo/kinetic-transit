'use client'

import { useEffect } from 'react'
import { WifiOffIcon } from '@/components/icons/Icons'
import styles from './offline.module.css'

export default function OfflinePage() {
  useEffect(() => {
    // Begitu koneksi kembali, langsung reload otomatis — pengguna tidak perlu
    // menekan "Coba Lagi" sama sekali. window.location.reload() dipakai (bukan
    // location.href = url yang sama) karena address bar tetap di URL asli
    // selama fallback ini ditampilkan oleh service worker, sehingga menimpa
    // href dengan URL yang identik tidak dianggap navigasi baru oleh browser.
    const handleOnline = () => window.location.reload()
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [])

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
