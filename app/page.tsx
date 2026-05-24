'use client'

import { useEffect, useRef, useCallback } from 'react'
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
  const isSeeded = useTransitStore((state) => state.isSeeded)
  const seedDatabase = useTransitStore((state) => state.seedDatabase)
  const mode = useTransitStore((state) => state.mode)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  // One-time start mechanism
  useEffect(() => {
    let mounted = true

    const initiateTracker = async () => {
      if (mode === 'mysql' && !isSeeded) {
        await seedDatabase()
      }
      
      if (mounted) {
        // Initial tick
        tick()

        // Set interval
        intervalRef.current = setInterval(() => {
          tick()
        }, 3000)
      }
    }

    initiateTracker()

    return () => {
      mounted = false
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [mode, isSeeded]) // seedDatabase & tick are stable

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
