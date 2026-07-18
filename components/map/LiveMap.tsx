'use client'

import dynamic from 'next/dynamic'
import { Shuttle } from '@/lib/types'
import { UserLocation } from '@/lib/useUserLocation'
import styles from './LiveMap.module.css'

// Dynamic import to avoid SSR issues with Leaflet
const MapContent = dynamic(() => import('./MapContent'), {
  ssr: false,
  loading: () => (
    <div className={styles.loading}>
      <div className={styles.loadingPulse} />
      <span className={styles.loadingText}>Loading map...</span>
    </div>
  ),
})

interface LiveMapProps {
  shuttles: Shuttle[]
  userLocation: UserLocation | null
  recenterTick: number
}

export default function LiveMap({ shuttles, userLocation, recenterTick }: LiveMapProps) {
  return (
    <div className={styles.container}>
      <MapContent shuttles={shuttles} userLocation={userLocation} recenterTick={recenterTick} />
    </div>
  )
}
