'use client'

import { useEffect } from 'react'
import { useTransitStore } from '@/lib/store'
import LiveMap from '@/components/map/LiveMap'
import ETACardList from '@/components/eta/ETACardList'
import Header from '@/components/ui/Header'
import StatusChip from '@/components/ui/StatusChip'
import styles from './page.module.css'

export default function Home() {
  const tick = useTransitStore((state) => state.tick)
  const etas = useTransitStore((state) => state.etas)
  const shuttles = useTransitStore((state) => state.shuttles)

  // Polling data live dari /api/live setiap 3 detik.
  useEffect(() => {
    tick()
    const interval = setInterval(tick, 3000)
    return () => clearInterval(interval)
  }, [tick])

  return (
    <div className={styles.container}>
      <Header />

      <main className={styles.main}>
        {/* Map Section — Top 50% */}
        <section className={styles.mapSection}>
          <LiveMap shuttles={shuttles} />
          {/* Tonal Transition Scrim */}
          <div className={styles.mapScrim} />
        </section>

        {/* ETA Panel — Bottom 50% */}
        <section className={styles.etaSection}>
          <div className={styles.etaHeader}>
            <div>
              <span className={styles.etaLabel}>Upcoming Arrivals</span>
              <h2 className={styles.etaTitle}>Nearby Stops</h2>
            </div>
            <StatusChip />
          </div>

          <div className={styles.etaContent}>
            <ETACardList etas={etas} />
          </div>
        </section>
      </main>
    </div>
  )
}
